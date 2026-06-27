import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { supportMessages, supportThreads } from "@/lib/db/schema";
import { requireServerSession } from "@/lib/server-session";

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
  db.insert(supportMessages)
    .values({
      id: messageId,
      threadId: thread.id,
      sender: "user",
      body: body.slice(0, MAX_BODY),
      createdAt: now,
    })
    .run();

  return NextResponse.json({ threadId: thread.id, messageId });
}
