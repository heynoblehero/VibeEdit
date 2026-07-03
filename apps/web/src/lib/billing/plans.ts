export type PlanId = "free" | "creator" | "pro" | "studio";

export type Plan = {
  id: PlanId;
  name: string;
  priceMonthly: number;
  priceLabel: string;
  // Monthly credit allowance — the ONE currency every action spends. Actions
  // (AI edit, render, image/b-roll/voiceover/music generation) cost credits;
  // see lib/billing/credits.ts for the cost table. -1 = unlimited (internal).
  creditsPerMonth: number;
  // Legacy per-action caps. Kept for compatibility with the render/chat/
  // generation gate call sites, but set to -1 (unlimited) on every plan now
  // that credits govern usage. The credit balance is the real limit.
  renderLimit: number;
  chatTurnLimit: number;
  renderMinuteLimit: number;
  resolution: "480p" | "720p" | "1080p" | "4k";
  watermark: boolean;
  // Env var name holding the Polar product/price id. checkout reads
  // process.env[plan.providerPriceEnv] to get the Polar product UUID.
  providerPriceEnv: string | null;
};

// Pricing model (2026-07): NO free plan. Three paid tiers, each a 7-day
// card-required trial, each unlocking the ENTIRE editor (4K, no watermark, all
// tools). The only difference between tiers is the monthly credit bucket.
// Credits are priced so cost-to-fulfill is ~1/3 of revenue (≈67% gross margin):
// 1 credit ≈ 1¢ of real cost, sold embedded at ~3¢. See credits.ts.
//
// The "free" entry is NOT a purchasable plan — it is the internal locked /
// no-active-subscription state (0 credits). When BILLING_ENFORCE is on, a user
// in this state is paywalled until they start a trial or subscribe.
//
// NOTE: plan ids `creator`/`studio` are retained (existing subscriptions store
// them) but re-labelled and re-priced; `pro` is the new middle tier.
export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: "free",
    name: "Locked",
    priceMonthly: 0,
    priceLabel: "$0",
    creditsPerMonth: 0,
    renderLimit: -1,
    chatTurnLimit: -1,
    renderMinuteLimit: -1,
    resolution: "480p",
    watermark: true,
    providerPriceEnv: null,
  },
  creator: {
    id: "creator",
    name: "Starter",
    priceMonthly: 39,
    priceLabel: "$39",
    creditsPerMonth: 1000, // ≈18 short videos / mo; ~$10 cost ceiling (÷3)
    renderLimit: -1,
    chatTurnLimit: -1,
    renderMinuteLimit: -1,
    resolution: "4k",
    watermark: false,
    providerPriceEnv: "POLAR_PRODUCT_CREATOR",
  },
  pro: {
    id: "pro",
    name: "Pro",
    priceMonthly: 99,
    priceLabel: "$99",
    creditsPerMonth: 3000, // ≈53 videos / mo; ~$30 cost ceiling (÷3)
    renderLimit: -1,
    chatTurnLimit: -1,
    renderMinuteLimit: -1,
    resolution: "4k",
    watermark: false,
    providerPriceEnv: "POLAR_PRODUCT_PRO",
  },
  studio: {
    id: "studio",
    name: "Studio",
    priceMonthly: 149,
    priceLabel: "$149",
    creditsPerMonth: 5000, // ≈89 videos / mo; ~$50 cost ceiling (÷3)
    renderLimit: -1,
    chatTurnLimit: -1,
    renderMinuteLimit: -1,
    resolution: "4k",
    watermark: false,
    providerPriceEnv: "POLAR_PRODUCT_STUDIO",
  },
};

// Purchasable tiers, in display order (excludes the internal "free"/locked).
export const SELLABLE_PLAN_IDS: PlanId[] = ["creator", "pro", "studio"];

export function planFor(planId: string | null | undefined): Plan {
  if (planId && planId in PLANS) return PLANS[planId as PlanId];
  return PLANS.free;
}
