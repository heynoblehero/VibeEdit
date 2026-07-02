/*
 * Generation pricing — editable, no-deploy.
 *
 * Now that the platform pays for generation (managed keys, not BYOK), each
 * image/video/music/voice generation costs "generation credits". The monthly
 * allowance per plan and the credit cost per model cost-tier are stored in
 * platformSettings so an admin can retune prices live from the dashboard.
 *
 * The gate FAILS SOFT: if credits are exhausted the tool returns a friendly
 * upgrade message; if pricing isn't configured yet it uses the defaults below.
 */

import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { platformSettings } from "@/lib/db/schema";
import { reserveUsage, getUsage, getUserPlan } from "./usage";
import type { PlanId } from "./plans";
import type { ModelEntry } from "@/lib/ai/models";

const SETTINGS_KEY = "generationPricing";

export type GenerationPricing = {
  // Monthly generation-credit allowance per plan (-1 = unlimited).
  creditsByPlan: Record<PlanId, number>;
  // Credit cost per model cost-tier (1 = cheap … 3 = premium).
  costByTier: { 1: number; 2: number; 3: number };
};

export const DEFAULT_GENERATION_PRICING: GenerationPricing = {
  creditsByPlan: { free: 30, creator: 500, studio: -1 },
  costByTier: { 1: 1, 2: 3, 3: 8 },
};

export function getGenerationPricing(): GenerationPricing {
  try {
    const row = db
      .select({ value: platformSettings.value })
      .from(platformSettings)
      .where(eq(platformSettings.key, SETTINGS_KEY))
      .get();
    if (!row?.value) return DEFAULT_GENERATION_PRICING;
    const parsed = JSON.parse(row.value) as Partial<GenerationPricing>;
    return {
      creditsByPlan: { ...DEFAULT_GENERATION_PRICING.creditsByPlan, ...parsed.creditsByPlan },
      costByTier: { ...DEFAULT_GENERATION_PRICING.costByTier, ...parsed.costByTier },
    };
  } catch {
    return DEFAULT_GENERATION_PRICING;
  }
}

export function setGenerationPricing(pricing: GenerationPricing): void {
  db.insert(platformSettings)
    .values({ key: SETTINGS_KEY, value: JSON.stringify(pricing), updatedAt: new Date() })
    .onConflictDoUpdate({
      target: platformSettings.key,
      set: { value: JSON.stringify(pricing), updatedAt: new Date() },
    })
    .run();
}

export function generationCreditCost(model: ModelEntry): number {
  const pricing = getGenerationPricing();
  return pricing.costByTier[model.costTier] ?? model.costTier;
}

/**
 * Reserve credits for one generation. Race-safe via reserveUsage. Returns
 * { ok:false, ... } when the user is out of monthly credits — the caller should
 * surface a friendly upgrade message rather than proceed.
 */
export function chargeGeneration(
  userId: string,
  model: ModelEntry,
): { ok: boolean; used: number; limit: number; cost: number } {
  const pricing = getGenerationPricing();
  const plan = getUserPlan(userId);
  const limit = pricing.creditsByPlan[plan.id] ?? DEFAULT_GENERATION_PRICING.creditsByPlan.free;
  const cost = pricing.costByTier[model.costTier] ?? model.costTier;
  const res = reserveUsage(
    userId,
    "generation",
    limit,
    { provider: model.provider, id: model.id },
    cost,
  );
  return { ok: res.ok, used: res.used, limit: res.limit, cost };
}

export function getGenerationUsage(userId: string): { used: number; limit: number } {
  const pricing = getGenerationPricing();
  const plan = getUserPlan(userId);
  return { used: getUsage(userId, "generation"), limit: pricing.creditsByPlan[plan.id] ?? 0 };
}
