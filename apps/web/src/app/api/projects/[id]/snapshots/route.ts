import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { projects, projectSnapshots } from "@/lib/db/schema";
import { requireServerSession } from "@/lib/server-session";
import { writeProjectFile } from "@/lib/storage/fs";

export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await requireServerSession().catch((r) => r);
  if (session instanceof Response) return session;
  const userId = session.user.id;
  const { id: projectId } = await context.params;

  const owned = db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
    .get();
  if (!owned) return new NextResponse("not found", { status: 404 });

  const url = new URL(req.url);
  const limit = Math.min(50, Number(url.searchParams.get("limit") || "20"));

  const rows = db
    .select({
      id: projectSnapshots.id,
      renderJobId: projectSnapshots.renderJobId,
      label: projectSnapshots.label,
      createdAt: projectSnapshots.createdAt,
    })
    .from(projectSnapshots)
    .where(eq(projectSnapshots.projectId, projectId))
    .orderBy(desc(projectSnapshots.createdAt))
    .limit(limit)
    .all();

  return NextResponse.json({ snapshots: rows });
}

// POST /api/projects/[id]/snapshots/:snapshotId/restore → restores that snapshot
export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await requireServerSession().catch((r) => r);
  if (session instanceof Response) return session;
  const userId = session.user.id;
  const { id: projectId } = await context.params;

  const owned = db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
    .get();
  if (!owned) return new NextResponse("not found", { status: 404 });

  const body = (await req.json().catch(() => ({}))) as { snapshotId: string };
  if (!body.snapshotId) {
    return NextResponse.json({ error: "snapshotId required" }, { status: 400 });
  }

  const snapshot = db
    .select()
    .from(projectSnapshots)
    .where(and(eq(projectSnapshots.id, body.snapshotId), eq(projectSnapshots.projectId, projectId)))
    .get();
  if (!snapshot) return new NextResponse("snapshot not found", { status: 404 });

  writeProjectFile(userId, projectId, "index.html", snapshot.html);
  return NextResponse.json({ ok: true, restoredAt: new Date().toISOString() });
}
