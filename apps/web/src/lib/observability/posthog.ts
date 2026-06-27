/*
 * PostHog server-side capture helper.
 *
 * Server code (route handlers, the agent loop, webhooks) calls captureEvent()
 * to record funnel events. It no-ops when NEXT_PUBLIC_POSTHOG_KEY is unset, so
 * dev / self-hosted-without-analytics environments send nothing.
 *
 * We reuse the public key on the server intentionally — PostHog ingestion uses
 * the same project API key for client and server capture. A single PostHog
 * client is memoized on globalThis so we don't open a new connection per call
 * (and so Next's HMR doesn't leak clients in dev).
 */

import { PostHog } from "posthog-node";

const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";

// Canonical funnel event names. Use these constants at call sites so the funnel
// stays consistent and typo-free across routes.
export const FUNNEL = {
  signup: "signup",
  projectCreated: "project_created",
  firstMessageSent: "first_message_sent",
  messageSent: "message_sent",
  planApproved: "plan_approved",
  renderStarted: "render_started",
  subscriptionCreated: "subscription_created",
  subscriptionUpdated: "subscription_updated",
  subscriptionCanceled: "subscription_canceled",
} as const;

type GlobalWithPosthog = typeof globalThis & { __vibeedit_posthog?: PostHog | null };

function client(): PostHog | null {
  if (!KEY) return null;
  const g = globalThis as GlobalWithPosthog;
  if (g.__vibeedit_posthog !== undefined) return g.__vibeedit_posthog;
  try {
    // flushAt:1 / flushInterval:0 → send each event promptly; serverless-safe.
    g.__vibeedit_posthog = new PostHog(KEY, { host: HOST, flushAt: 1, flushInterval: 0 });
  } catch (error) {
    console.error("[posthog] init failed", error);
    g.__vibeedit_posthog = null;
  }
  return g.__vibeedit_posthog;
}

/**
 * Record a server-side analytics event. `distinctId` should be the user id when
 * known (falls back to "anonymous"). Best-effort — never throws.
 */
export function captureEvent(
  event: string,
  distinctId: string | undefined,
  properties?: Record<string, unknown>,
): void {
  const ph = client();
  if (!ph) return;
  try {
    ph.capture({
      distinctId: distinctId || "anonymous",
      event,
      properties,
    });
  } catch (error) {
    console.error("[posthog] capture failed", error);
  }
}

/** Flush pending events. Call before a short-lived process exits if needed. */
export async function flushEvents(): Promise<void> {
  const ph = client();
  if (!ph) return;
  try {
    await ph.flush();
  } catch {
    /* best-effort */
  }
}
