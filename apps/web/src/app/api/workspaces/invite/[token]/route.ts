import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { requireServerSession } from "@/lib/server-session";
import { db } from "@/lib/db";
import { workspaceMembers } from "@/lib/db/schema";

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const member = db
    .select()
    .from(workspaceMembers)
    .where(eq(workspaceMembers.inviteToken, token))
    .get();
  if (!member) return new NextResponse("invalid or expired invite", { status: 404 });
  if (member.joinedAt) return new NextResponse("invite already used", { status: 409 });
  return NextResponse.json({
    workspaceId: member.workspaceId,
    email: member.inviteEmail,
    role: member.role,
  });
}

export async function POST(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const session = await requireServerSession().catch((r) => r);
  if (session instanceof Response) return session;
  const userId = session.user.id;
  const { token } = await params;

  const member = db
    .select()
    .from(workspaceMembers)
    .where(eq(workspaceMembers.inviteToken, token))
    .get();
  if (!member) return new NextResponse("invalid or expired invite", { status: 404 });
  if (member.joinedAt) return new NextResponse("invite already used", { status: 409 });

  db.update(workspaceMembers)
    .set({ userId, joinedAt: new Date(), inviteToken: null })
    .where(eq(workspaceMembers.id, member.id))
    .run();

  return NextResponse.json({ workspaceId: member.workspaceId });
}
