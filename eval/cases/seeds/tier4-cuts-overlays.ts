/**
 * Tier 4 — cuts + overlays + SFX placement on an existing project.
 * Agent must call setCut / updateScene-with-effects on the right
 * scene boundaries. Tests scope discipline AND asset-keyword match.
 *
 * 15 seeds across 4 families.
 */

import type { TestCase } from "../../runner/case-types";
import { baseProject, BASE_SCENE_IDS } from "./_base-project";

const FORBIDDEN_TIER4 = [
  "planVideo",
  "applySceneTemplate",
  "switchWorkflow",
  "renderProject",
  "awaitRender",
  "generateScenesFromScript",
];

interface Tier4Seed {
  id: string;
  prompt: string;
  description: string;
  toolTrace: {
    mustCall: Array<{
      name: string;
      minCount?: number;
      args?: Array<{ path: string; match: string | { regex: string } | { in: string[] } }>;
    }>;
  };
  assetMatches?: TestCase["assertions"]["assetMatches"];
  finalSceneCount?: { min?: number; max?: number };
}

const TIER4: Tier4Seed[] = [
  // ── Cut family (4) ───────────────────────────────────────────
  {
    id: "hard-cut-2-to-3",
    prompt: "Add a hard cut between scene 2 and scene 3 — no fade, just a snap.",
    description: "Single setCut call with kind='hard' between scn-2→scn-3.",
    toolTrace: {
      mustCall: [
        {
          name: "setCut",
          minCount: 1,
          args: [
            { path: "fromSceneId", match: "scn-2" },
            { path: "toSceneId", match: "scn-3" },
            { path: "kind", match: { regex: "^(hard|cut)$" } },
          ],
        },
      ],
    },
    finalSceneCount: { min: 7, max: 7 },
  },
  {
    id: "fade-between-tip-1-and-2",
    prompt: "Soften the cut between scene 3 and scene 4 with a fade.",
    description: "setCut kind=fade between scn-3→scn-4.",
    toolTrace: {
      mustCall: [
        {
          name: "setCut",
          minCount: 1,
          args: [
            { path: "fromSceneId", match: "scn-3" },
            { path: "toSceneId", match: "scn-4" },
            { path: "kind", match: { regex: "^fade$" } },
          ],
        },
      ],
    },
    finalSceneCount: { min: 7, max: 7 },
  },
  {
    id: "zoom-blur-into-reveal",
    prompt: "Make the transition into scene 6 dramatic — zoom blur, ~12 frames.",
    description: "setCut into scn-6 with kind=zoom_blur.",
    toolTrace: {
      mustCall: [
        {
          name: "setCut",
          minCount: 1,
          args: [
            { path: "toSceneId", match: "scn-6" },
            { path: "kind", match: { regex: "zoom" } },
          ],
        },
      ],
    },
    finalSceneCount: { min: 7, max: 7 },
  },
  {
    id: "cuts-everywhere",
    prompt: "Add a cut treatment between EVERY scene boundary (6 total). Mix it up — fades, hard cuts, beat flashes.",
    description: "setCut called ≥6 times. Catches scope-creep where agent adds extra scenes.",
    toolTrace: {
      mustCall: [{ name: "setCut", minCount: 6 }],
    },
    finalSceneCount: { min: 7, max: 7 },
  },

  // ── Overlay family (4) ───────────────────────────────────────
  {
    id: "breaking-glass-on-reveal",
    prompt: "Add the breaking glass overlay on scene 6 — only on that scene.",
    description: "updateScene scn-6 with effects[] containing a glass overlay. Asset URL must match Overlays/Breaking Glass.mp4 (keywords break/shatter).",
    toolTrace: {
      mustCall: [
        {
          name: "updateScene",
          minCount: 1,
          args: [{ path: "sceneId", match: "scn-6" }],
        },
      ],
    },
    assetMatches: [
      {
        sceneIndex: 5, // 0-based scn-6 = index 5
        field: "effects[].url",
        expectKeywords: ["break", "shatter", "glass", "impact"],
      },
    ],
    finalSceneCount: { min: 7, max: 7 },
  },
  {
    id: "neon-on-hook",
    prompt: "The hook needs more energy — add the neon overlay on scene 1.",
    description: "Asset-aware overlay placement; expect neon keywords.",
    toolTrace: {
      mustCall: [
        {
          name: "updateScene",
          minCount: 1,
          args: [{ path: "sceneId", match: "scn-1" }],
        },
      ],
    },
    assetMatches: [
      {
        sceneIndex: 0,
        field: "effects[].url",
        expectKeywords: ["neon", "glow", "tech"],
      },
    ],
    finalSceneCount: { min: 7, max: 7 },
  },
  {
    id: "scribble-on-tip-2",
    prompt: "Drop the scribble doodle overlay on scene 4 (tip 2) to highlight it.",
    description: "Scribble overlay → keywords scribble/doodle/annotation.",
    toolTrace: {
      mustCall: [
        {
          name: "updateScene",
          minCount: 1,
          args: [{ path: "sceneId", match: "scn-4" }],
        },
      ],
    },
    assetMatches: [
      {
        sceneIndex: 3,
        field: "effects[].url",
        expectKeywords: ["scribble", "doodle", "annotation"],
      },
    ],
    finalSceneCount: { min: 7, max: 7 },
  },
  {
    id: "overlay-discipline-only-one-scene",
    prompt: "Add the breaking glass overlay to scene 6 ONLY. Don't put it on any other scene.",
    description: "Discipline test — agent must touch ONLY scn-6, not blanket every scene.",
    toolTrace: {
      mustCall: [
        {
          name: "updateScene",
          minCount: 1,
          args: [{ path: "sceneId", match: "scn-6" }],
        },
      ],
    },
    assetMatches: [
      {
        sceneIndex: 5,
        field: "effects[].url",
        expectKeywords: ["break", "shatter", "glass"],
      },
    ],
    finalSceneCount: { min: 7, max: 7 },
  },

  // ── SFX family (4) ───────────────────────────────────────────
  {
    id: "swoosh-on-every-transition",
    prompt: "Drop a swoosh SFX on every scene transition (scenes 2 through 7 should each get a swoosh).",
    description: "6 updateScene calls with sceneSfxUrl matching swoosh keyword.",
    toolTrace: {
      mustCall: [{ name: "updateScene", minCount: 6 }],
    },
    assetMatches: [
      { sceneIndex: 1, field: "sceneSfxUrl", expectKeywords: ["swoosh", "whoosh", "transition"] },
      { sceneIndex: 3, field: "sceneSfxUrl", expectKeywords: ["swoosh", "whoosh", "transition"] },
      { sceneIndex: 5, field: "sceneSfxUrl", expectKeywords: ["swoosh", "whoosh", "transition"] },
    ],
    finalSceneCount: { min: 7, max: 7 },
  },
  {
    id: "typing-sfx-on-tip-2",
    prompt: "Scene 4 is about stacking motion graphics — add a typing keyboard SFX to it.",
    description: "Asset-aware single SFX swap; typing keyword.",
    toolTrace: {
      mustCall: [
        {
          name: "updateScene",
          minCount: 1,
          args: [{ path: "sceneId", match: "scn-4" }],
        },
      ],
    },
    assetMatches: [
      { sceneIndex: 3, field: "sceneSfxUrl", expectKeywords: ["typing", "keyboard"] },
    ],
    finalSceneCount: { min: 7, max: 7 },
  },
  {
    id: "camera-shutter-on-hook",
    prompt: "Hit scene 1 with a camera shutter SFX — make it feel like a freeze frame.",
    description: "Snap/shutter keyword.",
    toolTrace: {
      mustCall: [
        {
          name: "updateScene",
          minCount: 1,
          args: [{ path: "sceneId", match: "scn-1" }],
        },
      ],
    },
    assetMatches: [
      { sceneIndex: 0, field: "sceneSfxUrl", expectKeywords: ["snap", "shutter", "camera"] },
    ],
    finalSceneCount: { min: 7, max: 7 },
  },
  {
    id: "riser-before-reveal",
    prompt: "Stick a riser SFX on scene 5 so it builds tension into the reveal.",
    description: "Riser/tension keyword on the scene BEFORE the reveal.",
    toolTrace: {
      mustCall: [
        {
          name: "updateScene",
          minCount: 1,
          args: [{ path: "sceneId", match: "scn-5" }],
        },
      ],
    },
    assetMatches: [
      { sceneIndex: 4, field: "sceneSfxUrl", expectKeywords: ["riser", "build-up", "tension"] },
    ],
    finalSceneCount: { min: 7, max: 7 },
  },

  // ── Mixed family (3) ─────────────────────────────────────────
  {
    id: "reveal-package",
    prompt: "Polish scene 6 — add the breaking-glass overlay AND a riser SFX. Keep it just on that scene.",
    description: "Two-step single-scene polish. Agent should issue 1-2 updateScene calls on scn-6 only.",
    toolTrace: {
      mustCall: [
        {
          name: "updateScene",
          minCount: 1,
          args: [{ path: "sceneId", match: "scn-6" }],
        },
      ],
    },
    assetMatches: [
      { sceneIndex: 5, field: "effects[].url", expectKeywords: ["break", "shatter", "glass"] },
      { sceneIndex: 5, field: "sceneSfxUrl", expectKeywords: ["riser", "tension"] },
    ],
    finalSceneCount: { min: 7, max: 7 },
  },
  {
    id: "transition-treatment-package",
    prompt: "Between scenes 5 and 6 — add a fade cut AND a swoosh SFX on scene 5 to lead into it.",
    description: "Two-step but tightly scoped. setCut(5→6) + updateScene(scn-5).",
    toolTrace: {
      mustCall: [
        {
          name: "setCut",
          minCount: 1,
          args: [
            { path: "fromSceneId", match: "scn-5" },
            { path: "toSceneId", match: "scn-6" },
          ],
        },
        {
          name: "updateScene",
          minCount: 1,
          args: [{ path: "sceneId", match: "scn-5" }],
        },
      ],
    },
    assetMatches: [
      { sceneIndex: 4, field: "sceneSfxUrl", expectKeywords: ["swoosh", "whoosh", "transition"] },
    ],
    finalSceneCount: { min: 7, max: 7 },
  },
  {
    id: "scope-discipline-no-extra-scenes",
    prompt: "Add a hard cut between scene 4 and scene 5. That's it — don't add scenes, don't change content, don't run the autonomous loop.",
    description: "Pure scope-discipline. ONE setCut, no createScene/updateScene, scene count unchanged.",
    toolTrace: {
      mustCall: [
        {
          name: "setCut",
          minCount: 1,
          args: [
            { path: "fromSceneId", match: "scn-4" },
            { path: "toSceneId", match: "scn-5" },
          ],
        },
      ],
    },
    finalSceneCount: { min: 7, max: 7 },
  },
];

export const cases: TestCase[] = TIER4.map((s) => ({
  id: `tier4-${s.id}`,
  tier: 4,
  category: "cuts-overlays",
  description: `Tier 4 · ${s.description}`,
  initialProject: baseProject(),
  recentManualEdits: [],
  focusedSceneId: null,
  userMessage: s.prompt,
  assertions: {
    toolTrace: {
      mustCall: s.toolTrace.mustCall,
      mustNotCall: [...FORBIDDEN_TIER4],
      maxTotalCalls: 20,
    },
    finalSceneCount: s.finalSceneCount,
    assetMatches: s.assetMatches,
  },
}));

export default cases;
