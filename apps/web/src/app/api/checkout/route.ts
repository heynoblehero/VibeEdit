import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { headers } from "next/headers";
import { polar } from "@/lib/payments/polar";
import { CREDIT_PACKS } from "@/lib/credits/costs";

/**
 * Maps credit pack IDs to Polar product IDs.
 * Set these in your Polar dashboard and update here.
 */
const POLAR_PRODUCT_IDS: Record<string, string> = {
	starter: process.env.POLAR_PRODUCT_STARTER || "starter",
	pro: process.env.POLAR_PRODUCT_PRO || "pro",
	studio: process.env.POLAR_PRODUCT_STUDIO || "studio",
};

export async function POST(request: NextRequest) {
	try {
		const session = await auth.api.getSession({ headers: await headers() });
		if (!session?.user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const { packId } = await request.json();
		const pack = CREDIT_PACKS.find((p) => p.id === packId);
		if (!pack) {
			return NextResponse.json({ error: "Invalid pack" }, { status: 400 });
		}

		const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
		const polarProductId = POLAR_PRODUCT_IDS[packId];

		// If Polar is configured, create a real checkout session
		if (process.env.POLAR_ACCESS_TOKEN && polarProductId !== packId) {
			const checkout = await polar.checkouts.create({
				products: [polarProductId],
				successUrl: `${siteUrl}/dashboard?purchased=${packId}`,
				metadata: {
					userId: session.user.id,
					packId: pack.id,
				},
			});

			return NextResponse.json({ url: checkout.url });
		}

		// Dev fallback: directly add credits when Polar isn't configured
		if (process.env.NODE_ENV === "development") {
			const { addCredits } = await import("@/lib/credits");
			addCredits(
				session.user.id,
				pack.credits,
				"purchase",
				`[DEV] ${pack.name} pack (${pack.credits} credits)`,
			);
			return NextResponse.json({
				url: `${siteUrl}/dashboard?purchased=${packId}`,
				dev: true,
			});
		}

		return NextResponse.json(
			{ error: "Payment provider not configured" },
			{ status: 503 },
		);
	} catch (error) {
		console.error("Checkout error:", error);
		return NextResponse.json(
			{ error: "Failed to create checkout session" },
			{ status: 500 },
		);
	}
}
