import { NextResponse } from "next/server";
import { requireServerSession } from "@/lib/server-session";
import { creditBalance } from "@/lib/billing/credits";
import { getPolar, isPolarConfigured } from "@/lib/billing/polar";
import { TOPUP_PACKS, topupPackById } from "@/lib/billing/topups";
import { logError } from "@/lib/observability/logger";

export const runtime = "nodejs";

// GET /api/billing/credits — current credit balance + the top-up packs on offer.
export async function GET() {
  const session = await requireServerSession().catch((r) => r);
  if (session instanceof Response) return session;
  return NextResponse.json({
    balance: creditBalance(session.user.id),
    packs: TOPUP_PACKS.map((pack) => ({
      id: pack.id,
      credits: pack.credits,
      priceLabel: pack.priceLabel,
      popular: !!pack.popular,
    })),
  });
}

// POST /api/billing/credits — start a Polar one-time checkout for a top-up pack.
// The credits are granted when the order.paid webhook fires (never optimistically).
export async function POST(req: Request) {
  const session = await requireServerSession().catch((r) => r);
  if (session instanceof Response) return session;
  const userId = session.user.id;
  const body = (await req.json().catch(() => ({}))) as { pack?: string };
  const pack = topupPackById(body.pack);
  if (!pack) return new NextResponse("invalid pack", { status: 400 });

  if (!isPolarConfigured()) {
    return NextResponse.json(
      { error: "not_configured", message: "Billing is not configured." },
      { status: 503 },
    );
  }
  const productId = process.env[pack.productEnv];
  if (!productId) {
    console.error("[billing] missing top-up env", pack.productEnv);
    return new NextResponse("pack unavailable", { status: 500 });
  }

  const origin = new URL(req.url).origin;
  try {
    const checkout = await getPolar().checkouts.create({
      products: [productId],
      successUrl: `${origin}/app/billing?status=topup_success`,
      customerEmail: session.user.email,
      customerName: session.user.name,
      // The webhook grants credits from the product metadata; userId ties the
      // order back to the account.
      metadata: { userId, kind: "topup", pack: pack.id, credits: pack.credits },
    });
    return NextResponse.json({ url: checkout.url });
  } catch (error) {
    logError("billing.topup", error, { userId, pack: pack.id });
    const message = (error as Error).message?.slice(0, 200) || "checkout failed";
    return new NextResponse(message, { status: 500 });
  }
}
