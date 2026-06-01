import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { requireServerSession } from "@/lib/server-session";
import { db } from "@/lib/db";
import { workspaces, workspaceMembers } from "@/lib/db/schema";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireServerSession().catch((r) => r);
  if (session instanceof Response) return session;
  const userId = session.user.id;
  const { id } = await params;

  const ws = db.select().from(workspaces).where(eq(workspaces.id, id)).get();
  if (!ws) return new NextResponse("not found", { status: 404 });

  // Must be owner or member.
  const isMember =
    ws.ownerId === userId ||
    !!db
      .select()
      .from(workspaceMembers)
      .where(and(eq(workspaceMembers.workspaceId, id), eq(workspaceMembers.userId, userId)))
      .get();
  if (!isMember) return new NextResponse("forbidden", { status: 403 });

  const members = db
    .select()
    .from(workspaceMembers)
    .where(eq(workspaceMembers.workspaceId, id))
    .all();

  return NextResponse.json({ ...ws, members, isOwner: ws.ownerId === userId });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireServerSession().catch((r) => r);
  if (session instanceof Response) return session;
  const userId = session.user.id;
  const { id } = await params;

  const ws = db.select().from(workspaces).where(eq(workspaces.id, id)).get();
  if (!ws) return new NextResponse("not found", { status: 404 });
  if (ws.ownerId !== userId) return new NextResponse("forbidden", { status: 403 });

  const body = (await req.json()) as { name?: string };
  const name = body.name?.trim();
  if (!name) return new NextResponse("name is required", { status: 400 });

  db.update(workspaces).set({ name, updatedAt: new Date() }).where(eq(workspaces.id, id)).run();

  const updated = db.select().from(workspaces).where(eq(workspaces.id, id)).get();
  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireServerSession().catch((r) => r);
  if (session instanceof Response) return session;
  const userId = session.user.id;
  const { id } = await params;

  const ws = db.select().from(workspaces).where(eq(workspaces.id, id)).get();
  if (!ws) return new NextResponse("not found", { status: 404 });
  if (ws.ownerId !== userId)
    return new NextResponse("forbidden — only the owner can delete", { status: 403 });

  db.delete(workspaces).where(eq(workspaces.id, id)).run();
  return new NextResponse(null, { status: 204 });
}
