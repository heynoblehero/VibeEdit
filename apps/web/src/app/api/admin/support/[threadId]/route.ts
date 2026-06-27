import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { supportMessages, supportThreads, user } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/admin";
import { sendEmail } from "@/lib/email/send";

const MAX_BODY = 4000;

type Ctx = { params: Promise<{ threadId: string }> };

// GET /api/admin/support/[threadId] — read a thread's full conversation.
// Reading clears the admin-unread flag for this thread.
export async function GET(_req: Request, ctx: Ctx) {
  const gate = await requireAdmin();
  if (gate instanceof Response) return gate;
  const { threadId } = await ctx.params;

  const thread = db.select().from(supportThreads).where(eq(supportThreads.id, threadId)).get();
  if (!thread) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const messages = db
    .select()
    .from(supportMessages)
    .where(eq(supportMessages.threadId, threadId))
    .orderBy(asc(supportMessages.createdAt))
    .all();

  if (thread.unreadForAdmin) {
    db.update(supportThreads)
      .set({ unreadForAdmin: false })
      .where(eq(supportThreads.id, threadId))
      .run();
  }

  const owner = db
    .select({ name: user.name, email: user.email })
    .from(user)
    .where(eq(user.id, thread.userId))
    .get();

  return NextResponse.json({
    thread: { ...thread, unreadForAdmin: false, userName: owner?.name, userEmail: owner?.email },
    messages,
  });
}

// POST /api/admin/support/[threadId] — post an admin reply. Flags the thread
// unread for the user and best-effort emails them.
export async function POST(req: Request, ctx: Ctx) {
  const gate = await requireAdmin();
  if (gate instanceof Response) return gate;
  const { threadId } = await ctx.params;

  const payload = (await req.json().catch(() => ({}))) as { body?: string };
  const body = (payload.body || "").trim();
  if (body.length < 1) {
    return NextResponse.json({ error: "empty message" }, { status: 400 });
  }

  const thread = db.select().from(supportThreads).where(eq(supportThreads.id, threadId)).get();
  if (!thread) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const now = new Date();
  const messageId = nanoid(12);
  db.insert(supportMessages)
    .values({
      id: messageId,
      threadId,
      sender: "admin",
      body: body.slice(0, MAX_BODY),
      createdAt: now,
    })
    .run();

  // An admin reply reopens a closed thread so the customer can continue.
  db.update(supportThreads)
    .set({ unreadForUser: true, status: "open", lastMessageAt: now })
    .where(eq(supportThreads.id, threadId))
    .run();

  // Best-effort email notification — never blocks the response.
  const owner = db.select({ email: user.email }).from(user).where(eq(user.id, thread.userId)).get();
  if (owner?.email) {
    void sendEmail({
      to: owner.email,
      subject: "New reply from VibeEdit support",
      html: `<p>You have a new reply from the VibeEdit support team. Open the app and click the support chat to read it.</p>`,
    }).catch(() => {});
  }

  return NextResponse.json({ messageId });
}

// PATCH /api/admin/support/[threadId] — toggle open/closed status.
export async function PATCH(req: Request, ctx: Ctx) {
  const gate = await requireAdmin();
  if (gate instanceof Response) return gate;
  const { threadId } = await ctx.params;

  const payload = (await req.json().catch(() => ({}))) as { status?: string };
  const status = payload.status === "closed" ? "closed" : payload.status === "open" ? "open" : null;
  if (!status) {
    return NextResponse.json({ error: "invalid status" }, { status: 400 });
  }

  const thread = db.select().from(supportThreads).where(eq(supportThreads.id, threadId)).get();
  if (!thread) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  db.update(supportThreads).set({ status }).where(eq(supportThreads.id, threadId)).run();
  return NextResponse.json({ status });
}
