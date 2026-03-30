import { NextRequest, NextResponse } from "next/server";
import { addCredits } from "@/lib/credits";
import { CREDIT_PACKS } from "@/lib/credits/costs";
import { logSecurity } from "@/lib/ai/security-log";

export async function POST(request: NextRequest) {
	try {
		const body = await request.json();
		const eventType = body.type as string;

		// Verify webhook signature
		const signature = request.headers.get("x-polar-signature");
		const webhookSecret = process.env.POLAR_WEBHOOK_SECRET;
		if (webhookSecret && signature) {
			// TODO: verify HMAC signature in production
		}

		// Events that grant credits:
		// - checkout.completed: first payment (new subscription)
		// - order.created: recurring renewal payment
		// - subscription.active: subscription became active
		if (
			eventType === "checkout.completed" ||
			eventType === "order.created" ||
			eventType === "subscription.active"
		) {
			const metadata = body.data?.metadata || {};
			let userId = metadata.userId as string;
			let packId = metadata.packId as string;

			// For order.created (renewals), metadata might be on the subscription
			if (!userId && body.data?.subscription?.metadata) {
				userId = body.data.subscription.metadata.userId;
				packId = body.data.subscription.metadata.packId;
			}

			// For subscription events, check subscription metadata
			if (!userId && body.data?.customer?.metadata) {
				userId = body.data.customer.metadata.userId;
			}

			if (!userId || !packId) {
				logSecurity("warn", "polar_webhook_missing_metadata", {
					type: eventType,
					hasUserId: !!userId,
					hasPackId: !!packId,
				});
				return NextResponse.json({ error: "Missing metadata" }, { status: 400 });
			}

			const pack = CREDIT_PACKS.find((p) => p.id === packId);
			if (!pack) {
				logSecurity("warn", "polar_webhook_unknown_pack", { packId });
				return NextResponse.json({ error: "Unknown pack" }, { status: 400 });
			}

			const isRenewal = eventType === "order.created";
			const description = isRenewal
				? `Monthly renewal: ${pack.name} (${pack.credits} credits)`
				: `Subscribed to ${pack.name} (${pack.credits} credits/mo)`;

			addCredits(userId, pack.credits, "purchase", description);

			logSecurity("info", "credits_purchased", {
				userId,
				pack: pack.name,
				credits: pack.credits,
				event: eventType,
				isRenewal,
			});

			return NextResponse.json({ success: true, credits: pack.credits });
		}

		// Subscription cancelled — log but don't remove credits
		if (eventType === "subscription.canceled" || eventType === "subscription.revoked") {
			const metadata = body.data?.metadata || {};
			logSecurity("info", "subscription_cancelled", {
				userId: metadata.userId,
				packId: metadata.packId,
				event: eventType,
			});
			return NextResponse.json({ received: true });
		}

		return NextResponse.json({ received: true });
	} catch (error) {
		logSecurity("error", "polar_webhook_error", { error: String(error) });
		return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
	}
}
