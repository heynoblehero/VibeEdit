import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { supportMessages, supportThreads, user } from "@/lib/db/schema";
import { requireServerSession } from "@/lib/server-session";
import { notifyAdmin } from "@/lib/email/notify-admin";

const MAX_BODY = 4000;
const MAX_SUBJECT = 120;

// GET /api/support — list the current user's threads (newest first) with their
// messages. Reading marks the user's unread flag clear on every thread so the
// customer's unread badge resets once they've opened the widget.
export async function GET() {
  const session = await requireServerSession().catch(() => null);
  if (!session || session instanceof Response) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const threads = db
    .select()
    .from(supportThreads)
    .where(eq(supportThreads.userId, userId))
    .orderBy(desc(supportThreads.lastMessageAt))
    .all();

  const result = threads.map((thread) => {
    const msgs = db
      .select()
      .from(supportMessages)
      .where(eq(supportMessages.threadId, thread.id))
      .orderBy(asc(supportMessages.createdAt))
      .all();
    return { ...thread, messages: msgs };
  });

  // Mark all of this user's threads as read for the user side.
  const hasUnread = threads.some((t) => t.unreadForUser);
  if (hasUnread) {
    db.update(supportThreads)
      .set({ unreadForUser: false })
      .where(eq(supportThreads.userId, userId))
      .run();
  }

  return NextResponse.json({ threads: result });
}

// POST /api/support — send a message as the user. Reuses the user's open thread
// if one exists, otherwise creates a new open thread. Flags the thread unread
// for admin.
export async function POST(req: Request) {
  const session = await requireServerSession().catch(() => null);
  if (!session || session instanceof Response) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const payload = (await req.json().catch(() => ({}))) as {
    body?: string;
    subject?: string;
  };
  const body = (payload.body || "").trim();
  if (body.length < 1) {
    return NextResponse.json({ error: "empty message" }, { status: 400 });
  }
  const now = new Date();

  // Find the user's currently open thread, if any.
  let thread = db
    .select()
    .from(supportThreads)
    .where(and(eq(supportThreads.userId, userId), eq(supportThreads.status, "open")))
    .orderBy(desc(supportThreads.lastMessageAt))
    .get();

  if (!thread) {
    const threadId = nanoid(12);
    db.insert(supportThreads)
      .values({
        id: threadId,
        userId,
        subject: (payload.subject || "").trim().slice(0, MAX_SUBJECT) || null,
        status: "open",
        unreadForAdmin: true,
        unreadForUser: false,
        lastMessageAt: now,
        createdAt: now,
      })
      .run();
    thread = db.select().from(supportThreads).where(eq(supportThreads.id, threadId)).get();
  } else {
    db.update(supportThreads)
      .set({ unreadForAdmin: true, lastMessageAt: now })
      .where(eq(supportThreads.id, thread.id))
      .run();
  }

  if (!thread) {
    return NextResponse.json({ error: "thread error" }, { status: 500 });
  }

  const messageId = nanoid(12);
  const messageBody = body.slice(0, MAX_BODY);
  db.insert(supportMessages)
    .values({
      id: messageId,
      threadId: thread.id,
      sender: "user",
      body: messageBody,
      createdAt: now,
    })
    .run();

  // Admin alert: a customer sent a support message. Fire-and-forget so a mail
  // failure never breaks the send. The inbox unreadForAdmin flag is still the
  // source of truth in the console; this is the push notification on top.
  const owner = db.select().from(user).where(eq(user.id, userId)).get();
  void notifyAdmin({
    tag: "support",
    subject: thread.subject || owner?.email || "New support message",
    title: "New support message",
    rows: [
      { label: "From", value: owner?.email || userId },
      { label: "Subject", value: thread.subject || "—" },
      {
        label: "Message",
        value: messageBody.length > 500 ? `${messageBody.slice(0, 500)}…` : messageBody,
      },
    ],
    adminTab: "support",
    ctaLabel: "Open inbox",
  });

  return NextResponse.json({ threadId: thread.id, messageId });
}
