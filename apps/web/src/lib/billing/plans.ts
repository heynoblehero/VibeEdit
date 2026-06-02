export type PlanId = "free" | "creator" | "studio";

export type Plan = {
  id: PlanId;
  name: string;
  priceMonthly: number;
  priceLabel: string;
  renderLimit: number; // renders/month included; -1 = unlimited
  chatTurnLimit: number; // chat turns/month included; -1 = unlimited
  // Render minutes/month. Tracks wall-clock render time, not just count.
  // Closer to actual infrastructure cost than render count alone.
  renderMinuteLimit: number; // -1 = unlimited
  resolution: "480p" | "720p" | "1080p" | "4k";
  watermark: boolean;
  // Env var name holding the provider's product/price id. Renamed from
  // stripePriceEnv now that we use Polar.sh — checkout reads
  // process.env[plan.providerPriceEnv] to get the Polar product UUID.
  providerPriceEnv: string | null;
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
    // 10 renders/month at 480p — enough to make a real first video before the paywall.
    // Chat is unlimited so users can iterate freely; the paywall is at HD export quality.
    renderLimit: 10,
    chatTurnLimit: -1,
    renderMinuteLimit: 30, // 30 render-minutes / month (≈ 10 × 3-min drafts)
    resolution: "480p",
    watermark: true,
    providerPriceEnv: null,
  },
  creator: {
    id: "creator",
    name: "Creator",
    priceMonthly: 19,
    priceLabel: "$19",
    renderLimit: 100,
    chatTurnLimit: 1000,
    renderMinuteLimit: 600, // 10 hours / month
    resolution: "1080p",
    watermark: false,
    providerPriceEnv: "POLAR_PRODUCT_CREATOR",
  },
  studio: {
    id: "studio",
    name: "Studio",
    priceMonthly: 49,
    priceLabel: "$49",
    renderLimit: -1,
    chatTurnLimit: -1,
    renderMinuteLimit: -1,
    resolution: "4k",
    watermark: false,
    providerPriceEnv: "POLAR_PRODUCT_STUDIO",
  },
};

export function planFor(planId: string | null | undefined): Plan {
  if (planId && planId in PLANS) return PLANS[planId as PlanId];
  return PLANS.free;
}
