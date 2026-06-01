import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { requireServerSession } from "@/lib/server-session";
import { db } from "@/lib/db";
import { workspaces, workspaceMembers } from "@/lib/db/schema";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; memberId: string }> },
) {
  const session = await requireServerSession().catch((r) => r);
  if (session instanceof Response) return session;
  const userId = session.user.id;
  const { id, memberId } = await params;

  const ws = db.select().from(workspaces).where(eq(workspaces.id, id)).get();
  if (!ws) return new NextResponse("not found", { status: 404 });
  if (ws.ownerId !== userId) return new NextResponse("forbidden", { status: 403 });

  const body = (await req.json()) as { role?: string };
  const role = body.role === "viewer" ? "viewer" : "editor";

  db.update(workspaceMembers)
    .set({ role })
    .where(and(eq(workspaceMembers.id, memberId), eq(workspaceMembers.workspaceId, id)))
    .run();

  const updated = db.select().from(workspaceMembers).where(eq(workspaceMembers.id, memberId)).get();
  if (!updated) return new NextResponse("not found", { status: 404 });
  return NextResponse.json(updated);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; memberId: string }> },
) {
  const session = await requireServerSession().catch((r) => r);
  if (session instanceof Response) return session;
  const userId = session.user.id;
  const { id, memberId } = await params;

  const ws = db.select().from(workspaces).where(eq(workspaces.id, id)).get();
  if (!ws) return new NextResponse("not found", { status: 404 });
  if (ws.ownerId !== userId) return new NextResponse("forbidden", { status: 403 });

  db.delete(workspaceMembers)
    .where(and(eq(workspaceMembers.id, memberId), eq(workspaceMembers.workspaceId, id)))
    .run();
  return new NextResponse(null, { status: 204 });
}
