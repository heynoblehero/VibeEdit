import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { subscriptions, processedWebhooks } from "@/lib/db/schema";
import { getStripe, isStripeConfigured } from "@/lib/billing/stripe";
import { PLANS, type PlanId } from "@/lib/billing/plans";
import { logError } from "@/lib/observability/logger";
import type Stripe from "stripe";

// Map back from Stripe price id → our plan id. The webhook can't trust the
// `plan` metadata field — it's user-mutable in the Stripe dashboard, so an
// attacker (or operator mistake) could attach `plan=studio` metadata to a
// `creator` price and trick us into unlocking the higher tier.
function planFromPriceId(priceId: string | undefined): PlanId {
  if (!priceId) return "creator";
  for (const id of Object.keys(PLANS) as PlanId[]) {
    const envName = PLANS[id].stripePriceEnv;
    if (envName && process.env[envName] === priceId) return id;
  }
  return "creator";
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!isStripeConfigured()) return new NextResponse("stripe not configured", { status: 503 });
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return new NextResponse("STRIPE_WEBHOOK_SECRET missing", { status: 500 });

  const sig = req.headers.get("stripe-signature");
  if (!sig) return new NextResponse("no signature", { status: 400 });
  const raw = await req.text();
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(raw, sig, secret);
  } catch (error) {
    return new NextResponse(`bad signature: ${(error as Error).message}`, { status: 400 });
  }

  // Idempotency: Stripe retries on 5xx and network blips. The primary key
  // on processedWebhooks.eventId makes a duplicate insert throw — we treat
  // that as a no-op and return 200 so Stripe stops retrying.
  try {
    db.insert(processedWebhooks)
      .values({
        eventId: event.id,
        source: "stripe",
        createdAt: new Date(),
      })
      .run();
  } catch {
    // Already processed.
    return NextResponse.json({ received: true, deduplicated: true });
  }

  const updateFromSubscription = async (sub: Stripe.Subscription) => {
    const userId = (sub.metadata?.userId || "") as string;
    // Derive plan from the actual Stripe price id, not user-mutable metadata.
    const priceId =
      typeof sub.items?.data?.[0]?.price?.id === "string" ? sub.items.data[0].price.id : undefined;
    const plan = planFromPriceId(priceId);
    if (!userId) return;
    const now = new Date();
    const periodEndUnix =
      (sub as unknown as { current_period_end?: number }).current_period_end ||
      sub.items?.data?.[0]?.current_period_end ||
      null;
    const periodEnd = periodEndUnix ? new Date(periodEndUnix * 1000) : null;
    const trialEnd = sub.trial_end ? new Date(sub.trial_end * 1000) : null;
    db.update(subscriptions)
      .set({
        stripeCustomerId: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
        stripeSubscriptionId: sub.id,
        plan,
        status: sub.status,
        currentPeriodEnd: periodEnd,
        trialEndsAt: trialEnd,
        cancelAtPeriodEnd: sub.cancel_at_period_end,
        updatedAt: now,
      })
      .where(eq(subscriptions.userId, userId))
      .run();
  };

  try {
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        await updateFromSubscription(event.data.object as Stripe.Subscription);
        break;
      }
      default:
        break;
    }
  } catch (error) {
    logError("stripe.webhook", error, { eventId: event.id, type: event.type });
    // Don't return 500 — that triggers infinite Stripe retries. The dedup
    // row is already written, so if we crash here we lose this one event.
    // The error is in the log; an admin can replay.
  }
  return NextResponse.json({ received: true });
}
