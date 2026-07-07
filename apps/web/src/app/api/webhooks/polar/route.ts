import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { validateEvent, WebhookVerificationError } from "@polar-sh/sdk/webhooks";
import { db } from "@/lib/db";
import { subscriptions, processedWebhooks, user } from "@/lib/db/schema";
import { notifyAdmin } from "@/lib/email/notify-admin";
import { PLANS, type PlanId } from "@/lib/billing/plans";
import { getOrCreateSubscription } from "@/lib/billing/usage";
import { logError } from "@/lib/observability/logger";
import { captureException } from "@/lib/observability/sentry";
import { captureEvent, FUNNEL } from "@/lib/observability/posthog";

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

// Polar SDK returns camelCase after validateEvent parses the payload.
type PolarSubscription = {
  id: string;
  status: string;
  customerId: string;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean | null;
  productId: string;
  metadata: Record<string, string | number | boolean>;
};

// Polar subscription statuses that mean a renewal charge failed and we're in
// the dunning grace window. We keep the paid PLAN on the row (so the user
// isn't instantly downgraded on a transient decline — Polar retries) but the
// "past_due"/"unpaid" status drives the dunning banner via getBillingHealth().
const PAST_DUE_STATUSES = new Set(["past_due", "unpaid"]);

// One-time order payload (credit top-up purchases). Polar copies the checkout
// metadata onto the order, so userId + credits ride along.
type PolarOrder = {
  id: string;
  customerId?: string;
  productId?: string;
  metadata?: Record<string, string | number | boolean>;
  product?: { metadata?: Record<string, string | number | boolean> };
};

// Grant top-up credits from a paid one-time order. Guarded to kind==="topup"
// so the initial subscription order (which also fires order.paid) is ignored.
// Returns the applied grant (for admin alerting) or null when nothing applied.
function applyTopupFromOrder(order: PolarOrder): { userId: string; credits: number } | null {
  if (order.metadata?.kind !== "topup") return null;
  const userId = order.metadata?.userId as string | undefined;
  const credits = Number(order.metadata?.credits ?? order.product?.metadata?.credits ?? 0);
  if (!userId || !Number.isFinite(credits) || credits <= 0) return null;
  getOrCreateSubscription(userId);
  const applied = Math.floor(credits);
  db.update(subscriptions)
    .set({
      renderCredits: sql`${subscriptions.renderCredits} + ${applied}`,
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.userId, userId))
    .run();
  return { userId, credits: applied };
}

async function applyFromSubscription(sub: PolarSubscription): Promise<void> {
  const userId = sub.metadata?.userId as string | undefined;
  if (!userId) return;
  const plan = planIdFromProductId(sub.productId);
  const periodEnd = sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd) : null;
  db.update(subscriptions)
    .set({
      polarCustomerId: sub.customerId,
      polarSubscriptionId: sub.id,
      plan,
      status: sub.status,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: !!sub.cancelAtPeriodEnd,
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
    captureException(error, { source: "polar.webhook.parse" });
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
      case "subscription.past_due":
      case "subscription.canceled":
      case "subscription.revoked":
      case "subscription.uncanceled": {
        await applyFromSubscription(event.data);
        // Funnel: revenue events keyed to the user when present in metadata.
        const subUserId = event.data?.metadata?.userId as string | undefined;
        const pastDue = PAST_DUE_STATUSES.has(event.data?.status);
        const funnelEvent =
          event.type === "subscription.created"
            ? FUNNEL.subscriptionCreated
            : event.type === "subscription.canceled" || event.type === "subscription.revoked"
              ? FUNNEL.subscriptionCanceled
              : FUNNEL.subscriptionUpdated;
        captureEvent(funnelEvent, subUserId, {
          polarType: event.type,
          plan: planIdFromProductId(event.data?.productId),
          status: event.data?.status,
          // Dunning signal: a failed renewal charge flips Polar's status to
          // past_due/unpaid. The DB row now carries that status; the dashboard
          // dunning banner reads it via getBillingHealth(). Flagged here so the
          // funnel can alert on involuntary churn risk.
          pastDue,
        });
        // Admin alert: a brand-new subscription is our "paid trial started"
        // signal (all tiers are card-required trials). Only fire on creation so
        // we don't spam on every renewal/update webhook.
        if (event.type === "subscription.created" && subUserId) {
          const owner = db.select().from(user).where(eq(user.id, subUserId)).get();
          void notifyAdmin({
            tag: "trial",
            subject: owner?.email || subUserId,
            title: "New paid trial started",
            rows: [
              { label: "Email", value: owner?.email || "—" },
              { label: "Plan", value: planIdFromProductId(event.data?.productId) },
              { label: "Status", value: event.data?.status || "—" },
            ],
            adminTab: "billing",
            ctaLabel: "View billing",
          });
        }
        break;
      }
      case "order.paid": {
        // Credit top-up fulfillment. event.data is an order, not a subscription.
        const topup = applyTopupFromOrder(event.data as unknown as PolarOrder);
        if (topup) {
          const owner = db.select().from(user).where(eq(user.id, topup.userId)).get();
          void notifyAdmin({
            tag: "payment",
            subject: `${topup.credits} credits · ${owner?.email || topup.userId}`,
            title: "Credit top-up purchased",
            rows: [
              { label: "Email", value: owner?.email || "—" },
              { label: "Credits", value: String(topup.credits) },
            ],
            adminTab: "billing",
            ctaLabel: "View billing",
          });
        }
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
    captureException(error, { source: "polar.webhook.apply", eventId, type: event.type });
    // Don't 5xx — that triggers Polar's retry loop. The dedup row was
    // already written; admin can replay from logs.
  }

  return NextResponse.json({ received: true });
}
