import { NextResponse } from "next/server";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { renderJobs, projects } from "@/lib/db/schema";
import { authenticateWorker } from "@/lib/worker/auth";
import { existsSync, readFileSync } from "node:fs";
import { resolve, join, sep, relative } from "node:path";

const STORAGE_ROOT = process.env.STORAGE_ROOT || resolve(process.cwd(), "storage");

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = authenticateWorker(req);
  if (!auth) return new NextResponse("unauthorized", { status: 401 });
  // Find the oldest queued job for this user, then atomically claim it.
  // Without the second `eq(status, "queued")` predicate in the UPDATE,
  // two concurrent workers could both read the same job and both flip it
  // to "running" — the loser would later see no work but the job is already
  // claimed. The UPDATE returns the claimed row only if status was still
  // "queued" at write time (SQLite `RETURNING` for compare-and-swap).
  const candidate = db
    .select()
    .from(renderJobs)
    .where(and(eq(renderJobs.userId, auth.userId), eq(renderJobs.status, "queued")))
    .orderBy(asc(renderJobs.createdAt))
    .limit(1)
    .get();
  if (!candidate) return NextResponse.json({ job: null });

  const claimed = db
    .update(renderJobs)
    .set({ status: "running", startedAt: new Date(), progress: 0.01 })
    .where(and(eq(renderJobs.id, candidate.id), eq(renderJobs.status, "queued")))
    .returning({ id: renderJobs.id })
    .all();
  if (claimed.length === 0) {
    // Another worker beat us to it — tell this one to poll again.
    return NextResponse.json({ job: null });
  }
  const job = candidate;

  const project = db.select().from(projects).where(eq(projects.id, job.projectId)).get();
  const projectDir = join(STORAGE_ROOT, "projects", auth.userId, job.projectId);
  // Bundle project files as a manifest (path + base64 content) — worker writes them locally
  const files: Array<{ path: string; content: string }> = [];
  const walk = (current: string) => {
    const fs = require("node:fs") as typeof import("node:fs");
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (entry.name === "snapshots" || entry.name.startsWith(".")) continue;
      const full = join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (existsSync(full)) {
        files.push({
          path: relative(projectDir, full).split(sep).join("/"),
          content: readFileSync(full).toString("base64"),
        });
      }
    }
  };
  if (existsSync(projectDir)) walk(projectDir);

  return NextResponse.json({
    job: {
      id: job.id,
      projectName: project?.name || "untitled",
      fps: job.fps,
      quality: job.quality,
      files,
    },
  });
}
