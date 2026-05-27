import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { nanoid } from "nanoid";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { renderJobs, user, projects } from "../db/schema";
import { projectDir, renderOutputPath } from "../storage/fs";
import { EventEmitter } from "node:events";
import { sendEmail } from "../email/send";
import { renderDoneEmail, renderFailedEmail } from "../email/templates";
import { recordUsage, getUserPlan } from "../billing/usage";
import { logError } from "../observability/logger";

const MAX_CONCURRENT = Number(process.env.MAX_CONCURRENT_RENDERS || 2);
const RENDER_MODE = (process.env.RENDER_MODE || "local") as "local" | "docker";

// The CLI binary is installed into node_modules/.bin by bun via the
// @hyperframes/cli workspace dependency. spawn() resolves it via PATH.
const CLI_BIN_NAME = "hyperframes";

type Job = {
  id: string;
  userId: string;
  projectId: string;
  fps: number;
  quality: "draft" | "standard" | "high";
};

const pending: Job[] = [];
let active = 0;
const events = new EventEmitter();
events.setMaxListeners(0);

export function onJobUpdate(jobId: string, listener: (data: unknown) => void): () => void {
  const ev = `job:${jobId}`;
  events.on(ev, listener);
  return () => events.off(ev, listener);
}

function emitJob(jobId: string, data: unknown) {
  events.emit(`job:${jobId}`, data);
}

export async function enqueue(opts: {
  userId: string;
  projectId: string;
  fps?: number;
  quality?: "draft" | "standard" | "high" | string;
}): Promise<string> {
  const id = nanoid(12);
  const job: Job = {
    id,
    userId: opts.userId,
    projectId: opts.projectId,
    fps: opts.fps || 30,
    quality: (opts.quality as Job["quality"]) || "standard",
  };
  const now = new Date();
  db.insert(renderJobs)
    .values({
      id,
      projectId: opts.projectId,
      userId: opts.userId,
      status: "queued",
      progress: 0,
      fps: job.fps,
      quality: job.quality,
      createdAt: now,
    })
    .run();
  pending.push(job);
  tick();
  return id;
}

function tick() {
  while (active < MAX_CONCURRENT && pending.length > 0) {
    const job = pending.shift()!;
    active++;
    runJob(job)
      .catch((error) => console.error("[render] job failed", job.id, error))
      .finally(() => {
        active--;
        tick();
      });
  }
}

async function runJob(job: Job) {
  const outDir = renderOutputPath(job.id);
  mkdirSync(outDir, { recursive: true });
  const outputPath = join(outDir, "output.mp4");
  const startedAt = new Date();
  db.update(renderJobs)
    .set({ status: "running", startedAt, progress: 0.01 })
    .where(eq(renderJobs.id, job.id))
    .run();
  emitJob(job.id, { status: "running", progress: 0.01 });

  try {
    await spawnCli(job, outputPath);
    const plan = getUserPlan(job.userId);
    if (plan.watermark) {
      await applyWatermark(outputPath).catch((error) => {
        // Non-fatal: deliver the MP4 even if the overlay step fails. We'd
        // rather a watermark-less render than a failed render at this stage.
        console.error("[render] watermark step failed", error);
      });
    }
    const finishedAt = new Date();
    db.update(renderJobs)
      .set({
        status: "done",
        progress: 1,
        outputPath,
        finishedAt,
      })
      .where(eq(renderJobs.id, job.id))
      .run();
    // This queue runs on our cloud. Charge it against the free cap.
    const cloudSeconds = Math.max(
      1,
      Math.round((finishedAt.getTime() - startedAt.getTime()) / 1000),
    );
    recordUsage(job.userId, "cloud_render_seconds", cloudSeconds, {
      jobId: job.id,
      source: "queue",
    });
    emitJob(job.id, { status: "done", progress: 1, outputPath });
    notifyOutcome(job, "done").catch((error) =>
      console.error("[render] email notify failed", error),
    );
  } catch (error) {
    const message = (error as Error).message || String(error);
    logError("render.queue", error, { jobId: job.id, userId: job.userId });
    db.update(renderJobs)
      .set({
        status: "failed",
        error: message,
        finishedAt: new Date(),
      })
      .where(eq(renderJobs.id, job.id))
      .run();
    emitJob(job.id, { status: "failed", error: message });
    notifyOutcome(job, "failed", message).catch((notifyError) =>
      console.error("[render] email notify failed", notifyError),
    );
  }
}

