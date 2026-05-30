import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { user, renderJobs, messages } from "@/lib/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const users =
    db
      .select({ count: sql<number>`count(*)` })
      .from(user)
      .get()?.count ?? 0;
  const renders =
    db
      .select({ count: sql<number>`count(*)` })
      .from(renderJobs)
      .where(sql`${renderJobs.status} = 'done'`)
      .get()?.count ?? 0;
  const aiMessages =
    db
      .select({ count: sql<number>`count(*)` })
      .from(messages)
      .where(sql`${messages.role} = 'user'`)
      .get()?.count ?? 0;

  return NextResponse.json({ users, renders, messages: aiMessages });
}
