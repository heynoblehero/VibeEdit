import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import { projects, renderJobs } from "@/lib/db/schema";
import { requireServerSession } from "@/lib/server-session";
import { renderOutputPath, projectThumbPath } from "@/lib/storage/fs";

export const runtime = "nodejs";

/**
 * Persist a render that was produced in the browser (WebCodecs path) so it
 * isn't lost when the tab closes. The video is already encoded client-side;
 * this just stores the MP4 alongside server renders and records a completed
 * renderJobs row so it shows up in the project's render history and download
 * links work the same way.
 *
 * Deliberately does NOT run the billing gates from POST /api/render — the work
 * already happened on the user's device (no server render minutes consumed),
 * and we never want to refuse to save a render the user just successfully made.
 */
export async function POST(req: Request) {
  const session = await requireServerSession().catch((r) => r);
  if (session instanceof Response) return session;
  const userId = session.user.id;

  const form = await req.formData();
  const file = form.get("file");
  const projectId = String(form.get("projectId") ?? "");
  if (!projectId) return new NextResponse("missing projectId", { status: 400 });
  if (!(file instanceof File)) return new NextResponse("missing file", { status: 400 });

  const owned = db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
    .get();
  if (!owned) return new NextResponse("not found", { status: 404 });

  const fps = Number(form.get("fps")) || 30;
  const qualityRaw = String(form.get("quality") ?? "standard");
  const quality = ["draft", "standard", "high"].includes(qualityRaw) ? qualityRaw : "standard";

  const id = nanoid(12);
  const outDir = renderOutputPath(id);
  mkdirSync(outDir, { recursive: true });
  const outputPath = join(outDir, "output.mp4");
  writeFileSync(outputPath, Buffer.from(await file.arrayBuffer()));

  const now = new Date();
  db.insert(renderJobs)
    .values({
      id,
      projectId,
      userId,
      status: "done",
      progress: 1,
      outputPath,
      fps,
      quality,
      // Device render — no server render-minutes were spent, so this must not
      // count toward the user's metered cloud-render time.
      durationSeconds: 0,
      createdAt: now,
      startedAt: now,
      finishedAt: now,
    })
    .run();

  // Best-effort thumbnail so the saved render shows a poster frame. Never let a
  // thumbnail failure fail the save — the MP4 is already stored.
  captureThumbnail(outputPath, projectThumbPath(userId, projectId)).catch(() => {});

  return NextResponse.json({ id });
}

async function captureThumbnail(mp4Path: string, thumbPath: string): Promise<void> {
  const { spawn } = await import("node:child_process");
  mkdirSync(resolve(thumbPath, ".."), { recursive: true });
  await new Promise<void>((res, rej) => {
    const child = spawn(
      "ffmpeg",
      [
        "-y",
        "-ss",
        "00:00:01",
        "-i",
        mp4Path,
        "-vframes",
        "1",
        "-vf",
        "scale=640:-1",
        "-q:v",
        "4",
        thumbPath,
      ],
      { stdio: ["ignore", "ignore", "ignore"] },
    );
    child.on("error", rej);
    child.on("exit", (code) => (code === 0 ? res() : rej(new Error(`ffmpeg exited ${code}`))));
  });
}
