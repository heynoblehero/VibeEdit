/**
 * Tier 6 — manual-edit awareness. Pre-injects a `recentManualEdits`
 * log entry simulating "the user just typed scn-3.text by hand."
 * Then sends a vague prompt ("make it punchier", "tighten the
 * pacing") and asserts the manually-edited field stays exactly as
 * the user left it.
 *
 * Directly tests the system block at /api/agent/route.ts:666-685
 * that we shipped this morning. 20 seeds across 4 prompt families.
 */

import type { TestCase } from "../../runner/case-types";
import type { ManualEditLogEntry } from "../../runner/agent-client";
import { baseProject, BASE_SCENE_IDS } from "./_base-project";

const FORBIDDEN_TIER6 = [
  "planVideo",
  "applySceneTemplate",
  "switchWorkflow",
  "renderProject",
  "awaitRender",
  "generateScenesFromScript",
];

interface PreserveSeed {
  id: string;
  /** Scene index (0-based) where the user "manually edited". */
  targetIdx: number;
  /** What the user changed. */
  field: "text" | "emphasisText" | "duration";
  /** Their value — the agent must preserve this exactly. */
  newValue: string | number;
  /** The vague prompt that should NOT cause the agent to overwrite. */
  prompt: string;
  description: string;
}

const T = (s: string): string => s;

const SEEDS: PreserveSeed[] = [
  // ── "Make it punchier" family (5) ────────────────────────────
  {
    id: "punchier-preserves-scn3-text",
    targetIdx: 2,
    field: "text",
    newValue: T("Don't waste another second on slow cuts"),
    prompt: "Make the whole video punchier — tighten the energy across the board.",
    description: "User hand-edited scn-3 text; agent must NOT overwrite it during a punchier-pass.",
  },
  {
    id: "punchier-preserves-scn5-text",
    targetIdx: 4,
    field: "text",
    newValue: T("Hit that swoosh harder than your competition"),
    prompt: "Make it more punchy — every scene should hit harder.",
    description: "Manual edit on scn-5; preserve.",
  },
  {
    id: "punchier-preserves-scn1-emphasisText",
    targetIdx: 0,
    field: "emphasisText",
    newValue: T("WASTE TIME"),
    prompt: "Make all the emphasis words louder, all-caps, more aggressive.",
    description: "User customized scn-1 emphasis; preserve verbatim.",
  },
  {
    id: "punchier-preserves-scn7-text",
    targetIdx: 6,
    field: "text",
    newValue: T("Smash the subscribe button — see you Friday"),
    prompt: "Make the CTA feel more urgent without changing the substance of the rest.",
    description: "CTA text was hand-tuned; preserve.",
  },
  {
    id: "punchier-preserves-scn4-emphasisText",
    targetIdx: 3,
    field: "emphasisText",
    newValue: T("STACK"),
    prompt: "Punch up the energy — every scene needs more impact.",
    description: "Manual emphasis on scn-4 stays.",
  },

  // ── "Tighten pacing" family (5) ──────────────────────────────
  {
    id: "tighten-preserves-scn2-duration",
    targetIdx: 1,
    field: "duration",
    newValue: 2.0,
    prompt: "Tighten the pacing — overall it's still slow.",
    description: "User dialed scn-2 to 2.0s; agent must not auto-rebalance it.",
  },
  {
    id: "tighten-preserves-scn3-duration",
    targetIdx: 2,
    field: "duration",
    newValue: 4.5,
    prompt: "Make the pacing snappier across the video.",
    description: "scn-3 was deliberately stretched; preserve.",
  },
  {
    id: "tighten-preserves-scn1-text",
    targetIdx: 0,
    field: "text",
    newValue: T("80 percent of editors waste 80 percent of their time"),
    prompt: "Tighten everything — shorter, faster, more impact.",
    description: "Hook text was rewritten; preserve.",
  },
  {
    id: "tighten-preserves-scn6-duration",
    targetIdx: 5,
    field: "duration",
    newValue: 5.0,
    prompt: "Smooth out the pacing.",
    description: "Reveal scene was lengthened on purpose; preserve.",
  },
  {
    id: "tighten-preserves-scn4-text",
    targetIdx: 3,
    field: "text",
    newValue: T("Stack motion graphics on emphasis beats"),
    prompt: "Make the script tighter overall.",
    description: "User shortened scn-4 text; preserve.",
  },

  // ── "Improve quality" family (5) ─────────────────────────────
  {
    id: "improve-preserves-scn5-text",
    targetIdx: 4,
    field: "text",
    newValue: T("Drop a swoosh on EVERY transition or you're losing viewers"),
    prompt: "Improve the overall quality of the video — better text, better visuals, more punch.",
    description: "Vague 'improve' should not blow up scn-5's hand-tuned text.",
  },
  {
    id: "improve-preserves-scn2-emphasisText",
    targetIdx: 1,
    field: "emphasisText",
    newValue: T("FIX IT"),
    prompt: "Polish the whole thing.",
    description: "Manual emphasis on scn-2 stays.",
  },
  {
    id: "improve-preserves-scn7-duration",
    targetIdx: 6,
    field: "duration",
    newValue: 3.5,
    prompt: "Make the video feel more polished and professional.",
    description: "CTA timing was hand-set; preserve.",
  },
  {
    id: "improve-preserves-scn1-text",
    targetIdx: 0,
    field: "text",
    newValue: T("Most editors waste 80% of their time — here's why"),
    prompt: "Make the entire video feel more professional.",
    description: "Hook was specifically reworded; preserve.",
  },
  {
    id: "improve-preserves-scn6-text",
    targetIdx: 5,
    field: "text",
    newValue: T("Do this and your videos finally hit different"),
    prompt: "Take a polish pass on every scene.",
    description: "Reveal text fine-tuned; preserve.",
  },

  // ── "Make it more X" family (5) ──────────────────────────────
  {
    id: "more-energetic-preserves-scn3",
    targetIdx: 2,
    field: "text",
    newValue: T("Cut your A-rolls 30% tighter"),
    prompt: "Make the whole thing feel more energetic.",
    description: "scn-3 text protected.",
  },
  {
    id: "more-dramatic-preserves-scn1-emph",
    targetIdx: 0,
    field: "emphasisText",
    newValue: T("WASTE"),
    prompt: "Make the video feel more dramatic — bigger emphasis, stronger words.",
    description: "Hook emphasis stays despite 'bigger emphasis' ask.",
  },
  {
    id: "more-modern-preserves-scn7",
    targetIdx: 6,
    field: "text",
    newValue: T("Subscribe — link in description"),
    prompt: "Make it feel more modern, more 2025.",
    description: "CTA text protected.",
  },
  {
    id: "more-cinematic-preserves-scn5-duration",
    targetIdx: 4,
    field: "duration",
    newValue: 4.0,
    prompt: "Make it more cinematic — let scenes breathe.",
    description: "scn-5 duration stays at 4.0 even when 'breathe' suggests longer.",
  },
  {
    id: "more-fast-preserves-scn4-duration",
    targetIdx: 3,
    field: "duration",
    newValue: 1.5,
    prompt: "Make it faster, snappier.",
    description: "scn-4 already tightened; agent shouldn't tighten further.",
  },
];

