import { NextResponse } from "next/server";
import { requireServerSession } from "@/lib/server-session";
import { getRenderCredits } from "@/lib/billing/usage";

// Price per render credit in cents. $2 per render.
const CREDIT_PRICE_CENTS = 200;
const CREDITS_PER_PACK = 5;

export async function GET() {
  const session = await requireServerSession().catch((r) => r);
  if (session instanceof Response) return session;
  const credits = getRenderCredits(session.user.id);
  return NextResponse.json({
    credits,
    pricePerCredit: CREDIT_PRICE_CENTS / 100,
    packSize: CREDITS_PER_PACK,
    packPrice: (CREDIT_PRICE_CENTS * CREDITS_PER_PACK) / 100,
  });
}

// POST /api/billing/credits — initiate a Polar one-time checkout for a credit pack.
// For now returns a stub; wire up Polar one-time products when POLAR_PRODUCT_CREDITS is set.
export async function POST() {
  const session = await requireServerSession().catch((r) => r);
  if (session instanceof Response) return session;
  const productId = process.env.POLAR_PRODUCT_CREDITS;
  if (!productId) {
    return NextResponse.json(
      {
        error: "credits_not_configured",
        message:
          "Pay-per-render credits are not yet enabled. Set POLAR_PRODUCT_CREDITS env var to activate.",
      },
      { status: 503 },
    );
  }
  // TODO: Create a Polar one-time checkout session and redirect user to it.
  // On webhook: increment subscriptions.renderCredits by CREDITS_PER_PACK.
  return NextResponse.json({
    error: "not_implemented",
    message: "Credits checkout coming soon.",
  });
}
