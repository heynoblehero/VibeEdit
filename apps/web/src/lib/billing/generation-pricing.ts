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
import { chargeCredits, creditBalance } from "./credits";
import type { PlanId } from "./plans";
import type { ModelEntry } from "@/lib/ai/models";

const SETTINGS_KEY = "generationPricing";

export type GenerationPricing = {
  // Monthly generation-credit allowance per plan (-1 = unlimited).
  creditsByPlan: Record<PlanId, number>;
  // Credit cost per model cost-tier (1 = cheap … 3 = premium).
  costByTier: { 1: number; 2: number; 3: number };
};

// creditsByPlan is legacy (generation now spends the unified credit balance —
// see chargeGeneration below); kept in sync with plans.ts so any code still
// reading it is sane. costByTier still defines a generation's credit cost:
// tier 1 (cheap) ≈ image, tier 3 (premium) ≈ b-roll/video-gen.
export const DEFAULT_GENERATION_PRICING: GenerationPricing = {
  creditsByPlan: { free: 0, creator: 1000, pro: 3000, studio: 5000 },
  costByTier: { 1: 2, 2: 8, 3: 15 },
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
 * Charge one generation against the UNIFIED credit balance. The credit cost is
 * the model's cost-tier value (cheap image ≈ 2, premium b-roll ≈ 15). Race-safe
 * and meter-only until BILLING_ENFORCE is set. Returns { ok:false, ... } when
 * credits are exhausted so the caller surfaces a friendly upgrade message.
 * `used`/`limit` reflect the credit balance for existing UI copy.
 */
export function chargeGeneration(
  userId: string,
  model: ModelEntry,
): { ok: boolean; used: number; limit: number; cost: number } {
  const cost = generationCreditCost(model);
  const res = chargeCredits(userId, cost, `generation:${model.provider}/${model.id}`, {
    costTier: model.costTier,
  });
  return {
    ok: res.ok,
    used: res.balance.used,
    limit: res.balance.monthly,
    cost,
  };
}

export function getGenerationUsage(userId: string): { used: number; limit: number } {
  const balance = creditBalance(userId);
  return { used: balance.used, limit: balance.monthly };
}
