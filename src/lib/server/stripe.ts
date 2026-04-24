import Stripe from "stripe";

const key = process.env.STRIPE_SECRET_KEY;
export const stripeEnabled = Boolean(key);

let client: Stripe | null = null;
export function getStripe(): Stripe {
  if (!client) {
    if (!key) throw new Error("STRIPE_SECRET_KEY not set");
    client = new Stripe(key);
  }
  return client;
}

/**
 * Map our workflow ids → Stripe price ids. You set these env vars per workflow
 * you want to sell. Example:
 *   STRIPE_PRICE_COMMENTARY=price_1abc...
 *   STRIPE_PRICE_MOVIE_REVIEW=price_1def...
 *   STRIPE_PRICE_GAMING_HIGHLIGHTS=price_1ghi...
 */
export function priceForWorkflow(workflowId: string): string | null {
  const envKey = `STRIPE_PRICE_${workflowId.toUpperCase().replace(/-/g, "_")}`;
  const value = process.env[envKey];
  return value && value.length > 0 ? value : null;
}