async function notifyOutcome(
  job: Job,
  outcome: "done" | "failed",
  errorMessage?: string,
): Promise<void> {
  const owner = db.select().from(user).where(eq(user.id, job.userId)).get();
  if (!owner?.email) return;
  const project = db.select().from(projects).where(eq(projects.id, job.projectId)).get();
  const projectName = project?.name || "(untitled project)";
  const baseUrl = process.env.BETTER_AUTH_URL || "http://localhost:3000";
  if (outcome === "done") {
    await sendEmail({
      to: owner.email,
      subject: `Your render is ready — ${projectName}`,
      html: renderDoneEmail({
        projectName,
        downloadUrl: `${baseUrl}/api/render/${job.id}/download`,
      }),
    });
  } else {
    await sendEmail({
      to: owner.email,
      subject: `Render failed — ${projectName}`,
      html: renderFailedEmail({
        projectName,
        errorMessage: errorMessage || "unknown error",
      }),
    });
  }
}

// Hard cap on a single render. Long-form 8-min compositions on slow hardware
// can hit ~20 min; 30 minutes is comfortable headroom while still preventing
// orphaned ffmpeg processes from running forever (the previous behavior).
const RENDER_TIMEOUT_MS = Number(process.env.RENDER_TIMEOUT_MS || 30 * 60 * 1000);

async function spawnCli(job: Job, outputPath: string) {
  const { spawn } = await import("node:child_process");
  const projectPath = projectDir(job.userId, job.projectId);
  const args = [
    "render",
    projectPath,
    "--output",
    outputPath,
    "--fps",
    String(job.fps),
    "--quality",
    job.quality,
  ];
  if (RENDER_MODE === "docker") args.push("--docker");
  const PATH = process.env.PATH || "";
  // In production the Next.js process starts from apps/web (CMD: cd apps/web && ...),
  // so cwd() = /app/apps/web. Hyperframes is installed at the workspace root's
  // node_modules, two directories up.
  const extraBin = resolve(process.cwd(), "../../node_modules/.bin");
  await new Promise<void>((resolveP, rejectP) => {
    const child = spawn(CLI_BIN_NAME, args, {
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, PATH: `${extraBin}:${PATH}` },
    });
    let stderrBuf = "";
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
      // Escalate if the process refuses to exit within 5s.
      setTimeout(() => child.kill("SIGKILL"), 5000).unref();
    }, RENDER_TIMEOUT_MS);
    timeout.unref();
    const parseProgress = (chunk: Buffer) => {
      const text = chunk.toString();
      const m = text.match(/(\d+(?:\.\d+)?)\s*%/);
      if (m) {
        const p = Math.max(0.02, Math.min(0.99, Number(m[1]) / 100));
        db.update(renderJobs).set({ progress: p }).where(eq(renderJobs.id, job.id)).run();
        emitJob(job.id, { status: "running", progress: p });
      }
    };
    child.stdout?.on("data", parseProgress);
    child.stderr?.on("data", (chunk: Buffer) => {
      parseProgress(chunk);
      stderrBuf += chunk.toString();
      if (stderrBuf.length > 8000) stderrBuf = stderrBuf.slice(-8000);
    });
    child.on("error", (error) => {
      clearTimeout(timeout);
      rejectP(error);
    });
    child.on("exit", (code) => {
      clearTimeout(timeout);
      if (timedOut) {
        rejectP(
          new Error(`hyperframes render timed out after ${Math.round(RENDER_TIMEOUT_MS / 1000)}s`),
        );
        return;
      }
      if (code === 0) {
        resolveP();
      } else {
        rejectP(new Error(`hyperframes render exited ${code}: ${stderrBuf.slice(-2000)}`));
      }
    });
  });
}

async function applyWatermark(mp4Path: string): Promise<void> {
  const { spawn } = await import("node:child_process");
  const fs = await import("node:fs");
  const path = await import("node:path");
  const dir = path.dirname(mp4Path);
  const tmpPath = path.join(dir, "output.watermarked.mp4");
  // Bottom-right corner, small semi-transparent label. Falls back gracefully
  // if the bundled font isn't present — drawtext will refuse to render and
  // the catch in queue.ts will leave the original output intact.
  const drawtext =
    "drawtext=text='Made with VibeEdit':x=w-tw-24:y=h-th-24:fontcolor=white@0.78:fontsize=h/30:box=1:boxcolor=black@0.45:boxborderw=8";
  await new Promise<void>((resolveP, rejectP) => {
    const child = spawn(
      "ffmpeg",
      [
        "-y",
        "-i",
        mp4Path,
        "-vf",
        drawtext,
        "-c:a",
        "copy",
        "-preset",
        "veryfast",
        "-crf",
        "22",
        tmpPath,
      ],
      { stdio: ["ignore", "ignore", "pipe"] },
    );
    let stderr = "";
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
      if (stderr.length > 4000) stderr = stderr.slice(-4000);
    });
    child.on("error", rejectP);
    child.on("exit", (code) =>
      code === 0
        ? resolveP()
        : rejectP(new Error(`watermark ffmpeg exited ${code}: ${stderr.slice(-800)}`)),
    );
  });
  fs.renameSync(tmpPath, mp4Path);
}
