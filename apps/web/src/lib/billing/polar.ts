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
  if (!accessToken) throw new Error("POLAR_ACCESS_TOKEN is not set in the environment");
  client = new Polar({
    accessToken,
    // Default to production. The user issued a polar_oat_ live token; the
    // sandbox needs a separate polar_oat_sandbox_ token. POLAR_SERVER lets
    // you flip to sandbox for testing without rotating creds.
    server: (process.env.POLAR_SERVER as "production" | "sandbox") || "production",
  });
  return client;
}

export function isPolarConfigured(): boolean {
  return !!process.env.POLAR_ACCESS_TOKEN;
}

export function getPolarProductId(planId: string): string | null {
  if (planId === "creator") return process.env.POLAR_PRODUCT_CREATOR || null;
  if (planId === "pro") return process.env.POLAR_PRODUCT_PRO || null;
  if (planId === "studio") return process.env.POLAR_PRODUCT_STUDIO || null;
  return null;
}

/*
 * Cancel (revoke) a user's active Polar subscription immediately. Used by the
 * admin account-removal flow before the DB row is deleted. Safe to call when
 * Polar isn't configured or the user has no subscription — returns a result
 * object instead of throwing so the caller can record it in the audit trail.
 */
export async function cancelPolarSubscription(
  polarSubscriptionId: string | null | undefined,
): Promise<{ ok: boolean; skipped?: string; error?: string }> {
  if (!polarSubscriptionId) return { ok: true, skipped: "no subscription id" };
  if (!isPolarConfigured()) return { ok: true, skipped: "polar not configured" };
  try {
    // SDK 0.47.x: subscriptions.revoke({ id }) cancels the subscription now and
    // revokes the customer's benefits (vs. update({ cancelAtPeriodEnd }) which
    // only schedules cancellation at period end).
    await getPolar().subscriptions.revoke({ id: polarSubscriptionId });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export type RefundResult = {
  ok: boolean;
  skipped?: string;
  error?: string;
  orderId?: string;
  amount?: number; // cents actually refunded
};

/*
 * Refund a user's most recent Polar order in full.
 *
 * Implementation (Polar SDK @polar-sh/sdk 0.47.1):
 *   1. orders.list({ customerId, sorting: ["-created_at"], limit: 1 }) →
 *      newest order. The list response paginates; we read the first page's
 *      `result.items[0]`.
 *   2. refunds.create({ orderId, reason, amount }) where `amount` is in CENTS
 *      and we refund the still-refundable balance (totalAmount - refundedAmount)
 *      so a repeat call is a no-op rather than an over-refund. `reason` defaults
 *      to "customer_request" (a valid RefundReason enum member).
 *
 * Requires the org access token to carry the `refunds:write` scope.
 */
export async function refundLatestOrder(
  polarCustomerId: string | null | undefined,
  opts?: { reason?: string; comment?: string },
): Promise<RefundResult> {
  if (!isPolarConfigured()) return { ok: false, skipped: "polar not configured" };
  if (!polarCustomerId) return { ok: false, skipped: "no polar customer id" };
  try {
    const polar = getPolar();
    const page = await polar.orders.list({
      customerId: polarCustomerId,
      sorting: ["-created_at"],
      limit: 1,
    });
    const order = page.result?.items?.[0];
    if (!order) return { ok: false, skipped: "no orders found for customer" };

    const refundable = Math.max(0, (order.totalAmount ?? 0) - (order.refundedAmount ?? 0));
    if (refundable <= 0) {
      return { ok: false, skipped: "order already fully refunded", orderId: order.id };
    }

    await polar.refunds.create({
      orderId: order.id,
      // RefundReason enum; "customer_request" is the standard admin-initiated case.
      reason: (opts?.reason as never) ?? "customer_request",
      amount: refundable,
      comment: opts?.comment ?? null,
    });

    return { ok: true, orderId: order.id, amount: refundable };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
