import { NextResponse } from "next/server";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { messages, projects, projectSnapshots } from "@/lib/db/schema";
import { requireServerSession } from "@/lib/server-session";

export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await requireServerSession().catch((r) => r);
  if (session instanceof Response) return session;
  const userId = session.user.id;
  const { id } = await context.params;
  const owned = db
    .select()
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.userId, userId)))
    .get();
  if (!owned) return new NextResponse("not found", { status: 404 });
  // Left-join the per-turn snapshot (if any) so the chat can render each past
  // version inline. Render snapshots have a null messageId and never join here.
  const rows = db
    .select({
      id: messages.id,
      role: messages.role,
      content: messages.content,
      sceneId: messages.sceneId,
      createdAt: messages.createdAt,
      snapshotId: projectSnapshots.id,
    })
    .from(messages)
    .leftJoin(projectSnapshots, eq(projectSnapshots.messageId, messages.id))
    .where(eq(messages.projectId, id))
    .orderBy(asc(messages.createdAt))
    .all();
  return NextResponse.json({
    messages: rows.map((m) => ({
      id: m.id,
      role: m.role,
      content: JSON.parse(m.content),
      // null = lead/global thread; a scene id = that agent's scoped thread.
      sceneId: m.sceneId,
      createdAt: m.createdAt,
      snapshotId: m.snapshotId,
    })),
  });
}
