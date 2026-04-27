/**
 * Tier 5 — asset awareness. The big tier (35 seeds). Each one sets up
 * a scene context and asks the agent to pick the RIGHT asset from the
 * Isaac pack. The asset-match judge looks up the chosen URL's keywords
 * and checks they overlap with what the scene's mood requires.
 *
 * Generated programmatically from a (mood, assetField, expectedKeywords)
 * matrix to keep coverage broad.
 */

import type { TestCase } from "../../runner/case-types";
import { baseProject, BASE_SCENE_IDS } from "./_base-project";

const FORBIDDEN_TIER5 = [
  "planVideo",
  "applySceneTemplate",
  "switchWorkflow",
  "renderProject",
  "awaitRender",
  "generateScenesFromScript",
];

interface MoodSpec {
  /** Short tag for the test ID. */
  tag: string;
  /** What to put in the user message — mood + scene context. */
  context: string;
  /** Where the agent should put the asset. */
  field: "characterUrl" | "sceneSfxUrl" | "effects[].url" | "background.imageUrl";
  /** Keywords from the asset index that satisfy this mood. */
  expectKeywords: string[];
}

const CHARACTER_MOODS: MoodSpec[] = [
  { tag: "shocked-reveal", context: "the camera lands on a SHOCKED reveal — the viewer just learned something wild", field: "characterUrl", expectKeywords: ["celebrating", "presenting", "offering", "explaining"] },
  { tag: "thinking-setup", context: "this is the SETUP scene — the host is wondering if it's even possible", field: "characterUrl", expectKeywords: ["thinking", "contemplating", "wondering", "uncertain"] },
  { tag: "celebrating-payoff", context: "this is the PAYOFF scene — we found the answer, time to celebrate", field: "characterUrl", expectKeywords: ["celebrating", "victory", "win", "hype", "excited"] },
  { tag: "presenting-intro", context: "this is the INTRODUCTION scene — host welcomes the viewer", field: "characterUrl", expectKeywords: ["presenting", "introduce", "show", "explaining", "offering"] },
  { tag: "shrug-uncertainty", context: "this is a UNCERTAINTY beat — host shrugs at a question", field: "characterUrl", expectKeywords: ["shrug", "uncertain", "i-dont-know", "questioning"] },
  { tag: "working-broll", context: "this is a B-ROLL beat — host is working at his desk reading a tablet", field: "characterUrl", expectKeywords: ["working", "reading", "tablet", "studying"] },
  { tag: "waiting-time", context: "the scene shows TIME PASSING — host is waiting, checking his watch", field: "characterUrl", expectKeywords: ["waiting", "time", "checking", "watch"] },
  { tag: "pointing-emphasis", context: "this is an EMPHASIS scene — host is pointing forward, calling out the viewer directly", field: "characterUrl", expectKeywords: ["pointing", "emphasis", "directing", "double-point"] },
  { tag: "proud-portrait", context: "this is the TITLE / hero card — formal proud portrait", field: "characterUrl", expectKeywords: ["proud", "portrait", "formal", "hero", "intro"] },
];

const SFX_MOODS: MoodSpec[] = [
  { tag: "snap-freeze", context: "this scene is a FREEZE FRAME moment — the camera snaps a photo", field: "sceneSfxUrl", expectKeywords: ["snap", "shutter", "camera", "photo"] },
  { tag: "click-ui-tap", context: "this scene is about a UI INTERACTION — a button tap", field: "sceneSfxUrl", expectKeywords: ["click", "tap", "ui", "mouse"] },
  { tag: "swoosh-transition", context: "this scene is a TRANSITION beat — fast movement between sections", field: "sceneSfxUrl", expectKeywords: ["swoosh", "whoosh", "transition", "sweep"] },
  { tag: "typing-coding", context: "this scene shows the host TYPING / coding at a keyboard", field: "sceneSfxUrl", expectKeywords: ["typing", "keyboard", "writing"] },
  { tag: "riser-tension", context: "this scene is BUILDING TENSION before a reveal — needs a tension-building sound", field: "sceneSfxUrl", expectKeywords: ["riser", "build-up", "tension", "anticipation"] },
  { tag: "distortion-warning", context: "this scene is a WARNING / GLITCH beat — broken state", field: "sceneSfxUrl", expectKeywords: ["distortion", "glitch", "warning", "static"] },
  { tag: "gear-mechanism", context: "this scene shows a MECHANISM clicking into place — gear-like sound", field: "sceneSfxUrl", expectKeywords: ["gear", "mechanism", "lock", "switch"] },
];

const OVERLAY_MOODS: MoodSpec[] = [
  { tag: "glass-shatter-impact", context: "this scene is a DRAMATIC IMPACT moment — needs a glass-shatter feel", field: "effects[].url", expectKeywords: ["break", "shatter", "glass", "impact"] },
  { tag: "neon-tech-intro", context: "this scene has a TECH / CYBER vibe — neon glow appropriate", field: "effects[].url", expectKeywords: ["neon", "glow", "tech", "futuristic"] },
  { tag: "scribble-annotation", context: "this scene needs a SCRIBBLE / DOODLE highlight on top", field: "effects[].url", expectKeywords: ["scribble", "doodle", "annotation", "highlight"] },
];

const ALL_MOODS = [...CHARACTER_MOODS, ...SFX_MOODS, ...OVERLAY_MOODS];

