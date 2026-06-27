export async function register() {
  // Initialize Sentry per-runtime. No-ops when SENTRY_DSN is unset (the config
  // files guard on the DSN themselves). The server/edge configs live at the
  // package root, one level up from src/.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
  } else if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }

  // Only run the rest in the Node.js runtime (not edge). seedAdmin hits SQLite.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { seedAdmin } = await import("./lib/seed-admin");
  await seedAdmin().catch((error) => {
    console.error("[seed-admin] failed:", error);
  });

  // Pre-launch the snapshot browser so the first agent screenshot isn't cold.
  // Best-effort: no-op if Chrome is unavailable, and self-closes after idle.
  // Disable with SNAPSHOT_WARMUP=0.
  if (process.env.SNAPSHOT_WARMUP !== "0") {
    const { warmBrowser } = await import("./lib/ai/snapshot/browser-pool");
    warmBrowser()
      .then((ok) =>
        console.log(`[snapshot] browser warm-up: ${ok ? "ready" : "skipped (no Chrome)"}`),
      )
      .catch(() => {});
  }
}

// Next 15 calls this for uncaught server errors (RSC, route handlers, etc.).
// Forwards them to Sentry; no-ops when the DSN is unset.
export { captureRequestError as onRequestError } from "@sentry/nextjs";
