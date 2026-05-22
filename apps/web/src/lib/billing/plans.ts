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

// Real monthly caps so a single user can't burn the Anthropic bill, with
// watermark/resolution as the visible "upgrade" trigger. Numbers tuned for
// faceless-YT economics: ~1 video/day means Creator covers ~3× daily output,
// Studio covers a small channel team.
export const PLANS: Record<PlanId, Plan> = {
	free: {
		id: "free",
		name: "Free",
		priceMonthly: 0,
		priceLabel: "$0",
		renderLimit: 5, // 5 MP4s / month — enough to evaluate
		chatTurnLimit: 50, // 50 chat turns / month
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
		renderLimit: 100,
		chatTurnLimit: 1000,
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
		renderLimit: 300,
		chatTurnLimit: 5000,
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
