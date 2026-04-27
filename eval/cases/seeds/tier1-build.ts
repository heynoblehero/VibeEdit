/**
 * Tier 1 — build a ~100s clip from scratch using the Isaac asset
 * pack. Five seeds covering the dominant build patterns. Each seed
 * expects the agent to:
 *   · plan ≥6 scenes (writeNarrativeSpine + planVideo or
 *     applySceneTemplate),
 *   · cover ~80–120 seconds of total runtime,
 *   · pull at least 3 distinct character poses,
 *   · drop at least 2 SFX cues,
 *   · place at least 1 overlay (glass / scribble / neon),
 *   · NOT call render tools (renderProject / awaitRender) — those are
 *     for after the user approves.
 *
 * The asset list is injected into the project's `uploads` array so the
 * agent's `analyzeAssets` tool sees it. Ground-truth keywords come from
 * eval/fixtures/isaac-asset-index.ts.
 */

import type { Project } from "../../../src/lib/scene-schema";
import type { TestCase } from "../../runner/case-types";
import { ISAAC_ASSET_INDEX } from "../../fixtures/isaac-asset-index";

const ASSET_BASE = "file:///home/ishaan/Projects/LIVE_PRODUCTS/VibeEdit/eval/fixtures/isaac-pack";
const NOW = Date.now();

const isaacUploads = ISAAC_ASSET_INDEX.map((a, i) => ({
  id: `upl-${i}`,
  name: a.path.split("/").pop()!,
  url: `${ASSET_BASE}/${a.path}`,
  type:
    a.kind === "character" || a.kind === "graphic"
      ? "image/png"
      : a.kind === "overlay"
        ? "video/mp4"
        : "audio/mpeg",
  uploadedAt: NOW,
}));

function seededProject(): Project {
  return {
    id: "tier1-base",
    name: "Isaac Style Eval",
    script: "",
    scenes: [],
    fps: 30,
    width: 1080,
    height: 1920,
    uploads: isaacUploads,
  } as Project;
}

const FORBIDDEN_TIER1 = [
  "renderProject",
  "awaitRender",
  "watchRenderedVideo",
  "switchWorkflow",
];

