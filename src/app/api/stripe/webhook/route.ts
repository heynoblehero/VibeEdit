import type { NextRequest } from "next/server";
import Stripe from "stripe";
import { unlockWorkflow } from "@/lib/server/auth";
import { getStripe, stripeEnabled } from "@/lib/server/stripe";

export const runtime = "nodejs";

/**
 * Stripe webhook. Point your Stripe dashboard (or `stripe listen`) at this URL
 * and set STRIPE_WEBHOOK_SECRET to the signing secret.
 */
export async function POST(request: NextRequest) {
  if (!stripeEnabled) {
    return Response.json(
      { error: "STRIPE_SECRET_KEY not configured" },
      { status: 503 },
    );
  }
  const sig = request.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!sig || !secret) {
    return Response.json(
      { error: "missing signature or STRIPE_WEBHOOK_SECRET" },
      { status: 400 },
    );
  }
  const body = await request.text();
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, sig, secret);
  } catch (e) {
    return Response.json(
      { error: `webhook signature invalid: ${e instanceof Error ? e.message : String(e)}` },
      { status: 400 },
    );
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.metadata?.userId;
    const workflowId = session.metadata?.workflowId;
    if (userId && workflowId) {
      unlockWorkflow(userId, workflowId);
    }
  }

  return Response.json({ received: true });
}
