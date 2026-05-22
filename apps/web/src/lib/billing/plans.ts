export type PlanId = "free" | "creator" | "studio";

export type Plan = {
	id: PlanId;
	name: string;
	priceMonthly: number;
	priceLabel: string;
	renderLimit: number; // renders/month included; -1 = unlimited
	chatTurnLimit: number; // chat turns/month included; -1 = unlimited
	resolution: "720p" | "1080p" | "4k";
	watermark: boolean;
	// Env var name holding the provider's product/price id. Renamed from
	// stripePriceEnv now that we use Polar.sh — checkout reads
	// process.env[plan.providerPriceEnv] to get the Polar product UUID.
	providerPriceEnv: string | null;
	stripePriceEnv: string | null; // kept for any unmigrated callers; will remove
};

// Free is generous (unlimited count + chat) but has a visible watermark and
// caps resolution at 720p — enough friction to push working creators to pay,
// not so much that the product feels crippled in evaluation.
export const PLANS: Record<PlanId, Plan> = {
	free: {
		id: "free",
		name: "Free",
		priceMonthly: 0,
		priceLabel: "$0",
		renderLimit: -1,
		chatTurnLimit: -1,
		resolution: "720p",
		watermark: true,
		providerPriceEnv: null,
		stripePriceEnv: null,
	},
	creator: {
		id: "creator",
		name: "Creator",
		priceMonthly: 19,
		priceLabel: "$19",
		renderLimit: -1,
		chatTurnLimit: -1,
		resolution: "1080p",
		watermark: false,
		providerPriceEnv: "POLAR_PRODUCT_CREATOR",
		stripePriceEnv: "STRIPE_PRICE_CREATOR",
	},
	studio: {
		id: "studio",
		name: "Studio",
		priceMonthly: 49,
		priceLabel: "$49",
		renderLimit: -1,
		chatTurnLimit: -1,
		resolution: "4k",
		watermark: false,
		providerPriceEnv: "POLAR_PRODUCT_STUDIO",
		stripePriceEnv: "STRIPE_PRICE_STUDIO",
	},
};

export function planFor(planId: string | null | undefined): Plan {
	if (planId && planId in PLANS) return PLANS[planId as PlanId];
	return PLANS.free;
}
