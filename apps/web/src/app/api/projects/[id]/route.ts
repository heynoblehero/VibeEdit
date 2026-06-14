import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { rmSync } from "node:fs";
import { db } from "@/lib/db";
import { projects, renderJobs } from "@/lib/db/schema";
import { requireServerSession } from "@/lib/server-session";
import {
  assetSource,
  listFiles,
  projectDir,
  readAssetMeta,
  renderOutputPath,
} from "@/lib/storage/fs";

export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await requireServerSession().catch((r) => r);
  if (session instanceof Response) return session;
  const userId = session.user.id;
  const { id } = await context.params;
  const row = db
    .select()
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.userId, userId)))
    .get();
  if (!row) return new NextResponse("not found", { status: 404 });
  const files = listFiles(userId, id);
  // Provenance for each asset (upload vs AI-made) so the UI can tag/filter them.
  const meta = readAssetMeta(userId, id);
  const assetMeta: Record<string, "upload" | "ai"> = {};
  for (const path of files) {
    if (path.startsWith("assets/")) assetMeta[path] = assetSource(meta, path);
  }
  return NextResponse.json({ project: row, files, assetMeta });
}

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await requireServerSession().catch((r) => r);
  if (session instanceof Response) return session;
  const userId = session.user.id;
  const { id } = await context.params;
  const body = (await req.json().catch(() => ({}))) as { name?: string };
  if (!body.name?.trim()) return new NextResponse("name required", { status: 400 });
  db.update(projects)
    .set({ name: body.name.trim().slice(0, 100), updatedAt: new Date() })
    .where(and(eq(projects.id, id), eq(projects.userId, userId)))
    .run();
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await requireServerSession().catch((r) => r);
  if (session instanceof Response) return session;
  const userId = session.user.id;
  const { id } = await context.params;
  // Collect render-job ids before deleting the project so we can clean up
  // each job's output dir on disk; the DB cascade only nukes the rows.
  const jobs = db
    .select({ id: renderJobs.id })
    .from(renderJobs)
    .where(and(eq(renderJobs.projectId, id), eq(renderJobs.userId, userId)))
    .all();
  db.delete(projects)
    .where(and(eq(projects.id, id), eq(projects.userId, userId)))
    .run();
  try {
    rmSync(projectDir(userId, id), { recursive: true, force: true });
  } catch {
    /* */
  }
  for (const job of jobs) {
    try {
      rmSync(renderOutputPath(job.id), { recursive: true, force: true });
    } catch {
      /* */
    }
  }
  return NextResponse.json({ ok: true });
}