export const cases: TestCase[] = [
  {
    id: "tier1-build-001-smooth-transitions",
    tier: 1,
    category: "build",
    description:
      "Build a 100s tutorial about smooth transitions in CapCut, Isaac style. Expect ≥3 character poses, ≥2 SFX (esp. swooshes), ≥1 overlay.",
    initialProject: seededProject(),
    recentManualEdits: [],
    focusedSceneId: null,
    userMessage:
      "Make a ~100 second YouTube tutorial about smooth transitions in CapCut, in Isaac's style. Use the uploaded assets — Isaac character poses, the gradient backgrounds, the swoosh SFX, and at least one overlay (breaking glass or neon). Hook the viewer in the first scene, then 5–7 tip scenes, then a CTA scene at the end.",
    assertions: {
      toolTrace: {
        mustCall: [
          { name: "createScene", minCount: 6 },
          { name: "writeNarrativeSpine", minCount: 1 },
        ],
        mustNotCall: [...FORBIDDEN_TIER1],
        maxTotalCalls: 80,
      },
      finalSceneCount: { min: 6, max: 14 },
      finalDurationSec: { minSec: 80, maxSec: 120 },
    },
  },
  {
    id: "tier1-build-002-five-motion-tips",
    tier: 1,
    category: "build",
    description:
      "Build a 100s '5 motion graphics tips' explainer. Expect numbered Graphics/1.png..5.png to be used as section headers, ≥3 character poses, ≥2 SFX.",
    initialProject: seededProject(),
    recentManualEdits: [],
    focusedSceneId: null,
    userMessage:
      "Build a ~100 second '5 motion graphics techniques every editor should know' explainer in Isaac's style. Use the uploaded numbered Graphics (1.png through 5.png) as section headers — one per tip — and Isaac character poses to react in between. Hook scene first, then 5 tip sections, then a CTA.",
    assertions: {
      toolTrace: {
        mustCall: [
          { name: "createScene", minCount: 6 },
          { name: "applySceneTemplate", minCount: 1 },
        ],
        mustNotCall: [...FORBIDDEN_TIER1],
        maxTotalCalls: 80,
      },
      finalSceneCount: { min: 7, max: 12 },
      finalDurationSec: { minSec: 80, maxSec: 120 },
    },
  },
  {
    id: "tier1-build-003-why-isaac-style-works",
    tier: 1,
    category: "build",
    description:
      "Build a 90-110s opinion piece. Expect varied poses (thinking + celebrating + offering), riser SFX before reveal.",
    initialProject: seededProject(),
    recentManualEdits: [],
    focusedSceneId: null,
    userMessage:
      "Make a ~100 second video titled 'Why Isaac's editing style actually works'. Lean into the Isaac character poses — use the thinking pose during setup, the shrugging pose for skepticism, and the arms-up / outstretched-hand poses for the payoff scenes. Use a riser SFX before the reveal scene. Throw in the breaking glass overlay on the climax.",
    assertions: {
      toolTrace: {
        mustCall: [{ name: "createScene", minCount: 6 }],
        mustNotCall: [...FORBIDDEN_TIER1],
        maxTotalCalls: 80,
      },
      finalSceneCount: { min: 6, max: 14 },
      finalDurationSec: { minSec: 80, maxSec: 120 },
      assetMatches: [
        // Weak heuristic: SOMEWHERE around scene 5 (mid-late) the agent
        // should land on a celebratory / presenting / offering pose for
        // the payoff. Catches "agent never used the right pose moods."
        {
          sceneIndex: 5,
          field: "characterUrl",
          expectKeywords: [
            "celebrating",
            "presenting",
            "offering",
            "thinking",
            "explaining",
          ],
        },
      ],
    },
  },
  {
    id: "tier1-build-004-faster-editing-60s",
    tier: 1,
    category: "build",
    description:
      "Build a 60s short — tighter constraint, scope-discipline test. Expect ≤8 scenes, total 50–75s, no celebration overkill.",
    initialProject: seededProject(),
    recentManualEdits: [],
    focusedSceneId: null,
    userMessage:
      "Make a 60-second short titled 'Speed up your editing workflow'. Keep it tight — 6 to 8 scenes max. Use Isaac poses, two SFX, and one overlay. Don't add an outro CTA scene; this is a TikTok-style fast hit.",
    assertions: {
      toolTrace: {
        mustCall: [{ name: "createScene", minCount: 5 }],
        mustNotCall: [...FORBIDDEN_TIER1],
        maxTotalCalls: 60,
      },
      finalSceneCount: { min: 5, max: 8 },
      finalDurationSec: { minSec: 50, maxSec: 75 },
    },
  },
  {
    id: "tier1-build-005-before-after-comparison",
    tier: 1,
    category: "build",
    description:
      "Build a 100s before/after comparison. Expect at least one split scene or a paired before/after pair.",
    initialProject: seededProject(),
    recentManualEdits: [],
    focusedSceneId: null,
    userMessage:
      "Build a ~100 second 'Before vs After: editing style breakdown' video. Show the before state (a boring scene), then the after state (the same idea but Isaac-style with motion graphics, character pose, SFX). At least one beat should use a split screen or paired before/after scenes. Use the camera-shutter SFX on the freeze-frame moment.",
    assertions: {
      toolTrace: {
        mustCall: [{ name: "createScene", minCount: 6 }],
        mustNotCall: [...FORBIDDEN_TIER1],
        maxTotalCalls: 80,
      },
      finalSceneCount: { min: 6, max: 14 },
      finalDurationSec: { minSec: 80, maxSec: 120 },
    },
  },
];

export default cases;
