import { and, eq, gte, isNull, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "../db";
import { subscriptions, usageEvents, workerTokens } from "../db/schema";
import { planFor, type Plan } from "./plans";

export type UsageKind = "render" | "chat_turn" | "cloud_render_seconds";

// Free-tier cap on render time consumed by our cloud (i.e. by users who have
// not installed the local worker). Once exhausted, we hard-block and tell
// them to install the worker. Lifetime cap, not monthly.
export const CLOUD_RENDER_SECONDS_CAP_FREE = 30;
const WORKER_HEARTBEAT_WINDOW_MS = 5 * 60 * 1000;

export function getOrCreateSubscription(userId: string) {
	const existing = db
		.select()
		.from(subscriptions)
		.where(eq(subscriptions.userId, userId))
		.get();
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
		trialEndsAt: null,
		currentPeriodEnd: null,
		cancelAtPeriodEnd: false,
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

export function getUserPlan(userId: string): Plan {
	const sub = db
		.select()
		.from(subscriptions)
		.where(eq(subscriptions.userId, userId))
		.get();
	return planFor(sub?.plan);
}

export function canRender(userId: string): {
	ok: boolean;
	used: number;
	limit: number;
} {
	const plan = getUserPlan(userId);
	const used = getUsage(userId, "render");
	if (plan.renderLimit === -1) return { ok: true, used, limit: -1 };
	return { ok: used < plan.renderLimit, used, limit: plan.renderLimit };
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
		.where(
			and(
				eq(usageEvents.userId, userId),
				eq(usageEvents.kind, "cloud_render_seconds"),
			),
		)
		.get();
	return result?.total || 0;
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
