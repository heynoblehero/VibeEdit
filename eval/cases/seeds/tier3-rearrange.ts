/**
 * Tier 3 — rearrange existing scenes. Agent must call reorderScenes
 * (or equivalent) without modifying scene CONTENT. Tests that the
 * agent doesn't "improve" scene text/visuals as a side effect of a
 * rearrange request.
 *
 * 10 seeds — varied permutations.
 */

import type { TestCase } from "../../runner/case-types";
import { baseProject, BASE_SCENE_IDS } from "./_base-project";

const FORBIDDEN_TIER3 = [
  "planVideo",
  "applySceneTemplate",
  "switchWorkflow",
  "renderProject",
  "awaitRender",
  "generateImageForScene",
  "generateVideoForScene",
  "narrateAllScenes",
  "narrateScene",
  "appendEndScreen",
];

const REQUIRED_REORDER = [
  { name: "reorderScenes", minCount: 1 } as const,
];

function preserveAllScenes() {
  const base = baseProject();
  return base.scenes.flatMap((s) => [
    { sceneId: s.id, field: "text", value: s.text ?? null },
    { sceneId: s.id, field: "duration", value: s.duration },
  ]);
}

const TIER3_PROMPTS: Array<{ id: string; prompt: string; description: string }> = [
  {
    id: "swap-2-and-6",
    prompt: "Swap scene 2 and scene 6.",
    description: "Two-element swap. reorderScenes once, content unchanged.",
  },
  {
    id: "move-7-to-2",
    prompt: "Move scene 7 to position 2.",
    description: "Shift the CTA up — common 'flip the structure' ask.",
  },
  {
    id: "reverse-middle-three",
    prompt: "Reverse the middle three scenes (3, 4, 5) so they go in opposite order.",
    description: "Multi-scene reorder, exact target sequence.",
  },
  {
    id: "put-hook-last",
    prompt: "Move the hook scene (scene 1) to the very end.",
    description: "Edge case — first-to-last move.",
  },
  {
    id: "shuffle-tips",
    prompt: "Shuffle the tip scenes (3, 4, 5) — any order is fine, just mix them up.",
    description: "Non-deterministic permutation; only assert count + content unchanged.",
  },
  {
    id: "move-cta-after-hook",
    prompt: "Put the CTA right after the hook so it's the second scene.",
    description: "CTA-front pattern (TikTok hook+CTA double-tap).",
  },
  {
    id: "split-around-reveal",
    prompt: "Move scene 6 (the reveal) to be the first scene. Then push scene 1 to right after it.",
    description: "Two-step rearrange spelled out.",
  },
  {
    id: "reverse-everything",
    prompt: "Play the whole thing in reverse — scene 7 first, then 6, then 5, all the way to 1.",
    description: "Full reverse — 6 swaps minimum.",
  },
  {
    id: "ascending-by-duration",
    prompt: "Reorder scenes from shortest to longest.",
    description: "Sort by a derived field — agent must inspect durations.",
  },
  {
    id: "tip3-before-tip1",
    prompt: "Tip 3 should hit before tip 1. Same with tip 2 — reorder so it's tip 3 → tip 2 → tip 1.",
    description: "Reverse just the tip block, keep hook + reveal + cta in place.",
  },
];

export const cases: TestCase[] = TIER3_PROMPTS.map((t) => ({
  id: `tier3-${t.id}`,
  tier: 3,
  category: "rearrange",
  description: `Tier 3 · ${t.description}`,
  initialProject: baseProject(),
  recentManualEdits: [],
  focusedSceneId: null,
  userMessage: t.prompt,
  assertions: {
    toolTrace: {
      mustCall: [...REQUIRED_REORDER],
      mustNotCall: [...FORBIDDEN_TIER3],
      maxTotalCalls: 8,
    },
    finalSceneCount: { min: 7, max: 7 },
    manualEditsPreserved: preserveAllScenes(),
  },
}));

export default cases;
