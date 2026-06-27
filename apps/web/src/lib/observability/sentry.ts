/*
 * Sentry wrapper.
 *
 * Thin facade over @sentry/nextjs so call sites keep a stable, tiny API
 * (captureException / addBreadcrumb) and don't import the SDK directly. The
 * SDK itself is initialized via the standard Next 15 instrumentation files
 * (instrumentation.ts → sentry.server.config.ts / sentry.edge.config.ts) and
 * sentry.client.config.ts on the browser. When SENTRY_DSN is unset (dev), the
 * SDK never initializes, so these calls degrade to console output and no
 * network traffic is sent.
 */

import * as Sentry from "@sentry/nextjs";

function sentryEnabled(): boolean {
  // Server reads SENTRY_DSN; the browser bundle only ever sees the public var.
  return Boolean(process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN);
}

export function captureException(error: unknown, context?: Record<string, unknown>) {
  if (!sentryEnabled()) {
    console.error("[exception]", error, context || "");
    return;
  }
  try {
    Sentry.captureException(error, context ? { extra: context } : undefined);
  } catch (sendError) {
    // Never let observability break the request path.
    console.error("[sentry] captureException failed", sendError);
    console.error("[exception]", error, context || "");
  }
}

export function addBreadcrumb(message: string, data?: Record<string, unknown>) {
  if (!sentryEnabled()) return;
  try {
    Sentry.addBreadcrumb({ message, data });
  } catch {
    /* breadcrumbs are best-effort */
  }
}