// Map each mood spec onto a target scene (rotating through the 7 base scenes).
let cursor = 0;
const TARGET_SCENE_IDX_BY_MOOD = new Map<string, number>();
for (const m of ALL_MOODS) {
  TARGET_SCENE_IDX_BY_MOOD.set(m.tag, cursor % 7);
  cursor++;
}

function buildCase(m: MoodSpec, alsoCharacterPick = false): TestCase {
  const idx = TARGET_SCENE_IDX_BY_MOOD.get(m.tag)!;
  const sceneId = BASE_SCENE_IDS[idx]!;
  const sceneNum = idx + 1;
  return {
    id: `tier5-${m.tag}-scn${sceneNum}`,
    tier: 5,
    category: "asset-awareness",
    description: `Tier 5 · pick the right ${m.field} for scene ${sceneNum} given mood: ${m.tag}.`,
    initialProject: baseProject(),
    recentManualEdits: [],
    focusedSceneId: null,
    userMessage:
      `Update scene ${sceneNum} with the right asset from the uploaded Isaac pack. Context for that scene: ${m.context}. ` +
      `Pick the asset that matches that mood — read the filenames in the Characters / SFX / Overlays folders.`,
    assertions: {
      toolTrace: {
        mustCall: [
          {
            name: "updateScene",
            minCount: 1,
            args: [{ path: "sceneId", match: sceneId }],
          },
        ],
        mustNotCall: [...FORBIDDEN_TIER5],
        maxTotalCalls: 8,
      },
      finalSceneCount: { min: 7, max: 7 },
      assetMatches: [
        {
          sceneIndex: idx,
          field: m.field,
          expectKeywords: m.expectKeywords,
        },
      ],
    },
  };
}

// Base 19 cases (one per mood spec).
const baseCases: TestCase[] = ALL_MOODS.map((m) => buildCase(m));

// Add 16 multi-asset combo cases — each pairs a character-mood with an
// SFX-mood on the same scene. Tests "agent picks two assets, both
// correct."
const COMBOS: Array<{ char: MoodSpec; sfx: MoodSpec; tag: string }> = [
  { char: CHARACTER_MOODS[2]!, sfx: SFX_MOODS[2]!, tag: "celebration-with-swoosh" },
  { char: CHARACTER_MOODS[1]!, sfx: SFX_MOODS[4]!, tag: "thinking-with-riser" },
  { char: CHARACTER_MOODS[0]!, sfx: SFX_MOODS[0]!, tag: "shocked-with-shutter" },
  { char: CHARACTER_MOODS[3]!, sfx: SFX_MOODS[1]!, tag: "presenting-with-click" },
  { char: CHARACTER_MOODS[4]!, sfx: SFX_MOODS[5]!, tag: "shrug-with-distortion" },
  { char: CHARACTER_MOODS[5]!, sfx: SFX_MOODS[3]!, tag: "working-with-typing" },
  { char: CHARACTER_MOODS[6]!, sfx: SFX_MOODS[4]!, tag: "waiting-with-riser" },
  { char: CHARACTER_MOODS[7]!, sfx: SFX_MOODS[2]!, tag: "pointing-with-swoosh" },
  { char: CHARACTER_MOODS[8]!, sfx: SFX_MOODS[0]!, tag: "proud-portrait-with-shutter" },
  { char: CHARACTER_MOODS[2]!, sfx: SFX_MOODS[6]!, tag: "celebration-with-gear" },
  { char: CHARACTER_MOODS[0]!, sfx: SFX_MOODS[2]!, tag: "shocked-with-swoosh" },
  { char: CHARACTER_MOODS[3]!, sfx: SFX_MOODS[3]!, tag: "presenting-with-typing" },
  { char: CHARACTER_MOODS[5]!, sfx: SFX_MOODS[1]!, tag: "working-with-click" },
  { char: CHARACTER_MOODS[1]!, sfx: SFX_MOODS[6]!, tag: "thinking-with-gear" },
  { char: CHARACTER_MOODS[7]!, sfx: SFX_MOODS[5]!, tag: "pointing-with-distortion" },
  { char: CHARACTER_MOODS[4]!, sfx: SFX_MOODS[4]!, tag: "shrug-with-riser" },
];

const comboCases: TestCase[] = COMBOS.map((combo, i) => {
  const sceneNum = ((i + 3) % 7) + 1;
  const sceneId = BASE_SCENE_IDS[sceneNum - 1]!;
  return {
    id: `tier5-combo-${combo.tag}`,
    tier: 5,
    category: "asset-awareness",
    description: `Tier 5 combo · pick correct character + SFX for scene ${sceneNum} (${combo.tag}).`,
    initialProject: baseProject(),
    recentManualEdits: [],
    focusedSceneId: null,
    userMessage:
      `Update scene ${sceneNum} so it captures: ${combo.char.context}. Also: ${combo.sfx.context}. Pick both the right character pose and the right SFX from the Isaac pack.`,
    assertions: {
      toolTrace: {
        mustCall: [
          {
            name: "updateScene",
            minCount: 1,
            args: [{ path: "sceneId", match: sceneId }],
          },
        ],
        mustNotCall: [...FORBIDDEN_TIER5],
        maxTotalCalls: 10,
      },
      finalSceneCount: { min: 7, max: 7 },
      assetMatches: [
        { sceneIndex: sceneNum - 1, field: "characterUrl", expectKeywords: combo.char.expectKeywords },
        { sceneIndex: sceneNum - 1, field: "sceneSfxUrl", expectKeywords: combo.sfx.expectKeywords },
      ],
    },
  };
});

export const cases: TestCase[] = [...baseCases, ...comboCases];
export default cases;
