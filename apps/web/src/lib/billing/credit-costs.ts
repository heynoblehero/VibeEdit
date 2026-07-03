/*
 * Credit cost table — pure data, safe to import from client components.
 *
 * The server-side charging logic (credits.ts) and the admin-tunable overrides
 * layer on top of these defaults; UI surfaces (per-action cost labels, pricing
 * page, the agent's estimates) read the same numbers so nothing drifts.
 */

export type CreditAction =
  | "edit" // one AI edit request (a user message that does work)
  | "render_30s" // final render, per 30s of output (drafts are free)
  | "image" // one AI image generation
  | "broll" // one AI b-roll / video-gen clip
  | "voiceover_30s" // AI voiceover, per 30s
  | "music"; // one AI music track

export type CreditCosts = Record<CreditAction, number>;

// Calibrated to ~1¢ real cost per credit (sold embedded at ~3¢ → ~67% margin).
export const DEFAULT_CREDIT_COSTS: CreditCosts = {
  edit: 20,
  render_30s: 10,
  image: 2,
  broll: 15,
  voiceover_30s: 5,
  music: 8,
};

// Vibe Max (Opus brain) is a pricier model to run, so an edit on Vibe Max costs
// this multiple of the base edit cost. Vibe (Sonnet) edits are 1×.
export const VIBE_MAX_EDIT_MULTIPLIER = 2;

// Edit cost for a brain tier: base × multiplier on Vibe Max.
export function editCreditCost(
  tier: "vibe" | "vibe-max",
  costs: CreditCosts = DEFAULT_CREDIT_COSTS,
): number {
  const base = costs.edit ?? DEFAULT_CREDIT_COSTS.edit;
  return tier === "vibe-max" ? base * VIBE_MAX_EDIT_MULTIPLIER : base;
}

// Short human label for an action's cost, e.g. "20 cr" or "10 cr / 30s".
export function creditCostLabel(
  action: CreditAction,
  costs: CreditCosts = DEFAULT_CREDIT_COSTS,
): string {
  const value = costs[action] ?? DEFAULT_CREDIT_COSTS[action];
  const perUnit = action === "render_30s" || action === "voiceover_30s";
  return perUnit ? `${value} cr / 30s` : `${value} cr`;
}
