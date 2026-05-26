export async function register() {
  // Only run in the Node.js runtime (not edge). seedAdmin hits the SQLite DB.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { seedAdmin } = await import("./lib/seed-admin");
  await seedAdmin().catch((error) => {
    console.error("[seed-admin] failed:", error);
  });
}
