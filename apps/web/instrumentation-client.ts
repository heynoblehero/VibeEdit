// Sentry init for the browser. Next 15 loads this automatically (the modern
// replacement for sentry.client.config.ts). Gated on the public DSN so it
// no-ops in dev / when unset. Only NEXT_PUBLIC_* vars are visible client-side.
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    tracesSampleRate: Number(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? "0"),
    enabled: true,
  });
}

// Note: `onRouterTransitionStart` (Sentry's explicit nav hook) is a v9 / Next
// 15.3+ API and is NOT exported by the @sentry/nextjs v8 we run — exporting it
// caused an "Attempted import error" at build. v8 already instruments client
// navigation via its default browser-tracing integration, so no export is
// needed. Re-add this when upgrading to @sentry/nextjs v9.
