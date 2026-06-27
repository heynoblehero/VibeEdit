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

// Required by Sentry for client-side navigation instrumentation.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
