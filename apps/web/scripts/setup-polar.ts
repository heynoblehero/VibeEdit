/*
 * Idempotent Polar product setup for VibeEdit's credit pricing.
 *
 * Creates (if missing) the three subscription plans — each a monthly recurring
 * product with a 7-day trial — and the one-time credit top-up packs. Products
 * carry metadata the app reads:
 *   - plans:   { plan: "creator"|"pro"|"studio", credits: <monthly> }
 *   - top-ups: { kind: "topup", credits: <granted> }
 *
 * Matching is by exact product name among non-archived products, so re-running
 * is safe — it won't create duplicates. Prints the env block to paste into
 * .env.local and to set on production (dokku config:set).
 *
 * Run:  bun run scripts/setup-polar.ts          (from apps/web)
 * Uses POLAR_ACCESS_TOKEN / POLAR_ORGANIZATION_ID / POLAR_SERVER from env.
 */

import { readFileSync } from "node:fs";
import { Polar } from "@polar-sh/sdk";

// Load .env.local without a dependency (only vars not already in env).
try {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
    }
  }
} catch {
  // .env.local is optional if the vars are already exported.
}

const accessToken = process.env.POLAR_ACCESS_TOKEN;
if (!accessToken) throw new Error("POLAR_ACCESS_TOKEN is not set");
const organizationId = process.env.POLAR_ORGANIZATION_ID || undefined;
const server = (process.env.POLAR_SERVER as "production" | "sandbox") || "production";
const polar = new Polar({ accessToken, server });

type PlanSpec = {
  envVar: string;
  name: string;
  amountUsd: number;
  metadata: Record<string, string | number>;
  recurring: boolean;
};

const SPECS: PlanSpec[] = [
  // Subscription plans (monthly, 7-day trial).
  {
    envVar: "POLAR_PRODUCT_CREATOR",
    name: "VibeEdit Starter Plan",
    amountUsd: 39,
    metadata: { plan: "creator", credits: 1000 },
    recurring: true,
  },
  {
    envVar: "POLAR_PRODUCT_PRO",
    name: "VibeEdit Pro Plan",
    amountUsd: 99,
    metadata: { plan: "pro", credits: 3000 },
    recurring: true,
  },
  {
    envVar: "POLAR_PRODUCT_STUDIO",
    name: "VibeEdit Studio Plan",
    amountUsd: 149,
    metadata: { plan: "studio", credits: 5000 },
    recurring: true,
  },
  // One-time credit top-up packs.
  {
    envVar: "POLAR_PRODUCT_CREDITS_500",
    name: "VibeEdit Credits — 500",
    amountUsd: 19,
    metadata: { kind: "topup", credits: 500 },
    recurring: false,
  },
  {
    envVar: "POLAR_PRODUCT_CREDITS_1500",
    name: "VibeEdit Credits — 1,500",
    amountUsd: 49,
    metadata: { kind: "topup", credits: 1500 },
    recurring: false,
  },
  {
    envVar: "POLAR_PRODUCT_CREDITS_4000",
    name: "VibeEdit Credits — 4,000",
    amountUsd: 119,
    metadata: { kind: "topup", credits: 4000 },
    recurring: false,
  },
];

async function listExisting(): Promise<Map<string, string>> {
  const byName = new Map<string, string>();
  const res = await polar.products.list({ organizationId, limit: 100 });
  for (const product of (
    res as { result?: { items?: Array<{ name: string; id: string; isArchived: boolean }> } }
  ).result?.items ?? []) {
    if (!product.isArchived) byName.set(product.name, product.id);
  }
  return byName;
}

async function ensureProduct(spec: PlanSpec, existing: Map<string, string>): Promise<string> {
  const found = existing.get(spec.name);
  if (found) {
    console.log(`  exists   ${spec.name} → ${found}`);
    return found;
  }
  const price = {
    amountType: "fixed" as const,
    priceAmount: spec.amountUsd * 100,
    priceCurrency: "usd",
  };
  // NOTE: organization_id must NOT be set on create when using an org token —
  // Polar infers the org from the token and rejects an explicit id.
  const body: Record<string, unknown> = {
    name: spec.name,
    metadata: spec.metadata,
    prices: [price],
  };
  if (spec.recurring) {
    body.recurringInterval = "month";
    body.trialInterval = "day";
    body.trialIntervalCount = 7;
  }
  // The SDK's ProductCreate is a discriminated union; the plain body matches
  // the recurring/one-time shape by the presence of recurringInterval.
  const created = (await polar.products.create(body as never)) as { id: string };
  console.log(`  created  ${spec.name} → ${created.id}`);
  return created.id;
}

async function main() {
  console.log(`Polar setup (${server})\n`);
  const existing = await listExisting();
  const envLines: string[] = [];
  for (const spec of SPECS) {
    const id = await ensureProduct(spec, existing);
    envLines.push(`${spec.envVar}=${id}`);
  }
  console.log("\n─── env block ───────────────────────────────");
  for (const line of envLines) console.log(line);
  console.log("─────────────────────────────────────────────");
  console.log("\nSet these in .env.local AND on production:");
  console.log("  dokku config:set vibeedit " + envLines.map((l) => l).join(" ") + " --no-restart");
}

main().catch((error) => {
  console.error("setup failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