export const cases: TestCase[] = SEEDS.map((s) => {
  const project = baseProject();
  const sceneId = BASE_SCENE_IDS[s.targetIdx]!;
  // Apply the "manual edit" to the project so the agent sees it as
  // current state, AND inject the corresponding recentManualEdits log
  // entry so the awareness layer fires.
  const scene = project.scenes[s.targetIdx]!;
  const oldValue = (scene as unknown as Record<string, unknown>)[s.field];
  (scene as unknown as Record<string, unknown>)[s.field] = s.newValue;
  const editLog: ManualEditLogEntry = {
    sceneId,
    sceneIndex: s.targetIdx,
    field: s.field,
    oldValue: typeof oldValue === "string" || typeof oldValue === "number" ? oldValue : null,
    newValue: typeof s.newValue === "string" || typeof s.newValue === "number" ? s.newValue : null,
    at: Date.now() - 30_000,
  };
  return {
    id: `tier6-${s.id}`,
    tier: 6,
    category: "manual-edit-preserve",
    description: `Tier 6 · ${s.description}`,
    initialProject: project,
    recentManualEdits: [editLog],
    focusedSceneId: null,
    userMessage: s.prompt,
    assertions: {
      toolTrace: {
        mustNotCall: [...FORBIDDEN_TIER6],
        maxTotalCalls: 30,
      },
      finalSceneCount: { min: 7, max: 7 },
      manualEditsPreserved: [
        { sceneId, field: s.field, value: s.newValue },
      ],
    },
  };
});

export default cases;
