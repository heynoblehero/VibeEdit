import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { affiliateClicks } from "@/lib/db/schema";
import { requireServerSession } from "@/lib/server-session";

export async function GET(req: Request) {
  const session = await requireServerSession().catch((r) => r);
  if (session instanceof Response) return session;
  const userId = session.user.id;
  const total = db
    .select({ c: sql<number>`count(*)` })
    .from(affiliateClicks)
    .where(eq(affiliateClicks.userId, userId))
    .get();
  const url = new URL(req.url);
  const link = `${url.origin}/api/affiliate/track?u=${userId}`;
  return NextResponse.json({
    clicks: total?.c || 0,
    link,
  });
}
