import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { eq, or } from "drizzle-orm";
import { requireServerSession } from "@/lib/server-session";
import { db } from "@/lib/db";
import { workspaces, workspaceMembers } from "@/lib/db/schema";

export async function GET() {
  const session = await requireServerSession().catch((r) => r);
  if (session instanceof Response) return session;
  const userId = session.user.id;

  // Workspaces the user owns OR is a member of.
  const owned = db.select().from(workspaces).where(eq(workspaces.ownerId, userId)).all();

  const memberRows = db
    .select({ workspaceId: workspaceMembers.workspaceId })
    .from(workspaceMembers)
    .where(eq(workspaceMembers.userId, userId))
    .all();

  const memberWsIds = [...new Set(memberRows.map((r) => r.workspaceId))];
  const memberWs =
    memberWsIds.length > 0
      ? db
          .select()
          .from(workspaces)
          .where(or(...memberWsIds.map((id) => eq(workspaces.id, id))))
          .all()
      : [];

  const all = [...owned];
  for (const ws of memberWs) {
    if (!all.find((w) => w.id === ws.id)) all.push(ws);
  }

  // Attach member counts.
  const result = all.map((ws) => {
    const memberCount = db
      .select()
      .from(workspaceMembers)
      .where(eq(workspaceMembers.workspaceId, ws.id))
      .all().length;
    return { ...ws, memberCount, isOwner: ws.ownerId === userId };
  });

  return NextResponse.json({ workspaces: result });
}

export async function POST(req: Request) {
  const session = await requireServerSession().catch((r) => r);
  if (session instanceof Response) return session;
  const userId = session.user.id;

  const body = (await req.json()) as { name?: string };
  const name = body.name?.trim();
  if (!name) return new NextResponse("name is required", { status: 400 });

  const now = new Date();
  const id = nanoid(12);
  db.insert(workspaces).values({ id, name, ownerId: userId, createdAt: now, updatedAt: now }).run();

  const ws = db.select().from(workspaces).where(eq(workspaces.id, id)).get();
  return NextResponse.json(ws, { status: 201 });
}
