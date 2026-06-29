import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { requireServerSession } from "@/lib/server-session";
import { describeState, readProjectState } from "@/lib/storage/project-state";

async function ownedProject(userId: string, id: string) {
  return db
    .select()
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.userId, userId)))
    .get();
}

// GET — conversational edit-state summary so the editor can surface that vibe
// editing is happening underneath the chat (human summary + undo affordance).
// Returns a clean empty shape when no project-state file exists yet.
export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await requireServerSession().catch((r) => r);
  if (session instanceof Response) return session;
  const userId = session.user.id;
  const { id } = await context.params;
  if (!(await ownedProject(userId, id))) return new NextResponse("not found", { status: 404 });

  const state = readProjectState(userId, id);
  if (!state) {
    return NextResponse.json({ canUndo: false, undoSteps: 0, summary: null, hasEdits: false });
  }

  const undoSteps = state.revisions.length;
  return NextResponse.json({
    canUndo: undoSteps > 0,
    undoSteps,
    summary: describeState(state),
    hasEdits: true,
  });
}
