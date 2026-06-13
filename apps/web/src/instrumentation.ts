export async function register() {
  // Only run in the Node.js runtime (not edge). seedAdmin hits the SQLite DB.
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
