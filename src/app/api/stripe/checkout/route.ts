import type { NextRequest } from "next/server";
import { sessionFor, userById } from "@/lib/server/auth";
import { getStripe, priceForWorkflow, stripeEnabled } from "@/lib/server/stripe";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!stripeEnabled) {
    return Response.json(
      { error: "STRIPE_SECRET_KEY not configured on server" },
      { status: 503 },
    );
  }
  const cookie = request.cookies.get("vibeedit_session")?.value;
  const session = sessionFor(cookie);
  if (!session) return Response.json({ error: "not signed in" }, { status: 401 });
  const user = userById(session.userId);
  if (!user) return Response.json({ error: "user not found" }, { status: 404 });

  const { workflowId } = (await request.json()) as { workflowId: string };
  if (!workflowId) return Response.json({ error: "workflowId required" }, { status: 400 });
  const price = priceForWorkflow(workflowId);
  if (!price) {
    return Response.json(
      {
        error: `No Stripe price configured for "${workflowId}". Set STRIPE_PRICE_${workflowId
          .toUpperCase()
          .replace(/-/g, "_")} in .env.local.`,
      },
      { status: 503 },
    );
  }

  const origin = request.nextUrl.origin;
  const stripe = getStripe();
  const checkout = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [{ price, quantity: 1 }],
    customer_email: user.email,
    metadata: { userId: user.id, workflowId },
    success_url: `${origin}/?unlock=${workflowId}&status=success`,
    cancel_url: `${origin}/?unlock=${workflowId}&status=cancelled`,
  });

  return Response.json({ url: checkout.url, sessionId: checkout.id });
}
