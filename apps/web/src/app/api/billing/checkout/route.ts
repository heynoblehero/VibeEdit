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
  if (!plan.providerPriceEnv) return new NextResponse("plan not purchasable", { status: 400 });

  // Dev-mode shortcut: stamp the sub locally when Polar isn't configured.
  // Refused in production so a missing token can't hand out free upgrades.
  if (!isPolarConfigured()) {
    if (process.env.NODE_ENV === "production") {
      return new NextResponse("Polar is not configured — refusing to grant subscription.", {
        status: 503,
      });
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

    // Plan SWITCH (e.g. Creator → Studio) for an already-subscribed user:
    // update the existing Polar subscription in place so Polar applies
    // proration, rather than create a second parallel subscription via a new
    // checkout (which would double-bill and leave the old sub running). We only
    // do this when there's a live subscription to switch; a canceled/expired
    // one falls through to a fresh checkout.
    const existing = db.select().from(subscriptions).where(eq(subscriptions.userId, userId)).get();
    const switchableStatuses = new Set(["active", "trialing", "past_due"]);
    if (
      existing?.polarSubscriptionId &&
      existing.plan !== planId &&
      switchableStatuses.has(existing.status)
    ) {
      // SDK 0.47.x: subscriptions.update with a new productId triggers a
      // prorated plan change; the webhook (subscription.updated) reconciles our
      // DB row afterward, so we don't optimistically write the plan here.
      await polar.subscriptions.update({
        id: existing.polarSubscriptionId,
        subscriptionUpdate: { productId },
      });
      return NextResponse.json({ url: `${origin}/app/billing?status=success`, switched: true });
    }

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
    const message = (error as Error).message?.slice(0, 200) || "checkout failed";
    return new NextResponse(message, { status: 500 });
  }
}
