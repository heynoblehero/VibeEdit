import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { supportThreads, user } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/admin";

// GET /api/admin/support — list every support thread for the admin inbox.
// Ordered unread-first, then newest-first, with the requesting user's name and
// email joined in for display.
export async function GET() {
  const gate = await requireAdmin();
  if (gate instanceof Response) return gate;

  const rows = db
    .select({
      id: supportThreads.id,
      userId: supportThreads.userId,
      subject: supportThreads.subject,
      status: supportThreads.status,
      unreadForAdmin: supportThreads.unreadForAdmin,
      unreadForUser: supportThreads.unreadForUser,
      lastMessageAt: supportThreads.lastMessageAt,
      createdAt: supportThreads.createdAt,
      userName: user.name,
      userEmail: user.email,
    })
    .from(supportThreads)
    .leftJoin(user, eq(supportThreads.userId, user.id))
    .orderBy(desc(supportThreads.lastMessageAt))
    .all();

  // Unread-first, then newest-first (sort is stable on the DB ordering above).
  rows.sort((a, b) => Number(b.unreadForAdmin) - Number(a.unreadForAdmin));

  return NextResponse.json({ threads: rows });
}
