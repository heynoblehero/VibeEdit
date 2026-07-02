import { NextResponse } from "next/server";
import { gte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { renderJobs, subscriptions, user } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/admin";
import { PLANS } from "@/lib/billing/plans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/*
 * Growth analytics: 30-day trends, the signup→activated→paid funnel, unit
 * economics (MRR / ARPU / conversion), and render health. Complements
 * /api/admin/overview (point-in-time counts) with time-series + ratios so the
 * operator can see direction, not just current state. Numbers live from the DB.
 */
const DAYS = 30;

export async function GET() {
  const admin = await requireAdmin();
  if (admin instanceof Response) return admin;

  const startMs = Date.now() - DAYS * 86_400_000;
  const start = new Date(startMs);
  const dayExpr = (column: unknown) => sql<string>`strftime('%Y-%m-%d', ${column}, 'unixepoch')`;

  // Daily signups.
  const signupRows = db
    .select({ day: dayExpr(user.createdAt), n: sql<number>`count(*)` })
    .from(user)
    .where(gte(user.createdAt, start))
    .groupBy(sql`1`)
    .all();

  // Daily renders + failures.
  const renderRows = db
    .select({
      day: dayExpr(renderJobs.createdAt),
      total: sql<number>`count(*)`,
      failed: sql<number>`sum(case when ${renderJobs.status} in ('failed','error') then 1 else 0 end)`,
    })
    .from(renderJobs)
    .where(gte(renderJobs.createdAt, start))
    .groupBy(sql`1`)
    .all();

  const signupMap = new Map(signupRows.map((row) => [row.day, Number(row.n)]));
  const renderMap = new Map(
    renderRows.map((row) => [
      row.day,
      { total: Number(row.total), failed: Number(row.failed ?? 0) },
    ]),
  );

  const series: Array<{ day: string; signups: number; renders: number; failures: number }> = [];
  for (let index = 0; index < DAYS; index++) {
    const day = new Date(startMs + index * 86_400_000).toISOString().slice(0, 10);
    const render = renderMap.get(day);
    series.push({
      day,
      signups: signupMap.get(day) ?? 0,
      renders: render?.total ?? 0,
      failures: render?.failed ?? 0,
    });
  }

  // Funnel (last 30d): signed up → activated (rendered ≥1) → currently paying.
  const signups30d = signupRows.reduce((sum, row) => sum + Number(row.n), 0);
  const activated30d =
    db
      .select({ n: sql<number>`count(distinct ${renderJobs.userId})` })
      .from(renderJobs)
      .where(gte(renderJobs.createdAt, start))
      .get()?.n ?? 0;

  // Unit economics from current active subscriptions.
  const subRows = db
    .select({ plan: subscriptions.plan, status: subscriptions.status })
    .from(subscriptions)
    .all();
  let mrr = 0;
  let payingUsers = 0;
  const planBreakdown: Record<string, number> = {};
  for (const row of subRows) {
    const isActive = row.status === "active" || row.status === "trialing";
    if (!isActive) continue;
    const meta = PLANS[row.plan as keyof typeof PLANS];
    if (meta && meta.priceMonthly > 0) {
      mrr += meta.priceMonthly;
      payingUsers++;
      planBreakdown[row.plan] = (planBreakdown[row.plan] ?? 0) + 1;
    }
  }
  const totalUsers =
    db
      .select({ n: sql<number>`count(*)` })
      .from(user)
      .get()?.n ?? 0;
  const freeUsers = Math.max(0, totalUsers - payingUsers);
  const freeToPaidPct = totalUsers > 0 ? (payingUsers / totalUsers) * 100 : 0;
  const arpu = payingUsers > 0 ? mrr / payingUsers : 0;

  // Render health over the window.
  const health = db
    .select({
      total: sql<number>`count(*)`,
      done: sql<number>`sum(case when ${renderJobs.status} = 'done' then 1 else 0 end)`,
      failed: sql<number>`sum(case when ${renderJobs.status} in ('failed','error') then 1 else 0 end)`,
      avgSeconds: sql<number>`avg(${renderJobs.durationSeconds})`,
    })
    .from(renderJobs)
    .where(gte(renderJobs.createdAt, start))
    .get();
  const renderTotal = Number(health?.total ?? 0);
  const renderDone = Number(health?.done ?? 0);
  const renderFailed = Number(health?.failed ?? 0);

  return NextResponse.json({
    windowDays: DAYS,
    series,
    funnel: {
      signups: signups30d,
      activated: activated30d,
      paying: payingUsers,
      signupToActivatedPct: signups30d > 0 ? (activated30d / signups30d) * 100 : 0,
    },
    economics: {
      mrr,
      arr: mrr * 12,
      payingUsers,
      freeUsers,
      totalUsers,
      freeToPaidPct,
      arpu,
      planBreakdown,
    },
    renderHealth: {
      total: renderTotal,
      done: renderDone,
      failed: renderFailed,
      successPct: renderTotal > 0 ? (renderDone / renderTotal) * 100 : 0,
      avgSeconds: Math.round(Number(health?.avgSeconds ?? 0)),
    },
  });
}
