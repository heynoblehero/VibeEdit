/*
 * Credit top-up packs. One-time purchases that add credits to the user's
 * balance (stored on subscriptions.renderCredits, which carries over). Each
 * pack maps to a one-time Polar product created by scripts/setup-polar.ts; the
 * product also carries a `credits` metadata field the webhook reads to grant
 * the right amount, so this table and Polar can't silently drift.
 *
 * Priced ~3¢/credit (same ~1/3-cost margin as the plans), with a small volume
 * discount on bigger packs.
 */

export type TopupPack = {
  id: string;
  credits: number;
  priceUsd: number;
  priceLabel: string;
  productEnv: string;
  popular?: boolean;
};

export const TOPUP_PACKS: TopupPack[] = [
  {
    id: "credits_500",
    credits: 500,
    priceUsd: 19,
    priceLabel: "$19",
    productEnv: "POLAR_PRODUCT_CREDITS_500",
  },
  {
    id: "credits_1500",
    credits: 1500,
    priceUsd: 49,
    priceLabel: "$49",
    productEnv: "POLAR_PRODUCT_CREDITS_1500",
    popular: true,
  },
  {
    id: "credits_4000",
    credits: 4000,
    priceUsd: 119,
    priceLabel: "$119",
    productEnv: "POLAR_PRODUCT_CREDITS_4000",
  },
];

export function topupPackById(id: string | undefined | null): TopupPack | null {
  return TOPUP_PACKS.find((pack) => pack.id === id) ?? null;
}
