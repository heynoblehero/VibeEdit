import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { eq, and } from "drizzle-orm";
import { requireServerSession } from "@/lib/server-session";
import { db } from "@/lib/db";
import { workspaces, workspaceMembers } from "@/lib/db/schema";
import { sendEmail } from "@/lib/email/send";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireServerSession().catch((r) => r);
  if (session instanceof Response) return session;
  const userId = session.user.id;
  const { id } = await params;

  const ws = db.select().from(workspaces).where(eq(workspaces.id, id)).get();
  if (!ws) return new NextResponse("not found", { status: 404 });
  if (ws.ownerId !== userId) return new NextResponse("forbidden", { status: 403 });

  const body = (await req.json()) as { email?: string; role?: string };
  const email = body.email?.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return new NextResponse("valid email is required", { status: 400 });
  }
  const role = body.role === "viewer" ? "viewer" : "editor";

  // Prevent duplicate invites for this workspace + email.
  const existing = db
    .select()
    .from(workspaceMembers)
    .where(and(eq(workspaceMembers.workspaceId, id), eq(workspaceMembers.inviteEmail, email)))
    .get();
  if (existing) {
    return new NextResponse("already invited or a member", { status: 409 });
  }

  const token = nanoid(32);
  const memberId = nanoid(12);
  db.insert(workspaceMembers)
    .values({
      id: memberId,
      workspaceId: id,
      userId: null,
      role,
      inviteEmail: email,
      inviteToken: token,
      joinedAt: null,
      createdAt: new Date(),
    })
    .run();

  const baseUrl = process.env.BETTER_AUTH_URL || "http://localhost:3000";
  const inviteUrl = `${baseUrl}/workspace-invite/${token}`;

  await sendEmail({
    to: email,
    subject: `You're invited to the "${ws.name}" workspace on VibeEdit`,
    html: `
      <p>Hi,</p>
      <p><strong>${session.user.name || session.user.email}</strong> has invited you to join the <strong>${ws.name}</strong> workspace on VibeEdit.</p>
      <p><a href="${inviteUrl}" style="display:inline-block;background:#ff2b3a;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600;">Accept invite</a></p>
      <p style="color:#999;font-size:12px;">This link expires in 7 days.</p>
    `,
  }).catch((error) => console.error("[workspace] invite email failed", error));

  const member = db.select().from(workspaceMembers).where(eq(workspaceMembers.id, memberId)).get();
  return NextResponse.json(member, { status: 201 });
}
