// Sentry init for the Edge runtime (middleware, edge routes). Loaded by
// instrumentation.ts's register() when NEXT_RUNTIME === "edge". No-ops when
// SENTRY_DSN is unset.
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? "0"),
    enabled: true,
  });
}
