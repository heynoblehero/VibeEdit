import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { subscriptions } from "@/lib/db/schema";
import { requireServerSession } from "@/lib/server-session";
import { getOrCreateSubscription } from "@/lib/billing/usage";
import { getPolar, isPolarConfigured } from "@/lib/billing/polar";
import { PLANS, type PlanId } from "@/lib/billing/plans";
import { logError } from "@/lib/observability/logger";

export const runtime = "nodejs";

export async function POST(req: Request) {
	const session = await requireServerSession().catch((r) => r);
	if (session instanceof Response) return session;
	const userId = session.user.id;
	const body = (await req.json().catch(() => ({}))) as { plan?: PlanId };
	const planId = body.plan;
	if (!planId || !(planId in PLANS) || planId === "free")
		return new NextResponse("invalid plan", { status: 400 });
	const plan = PLANS[planId];
	if (!plan.providerPriceEnv)
		return new NextResponse("plan not purchasable", { status: 400 });

	// Dev-mode shortcut: stamp the sub locally when Polar isn't configured.
	// Refused in production so a missing token can't hand out free upgrades.
	if (!isPolarConfigured()) {
		if (process.env.NODE_ENV === "production") {
			return new NextResponse(
				"Polar is not configured — refusing to grant subscription.",
				{ status: 503 },
			);
		}
		const now = new Date();
		getOrCreateSubscription(userId);
		db.update(subscriptions)
			.set({
				plan: planId,
				status: "active",
				updatedAt: now,
				currentPeriodEnd: new Date(now.getTime() + 30 * 24 * 3600 * 1000),
			})
			.where(eq(subscriptions.userId, userId))
			.run();
		const url = new URL(req.url);
		return NextResponse.json({
			url: `${url.origin}/app/billing?dev=1`,
			devMode: true,
		});
	}

	const productId = process.env[plan.providerPriceEnv];
	if (!productId) {
		console.error("[billing] missing env", plan.providerPriceEnv);
		return new NextResponse("plan unavailable", { status: 500 });
	}

	const origin = new URL(req.url).origin;
	try {
		const polar = getPolar();
		// Polar Checkouts API: create a hosted checkout session. The success
		// URL is where the user lands after paying; the subscription gets
		// confirmed via the webhook (api/webhooks/polar) before we trust it.
		const checkout = await polar.checkouts.create({
			products: [productId],
			successUrl: `${origin}/app/billing?status=success`,
			customerEmail: session.user.email,
			customerName: session.user.name,
			metadata: { userId, plan: planId },
		});
		return NextResponse.json({ url: checkout.url });
	} catch (error) {
		logError("billing.checkout", error, { userId, plan: planId });
		const message =
			(error as Error).message?.slice(0, 200) || "checkout failed";
		return new NextResponse(message, { status: 500 });
	}
}
