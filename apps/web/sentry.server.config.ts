// Sentry init for the Node.js server runtime. Loaded by instrumentation.ts's
// register() when NEXT_RUNTIME === "nodejs". No-ops when SENTRY_DSN is unset.
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
