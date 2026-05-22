import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { validateEvent, WebhookVerificationError } from "@polar-sh/sdk/webhooks";
import { db } from "@/lib/db";
import { subscriptions, processedWebhooks } from "@/lib/db/schema";
import { PLANS, type PlanId } from "@/lib/billing/plans";
import { logError } from "@/lib/observability/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/*
 * Polar.sh webhook receiver.
 *
 * Configure at https://polar.sh/dashboard/<org>/settings/webhooks pointing to
 * https://vibevideoedit.com/api/webhooks/polar. Set POLAR_WEBHOOK_SECRET to the
 * value Polar shows when you create the endpoint.
 *
 * Idempotency: every event.id we successfully insert into processedWebhooks
 * locks it out from being re-applied if Polar retries.
 */

function planIdFromProductId(productId: string | undefined): PlanId {
	if (!productId) return "creator";
	for (const id of Object.keys(PLANS) as PlanId[]) {
		const envName = PLANS[id].providerPriceEnv;
		if (envName && process.env[envName] === productId) return id;
	}
	return "creator";
}

type PolarSubscription = {
	id: string;
	status: string;
	customer_id: string;
	current_period_end: string | null;
	cancel_at_period_end: boolean | null;
	product_id: string;
	metadata?: Record<string, string>;
};

async function applyFromSubscription(
	sub: PolarSubscription,
): Promise<void> {
	const userId = sub.metadata?.userId;
	if (!userId) return;
	const plan = planIdFromProductId(sub.product_id);
	const periodEnd = sub.current_period_end
		? new Date(sub.current_period_end)
		: null;
	db.update(subscriptions)
		.set({
			polarCustomerId: sub.customer_id,
			polarSubscriptionId: sub.id,
			plan,
			status: sub.status,
			currentPeriodEnd: periodEnd,
			cancelAtPeriodEnd: !!sub.cancel_at_period_end,
			updatedAt: new Date(),
		})
		.where(eq(subscriptions.userId, userId))
		.run();
}

export async function POST(req: Request) {
	const secret = process.env.POLAR_WEBHOOK_SECRET;
	if (!secret) {
		return new NextResponse("POLAR_WEBHOOK_SECRET not configured", {
			status: 500,
		});
	}
	const rawBody = await req.text();
	const headers: Record<string, string> = {};
	req.headers.forEach((value, key) => {
		headers[key] = value;
	});

	let event: { type: string; data: PolarSubscription; id?: string };
	try {
		// SDK helper validates the Polar-Webhook-* signature headers and parses
		// the body. Throws WebhookVerificationError on tampered/invalid payloads.
		event = validateEvent(rawBody, headers, secret) as unknown as {
			type: string;
			data: PolarSubscription;
			id?: string;
		};
	} catch (error) {
		if (error instanceof WebhookVerificationError) {
			return new NextResponse("bad signature", { status: 400 });
		}
		logError("polar.webhook.parse", error);
		return new NextResponse("invalid payload", { status: 400 });
	}

	// Idempotency: pre-insert the event id. Duplicate retries throw on the
	// primary-key collision; we treat that as a successful no-op.
	const eventId = event.id || `${event.type}:${event.data?.id || "unknown"}`;
	try {
		db.insert(processedWebhooks)
			.values({
				eventId,
				source: "polar",
				createdAt: new Date(),
			})
			.run();
	} catch {
		return NextResponse.json({ received: true, deduplicated: true });
	}

	try {
		switch (event.type) {
			case "subscription.created":
			case "subscription.active":
			case "subscription.updated":
			case "subscription.canceled":
			case "subscription.revoked":
			case "subscription.uncanceled": {
				await applyFromSubscription(event.data);
				break;
			}
			default:
				// Unhandled event type — still ack so Polar stops retrying.
				break;
		}
	} catch (error) {
		logError("polar.webhook.apply", error, {
			eventId,
			type: event.type,
		});
		// Don't 5xx — that triggers Polar's retry loop. The dedup row was
		// already written; admin can replay from logs.
	}

	return NextResponse.json({ received: true });
}
