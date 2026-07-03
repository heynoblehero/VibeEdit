import { and, eq, gt, gte, isNull, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "../db";
import { subscriptions, usageEvents, workerTokens, user } from "../db/schema";
import { planFor, PLANS, type Plan, type PlanId } from "./plans";
import { isAdminEmail } from "../admin";

export function getRenderCredits(userId: string): number {
  const sub = db
    .select({ renderCredits: subscriptions.renderCredits })
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .get();
  return sub?.renderCredits ?? 0;
}

export function spendRenderCredit(userId: string): boolean {
  const credits = getRenderCredits(userId);
  if (credits <= 0) return false;
  db.update(subscriptions)
    .set({ renderCredits: credits - 1 })
    .where(eq(subscriptions.userId, userId))
    .run();
  return true;
}

// Atomic credit spend — the read-then-write version above can be raced into a
// double-spend (two requests both read credits=1, both decrement). The
// conditional UPDATE decrements only when renderCredits > 0 in a single
// statement; we check the affected-row count to know whether a credit was
// actually consumed. Used by the render gate when a user is over plan limit.
export function trySpendRenderCredit(userId: string): boolean {
  const result = db
    .update(subscriptions)
    .set({ renderCredits: sql`${subscriptions.renderCredits} - 1` })
    .where(and(eq(subscriptions.userId, userId), gt(subscriptions.renderCredits, 0)))
    .run();
  return result.changes > 0;
}

export type UsageKind =
  | "render"
  | "chat_turn"
  | "cloud_render_seconds"
  | "render_minutes"
  | "generation"
  // Unified credit currency (lib/billing/credits.ts) — the balance every
  // action now spends against. The other kinds remain for legacy per-action
  // metering + analytics, but credits are the real limit.
  | "credit";

// Free-tier cap on render time consumed by our cloud (i.e. by users who have
// not installed the local worker). Once exhausted, we hard-block and tell
// them to install the worker. Lifetime cap, not monthly.
export const CLOUD_RENDER_SECONDS_CAP_FREE = 30;
const WORKER_HEARTBEAT_WINDOW_MS = 5 * 60 * 1000;

export function getOrCreateSubscription(userId: string) {
  const existing = db.select().from(subscriptions).where(eq(subscriptions.userId, userId)).get();
  if (existing) return existing;
  const now = new Date();
  const id = nanoid(10);
  db.insert(subscriptions)
    .values({
      id,
      userId,
      plan: "free",
      status: "active",
      cancelAtPeriodEnd: false,
      createdAt: now,
      updatedAt: now,
    })
    .run();
  return {
    id,
    userId,
    plan: "free",
    status: "active",
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    polarCustomerId: null,
    polarSubscriptionId: null,
    trialEndsAt: null,
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    renderCredits: 0,
    createdAt: now,
    updatedAt: now,
  } as ReturnType<typeof firstMatching>;
}

function firstMatching() {
  return db.select().from(subscriptions).get();
}

export function startOfMonth(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

export function getUsage(userId: string, kind: UsageKind): number {
  const since = startOfMonth();
  const result = db
    .select({ total: sql<number>`coalesce(sum(${usageEvents.amount}), 0)` })
    .from(usageEvents)
    .where(
      and(
        eq(usageEvents.userId, userId),
        eq(usageEvents.kind, kind),
        gte(usageEvents.createdAt, since),
      ),
    )
    .get();
  return result?.total || 0;
}

export function recordUsage(
  userId: string,
  kind: UsageKind,
  amount = 1,
  meta?: Record<string, unknown>,
): void {
  db.insert(usageEvents)
    .values({
      id: nanoid(12),
      userId,
      kind,
      amount,
      meta: meta ? JSON.stringify(meta) : null,
      createdAt: new Date(),
    })
    .run();
}

// Atomic check-and-increment for a monthly metered quota.
//
// The old pattern was: call canRender()/canChat() (a SELECT), then later
// recordUsage() (an INSERT). Two concurrent requests could BOTH pass the gate
// before either wrote its usage row, so a free user could exceed the cap by
// running N renders in parallel — a real money leak (each render costs us
// cloud + Anthropic spend). This wraps the count + insert in a single
// better-sqlite3 transaction. better-sqlite3 is synchronous and serializes
// transactions, so the read used to decide cannot interleave with another
// transaction's write — the increment is safe against the race.
//
// Returns { ok } — when false, NOTHING was written and the caller must reject.
// `limit === -1` means unlimited: always ok, still records the event so usage
// dashboards stay accurate.
export function reserveUsage(
  userId: string,
  kind: UsageKind,
  limit: number,
  meta?: Record<string, unknown>,
  amount = 1,
): { ok: boolean; used: number; limit: number } {
  const since = startOfMonth();
  // drizzle (better-sqlite3) runs the callback synchronously inside a real SQL
  // transaction and returns its value directly. better-sqlite3 serializes
  // transactions, so the SELECT used to decide cannot interleave with another
  // transaction's INSERT — that's what makes the check+increment race-safe.
  return db.transaction((tx) => {
    const current =
      tx
        .select({ total: sql<number>`coalesce(sum(${usageEvents.amount}), 0)` })
        .from(usageEvents)
        .where(
          and(
            eq(usageEvents.userId, userId),
            eq(usageEvents.kind, kind),
            gte(usageEvents.createdAt, since),
          ),
        )
        .get()?.total || 0;
    if (limit !== -1 && current >= limit) {
      return { ok: false, used: current, limit };
    }
    tx.insert(usageEvents)
      .values({
        id: nanoid(12),
        userId,
        kind,
        amount,
        meta: meta ? JSON.stringify(meta) : null,
        createdAt: new Date(),
      })
      .run();
    return { ok: true, used: current + amount, limit };
  });
}

// Refund a usage unit reserved by reserveUsage when the downstream action
// could not actually proceed (e.g. enqueue threw after we reserved a render).
// Records a compensating negative event so monthly sums stay correct rather
// than deleting rows (keeps an audit trail).
export function refundUsage(
  userId: string,
  kind: UsageKind,
  amount = 1,
  meta?: Record<string, unknown>,
): void {
  db.insert(usageEvents)
    .values({
      id: nanoid(12),
      userId,
      kind,
      amount: -amount,
      meta: meta ? JSON.stringify({ ...meta, refund: true }) : JSON.stringify({ refund: true }),
      createdAt: new Date(),
    })
    .run();
}

export function getUserPlan(userId: string): Plan {
  // Admin accounts always get Studio — lets admins test the full product free.
  const userRow = db.select({ email: user.email }).from(user).where(eq(user.id, userId)).get();
  if (userRow && isAdminEmail(userRow.email)) {
    return PLANS.studio;
  }
  const sub = db.select().from(subscriptions).where(eq(subscriptions.userId, userId)).get();
  return planFor(sub?.plan);
}

// Subscription billing-health status, surfaced to the UI for the dunning
// banner. "past_due" / "unpaid" come straight from Polar's webhook (a failed
// renewal charge). We keep serving the paid plan during the grace window — we
// do NOT instantly downgrade on first failed charge, because Polar retries and
// a transient decline shouldn't strip a paying customer's access mid-month.
export type BillingHealth = {
  status: string;
  pastDue: boolean;
  plan: PlanId;
};

const PAST_DUE_STATUSES = new Set(["past_due", "unpaid"]);

export function getBillingHealth(userId: string): BillingHealth {
  const sub = db
    .select({ status: subscriptions.status, plan: subscriptions.plan })
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .get();
  const status = sub?.status ?? "active";
  return {
    status,
    pastDue: PAST_DUE_STATUSES.has(status),
    plan: (sub?.plan as PlanId) ?? "free",
  };
}

export function canRender(userId: string): {
  ok: boolean;
  used: number;
  limit: number;
  hasCredits: boolean;
} {
  const plan = getUserPlan(userId);
  const used = getUsage(userId, "render");
  const hasCredits = getRenderCredits(userId) > 0;
  if (plan.renderLimit === -1) return { ok: true, used, limit: -1, hasCredits };
  // Credits unlock renders beyond the plan limit (pay-per-render).
  if (used >= plan.renderLimit && hasCredits)
    return { ok: true, used, limit: plan.renderLimit, hasCredits };
  return { ok: used < plan.renderLimit, used, limit: plan.renderLimit, hasCredits };
}

// Symmetric to canRender — gates the chat route so a single user can't burn
// the Anthropic bill by holding the agent in a loop. Counts one per user
// message; tool calls are not counted (they're part of the same turn).
export function canChat(userId: string): {
  ok: boolean;
  used: number;
  limit: number;
} {
  const plan = getUserPlan(userId);
  const used = getUsage(userId, "chat_turn");
  if (plan.chatTurnLimit === -1) return { ok: true, used, limit: -1 };
  return { ok: used < plan.chatTurnLimit, used, limit: plan.chatTurnLimit };
}

export function hasActiveWorker(userId: string): boolean {
  const cutoff = new Date(Date.now() - WORKER_HEARTBEAT_WINDOW_MS);
  const row = db
    .select({ token: workerTokens.token })
    .from(workerTokens)
    .where(
      and(
        eq(workerTokens.userId, userId),
        isNull(workerTokens.revokedAt),
        gte(workerTokens.lastSeenAt, cutoff),
      ),
    )
    .get();
  return !!row;
}

// Lifetime sum of cloud render seconds. We don't reset on month boundaries
// because the cap is a one-time push to install the local worker.
export function getCloudRenderSecondsUsed(userId: string): number {
  const result = db
    .select({ total: sql<number>`coalesce(sum(${usageEvents.amount}), 0)` })
    .from(usageEvents)
    .where(and(eq(usageEvents.userId, userId), eq(usageEvents.kind, "cloud_render_seconds")))
    .get();
  return result?.total || 0;
}

// Maps plan resolution to the highest render quality that plan may request.
// Free (480p) → draft only; 720p/1080p → standard; 4k → high.
const RESOLUTION_MAX_QUALITY: Record<string, "draft" | "standard" | "high"> = {
  "480p": "draft",
  "720p": "standard",
  "1080p": "standard",
  "4k": "high",
};
const QUALITY_ORDER: Record<string, number> = { draft: 0, standard: 1, high: 2 };

export function capQualityForPlan(
  userId: string,
  requested: "draft" | "standard" | "high",
): "draft" | "standard" | "high" {
  const plan = getUserPlan(userId);
  const max = RESOLUTION_MAX_QUALITY[plan.resolution] ?? "standard";
  return (QUALITY_ORDER[requested] ?? 1) > (QUALITY_ORDER[max] ?? 1) ? max : requested;
}

// Monthly render-minute gate — checked before enqueuing a job.
// Complements the render-count gate: a single long render won't blow through
// the monthly allowance invisibly.
export function canRenderMinutes(userId: string): {
  ok: boolean;
  used: number;
  limit: number;
} {
  const plan = getUserPlan(userId);
  const used = getUsage(userId, "render_minutes");
  if (plan.renderMinuteLimit === -1) return { ok: true, used, limit: -1 };
  return { ok: used < plan.renderMinuteLimit, used, limit: plan.renderMinuteLimit };
}

// Checks whether the user can claim cloud render capacity right now.
// Paid plans skip the cap; free plan blocks after CLOUD_RENDER_SECONDS_CAP_FREE
// unless they have an active local worker registered.
export function canUseCloudRender(userId: string): {
  ok: boolean;
  used: number;
  limit: number;
  hasWorker: boolean;
} {
  const hasWorker = hasActiveWorker(userId);
  const plan = getUserPlan(userId);
  const used = getCloudRenderSecondsUsed(userId);
  if (plan.id !== "free") {
    return { ok: true, used, limit: -1, hasWorker };
  }
  if (hasWorker) return { ok: true, used, limit: -1, hasWorker };
  return {
    ok: used < CLOUD_RENDER_SECONDS_CAP_FREE,
    used,
    limit: CLOUD_RENDER_SECONDS_CAP_FREE,
    hasWorker,
  };
}
