/*
 * Unified credit currency.
 *
 * Every costly action — an AI edit, a render, an image/b-roll/voiceover/music
 * generation — spends from ONE monthly credit balance. Pricing is therefore
 * "you get N credits, here's what each action costs", which is simple to grok
 * and maps 1:1 to what actions cost us to fulfill. Credits are calibrated so
 * ~1 credit ≈ 1¢ of real cost and are sold embedded at ~3¢ (see plans.ts) →
 * ~67% gross margin (spend ≤ 1/3 of revenue) by construction.
 *
 * The cost table is admin-tunable live (platformSettings key "creditCosts") so
 * rates can be retuned against real margin data without a deploy.
 *
 * ENFORCEMENT is gated behind BILLING_ENFORCE. Until that env is set, charges
 * only METER (record usage for analytics/margin) and always succeed — so we
 * can ship the whole credit system before the paywall + Polar products are
 * live without locking anyone out. Flip BILLING_ENFORCE=1 once checkout works.
 */

import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { platformSettings, subscriptions } from "@/lib/db/schema";
import { getUserPlan, getUsage, getRenderCredits, recordUsage, reserveUsage } from "./usage";
import { type CreditAction, type CreditCosts, DEFAULT_CREDIT_COSTS } from "./credit-costs";

export { type CreditAction, type CreditCosts, DEFAULT_CREDIT_COSTS };

const COSTS_KEY = "creditCosts";

export function getCreditCosts(): CreditCosts {
  try {
    const row = db
      .select({ value: platformSettings.value })
      .from(platformSettings)
      .where(eq(platformSettings.key, COSTS_KEY))
      .get();
    if (!row?.value) return DEFAULT_CREDIT_COSTS;
    const parsed = JSON.parse(row.value) as Partial<CreditCosts>;
    return { ...DEFAULT_CREDIT_COSTS, ...parsed };
  } catch {
    return DEFAULT_CREDIT_COSTS;
  }
}

export function setCreditCosts(costs: CreditCosts): void {
  db.insert(platformSettings)
    .values({ key: COSTS_KEY, value: JSON.stringify(costs), updatedAt: new Date() })
    .onConflictDoUpdate({
      target: platformSettings.key,
      set: { value: JSON.stringify(costs), updatedAt: new Date() },
    })
    .run();
}

// Credit cost of one action. `units` scales per-unit actions (e.g. render_30s
// for a 90s clip = 3 units; voiceover_30s for 45s = 2 units, rounded up).
export function creditCostOf(action: CreditAction, units = 1): number {
  const costs = getCreditCosts();
  return (costs[action] ?? DEFAULT_CREDIT_COSTS[action]) * Math.max(1, Math.ceil(units));
}

// Whether the credit gate + paywall actually block, vs. meter-only. Off by
// default so the system can ship ahead of Polar going live.
export function billingEnforced(): boolean {
  return process.env.BILLING_ENFORCE === "1" || process.env.BILLING_ENFORCE === "true";
}

export type CreditBalance = {
  monthly: number; // plan allowance this period
  used: number; // spent this period
  topups: number; // purchased top-up credits (carry over)
  remaining: number; // monthly - used, floored at 0
  total: number; // remaining + topups (what's actually spendable)
};

export function creditBalance(userId: string): CreditBalance {
  const plan = getUserPlan(userId);
  const monthly = plan.creditsPerMonth;
  const used = getUsage(userId, "credit");
  const topups = getRenderCredits(userId);
  const remaining = monthly === -1 ? -1 : Math.max(0, monthly - used);
  const total = monthly === -1 ? -1 : remaining + topups;
  return { monthly, used, topups, remaining, total };
}

export type ChargeResult = {
  ok: boolean;
  charged: number;
  balance: CreditBalance;
  enforced: boolean;
};

/*
 * Spend `amount` credits for `reason`. Race-safe via reserveUsage's SQL
 * transaction. When enforcement is off it only records usage (for analytics)
 * and always succeeds. When on, it draws down the monthly allowance first, then
 * purchased top-ups; returns ok:false when both are exhausted so the caller can
 * surface a friendly "out of credits — upgrade" message instead of proceeding.
 */
export function chargeCredits(
  userId: string,
  amount: number,
  reason: string,
  meta: Record<string, unknown> = {},
): ChargeResult {
  const enforced = billingEnforced();
  if (amount <= 0) {
    return { ok: true, charged: 0, balance: creditBalance(userId), enforced };
  }

  if (!enforced) {
    // Meter only: keep an accurate credit spend record for the margin view,
    // but never block while the paywall is dormant.
    recordUsage(userId, "credit", amount, { reason, enforced: false, ...meta });
    return { ok: true, charged: amount, balance: creditBalance(userId), enforced };
  }

  const plan = getUserPlan(userId);
  if (plan.creditsPerMonth === -1) {
    recordUsage(userId, "credit", amount, { reason, ...meta });
    return { ok: true, charged: amount, balance: creditBalance(userId), enforced };
  }

  // Try the monthly allowance first (race-safe).
  const reservation = reserveUsage(
    userId,
    "credit",
    plan.creditsPerMonth,
    { reason, ...meta },
    amount,
  );
  if (reservation.ok) {
    return { ok: true, charged: amount, balance: creditBalance(userId), enforced };
  }

  // Monthly exhausted — fall back to purchased top-up credits.
  const topups = getRenderCredits(userId);
  if (topups >= amount) {
    db.update(subscriptions)
      .set({
        renderCredits: sql`${subscriptions.renderCredits} - ${amount}`,
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.userId, userId))
      .run();
    recordUsage(userId, "credit", amount, { reason, source: "topup", ...meta });
    return { ok: true, charged: amount, balance: creditBalance(userId), enforced };
  }

  return { ok: false, charged: 0, balance: creditBalance(userId), enforced };
}
