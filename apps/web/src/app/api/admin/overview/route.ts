import { NextResponse } from "next/server";
import { desc, gte, sql, eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  user,
  projects,
  renderJobs,
  subscriptions,
  waitlistSignups,
  errorLog,
  usageEvents,
  bugReports,
} from "@/lib/db/schema";
import { requireAdmin } from "@/lib/admin";
import { PLANS } from "@/lib/billing/plans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const admin = await requireAdmin();
  if (admin instanceof Response) return admin;

  const now = Date.now();
  const last24h = new Date(now - 24 * 3600 * 1000);
  const last7d = new Date(now - 7 * 24 * 3600 * 1000);
  const last30d = new Date(now - 30 * 24 * 3600 * 1000);

  const totalUsers =
    db
      .select({ count: sql<number>`count(*)` })
      .from(user)
      .get()?.count ?? 0;

  const newUsers24h =
    db
      .select({ count: sql<number>`count(*)` })
      .from(user)
      .where(gte(user.createdAt, last24h))
      .get()?.count ?? 0;

  const newUsers7d =
    db
      .select({ count: sql<number>`count(*)` })
      .from(user)
      .where(gte(user.createdAt, last7d))
      .get()?.count ?? 0;

  const totalProjects =
    db
      .select({ count: sql<number>`count(*)` })
      .from(projects)
      .get()?.count ?? 0;

  const totalRenders =
    db
      .select({ count: sql<number>`count(*)` })
      .from(renderJobs)
      .where(eq(renderJobs.status, "done"))
      .get()?.count ?? 0;

  const rendersLast24h =
    db
      .select({ count: sql<number>`count(*)` })
      .from(renderJobs)
      .where(and(eq(renderJobs.status, "done"), gte(renderJobs.createdAt, last24h)))
      .get()?.count ?? 0;

  const failedRenders24h =
    db
      .select({ count: sql<number>`count(*)` })
      .from(renderJobs)
      .where(and(eq(renderJobs.status, "failed"), gte(renderJobs.createdAt, last24h)))
      .get()?.count ?? 0;

  const waitlist =
    db
      .select({ count: sql<number>`count(*)` })
      .from(waitlistSignups)
      .get()?.count ?? 0;

  const bugReportsCount =
    db
      .select({ count: sql<number>`count(*)` })
      .from(bugReports)
      .where(gte(bugReports.createdAt, last7d))
      .get()?.count ?? 0;

  // Subscriptions breakdown — counts per plan + estimated MRR.
  const subRows = db
    .select({ plan: subscriptions.plan, status: subscriptions.status })
    .from(subscriptions)
    .all();
  const planCounts: Record<string, { total: number; active: number }> = {};
  let mrr = 0;
  for (const row of subRows) {
    planCounts[row.plan] ??= { total: 0, active: 0 };
    planCounts[row.plan].total++;
    if (row.status === "active" || row.status === "trialing") {
      planCounts[row.plan].active++;
      const meta = PLANS[row.plan as keyof typeof PLANS];
      if (meta) mrr += meta.priceMonthly;
    }
  }

  const chatTurns24h =
    db
      .select({ amount: sql<number>`coalesce(sum(amount),0)` })
      .from(usageEvents)
      .where(and(eq(usageEvents.kind, "chat_turn"), gte(usageEvents.createdAt, last24h)))
      .get()?.amount ?? 0;

  const recentErrors = db.select().from(errorLog).orderBy(desc(errorLog.createdAt)).limit(20).all();

  const topUsers = db
    .select({
      userId: usageEvents.userId,
      turns: sql<number>`sum(amount)`,
    })
    .from(usageEvents)
    .where(and(eq(usageEvents.kind, "chat_turn"), gte(usageEvents.createdAt, last30d)))
    .groupBy(usageEvents.userId)
    .orderBy(desc(sql`sum(amount)`))
    .limit(10)
    .all();

  const topUserEmails = new Map<string, string>();
  if (topUsers.length > 0) {
    const ids = topUsers.map((row) => row.userId);
    // drizzle's inArray would be cleaner; loop keeps the dep list short.
    for (const id of ids) {
      const owner = db.select({ email: user.email }).from(user).where(eq(user.id, id)).get();
      if (owner) topUserEmails.set(id, owner.email);
    }
  }

  return NextResponse.json({
    users: { total: totalUsers, last24h: newUsers24h, last7d: newUsers7d },
    projects: { total: totalProjects },
    renders: {
      total: totalRenders,
      last24h: rendersLast24h,
      failed24h: failedRenders24h,
    },
    waitlist,
    bugReportsLast7d: bugReportsCount,
    subscriptions: { breakdown: planCounts, mrr },
    usage: { chatTurns24h },
    errors: recentErrors.map((row) => ({
      id: row.id,
      source: row.source,
      message: row.message,
      at: row.createdAt,
    })),
    topUsers: topUsers.map((row) => ({
      userId: row.userId,
      email: topUserEmails.get(row.userId) || row.userId,
      turns: Number(row.turns || 0),
    })),
  });
}
