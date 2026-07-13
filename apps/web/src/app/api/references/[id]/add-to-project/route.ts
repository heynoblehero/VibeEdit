import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { requireServerSession } from "@/lib/server-session";
import { addReferenceToProject } from "@/lib/import/library";
import { listAssets } from "@/lib/storage/fs";

export const runtime = "nodejs";

// POST /api/references/[id]/add-to-project { projectId } — copy a saved clip
// into the given project's assets/ so it can be edited/rendered.
export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await requireServerSession().catch((r) => r);
  if (session instanceof Response) return session;
  const userId = session.user.id;
  const { id } = await context.params;

  let body: { projectId?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }
  const projectId = typeof body.projectId === "string" ? body.projectId : "";
  if (!projectId) return NextResponse.json({ error: "missing_projectId" }, { status: 400 });

  const owns = db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
    .get();
  if (!owns) return NextResponse.json({ error: "project_not_found" }, { status: 404 });

  try {
    const assetPath = await addReferenceToProject(userId, id, projectId);
    return NextResponse.json({ asset: assetPath, assets: listAssets(userId, projectId) });
  } catch (error) {
    return NextResponse.json(
      { error: "add_failed", message: error instanceof Error ? error.message : "unknown" },
      { status: 400 },
    );
  }
}
