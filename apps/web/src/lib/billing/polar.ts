import { Polar } from "@polar-sh/sdk";

/*
 * Polar.sh client singleton.
 *
 * We replaced Stripe with Polar — same checkout-link flow, but Polar's
 * subscription metadata + Customer Portal is built in. Token comes from
 * POLAR_ACCESS_TOKEN (organization access token, NOT a personal one).
 */

let client: Polar | null = null;

export function getPolar(): Polar {
	if (client) return client;
	const accessToken = process.env.POLAR_ACCESS_TOKEN;
	if (!accessToken)
		throw new Error("POLAR_ACCESS_TOKEN is not set in the environment");
	client = new Polar({
		accessToken,
		// Default to production. The user issued a polar_oat_ live token; the
		// sandbox needs a separate polar_oat_sandbox_ token. POLAR_SERVER lets
		// you flip to sandbox for testing without rotating creds.
		server:
			(process.env.POLAR_SERVER as "production" | "sandbox") || "production",
	});
	return client;
}

export function isPolarConfigured(): boolean {
	return !!process.env.POLAR_ACCESS_TOKEN;
}

export function getPolarProductId(planId: string): string | null {
	if (planId === "creator") return process.env.POLAR_PRODUCT_CREATOR || null;
	if (planId === "studio") return process.env.POLAR_PRODUCT_STUDIO || null;
	return null;
}
