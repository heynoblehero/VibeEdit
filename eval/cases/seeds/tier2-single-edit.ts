/**
 * Tier 2 — single-scene edits. Pre-loaded base project; user asks for
 * ONE focused change. Agent must mutate the named scene only and
 * leave the other six untouched.
 *
 * 15 seeds — 5 prompt families × 3 scene targets.
 */

import type { TestCase } from "../../runner/case-types";
import { baseProject, BASE_SCENE_IDS } from "./_base-project";

const FORBIDDEN_TIER2 = [
  "planVideo",
  "applySceneTemplate",
  "switchWorkflow",
  "renderProject",
  "awaitRender",
  "generateScenesFromScript",
  "appendEndScreen",
];

interface EditTemplate {
  family: string;
  promptFor: (sceneNum: number) => string;
  /** Tools that MUST appear with sceneId arg matching the target. */
  toolName: string;
  /** Optional arg-match path (e.g. "patch.text" for updateScene). */
  argMatch?: { path: string; match: string | { regex: string } };
}

const EDIT_TEMPLATES: EditTemplate[] = [
  {
    family: "punchier-text",
    promptFor: (n) => `Make scene ${n}'s text punchier — shorten it, drop weak words, all-caps the key phrase if it isn't already.`,
    toolName: "updateScene",
  },
  {
    family: "shorter-duration",
    promptFor: (n) => `Cut scene ${n}'s duration in half — it's dragging.`,
    toolName: "setSceneDuration",
  },
  {
    family: "swap-character",
    promptFor: (n) => `Swap scene ${n}'s character to the thinking pose.`,
    toolName: "updateScene",
  },
  {
    family: "change-bg-mood",
    promptFor: (n) => `Change scene ${n}'s background to something hyper / energetic.`,
    toolName: "updateScene",
  },
  {
    family: "add-emphasis",
    promptFor: (n) => `Add an emphasis word to scene ${n} — a single ALL-CAPS standout in the text.`,
    toolName: "updateScene",
  },
];

const TARGET_SCENES = [3, 5, 7]; // index 1-based for the prompt; 0-based for ID

export const cases: TestCase[] = [];

for (const tpl of EDIT_TEMPLATES) {
  for (const sceneNum of TARGET_SCENES) {
    const sceneId = BASE_SCENE_IDS[sceneNum - 1]!;
    const otherSceneIds = BASE_SCENE_IDS.filter((s) => s !== sceneId);
    cases.push({
      id: `tier2-${tpl.family}-scn${sceneNum}`,
      tier: 2,
      category: "single-edit",
      description: `Tier 2 · ${tpl.family} on scene ${sceneNum} (${sceneId}). Other scenes must stay untouched.`,
      initialProject: baseProject(),
      recentManualEdits: [],
      focusedSceneId: null,
      userMessage: tpl.promptFor(sceneNum),
      assertions: {
        toolTrace: {
          mustCall: [
            {
              name: tpl.toolName,
              minCount: 1,
              args: [{ path: "sceneId", match: sceneId }],
            },
          ],
          mustNotCall: [...FORBIDDEN_TIER2],
          maxTotalCalls: 12,
        },
        // Exact scene-count preservation: the agent must NOT add or
        // remove scenes during a single-edit ask.
        finalSceneCount: { min: 7, max: 7 },
        // Manual-edit-style assertion: the OTHER 6 scenes' texts must
        // remain whatever they started as. Tier 2 doesn't simulate a
        // manualEdits log — but the 'preserved' judge equally works on
        // baseline scene values, which is exactly the discipline test.
        manualEditsPreserved: otherSceneIds.flatMap((id) => {
          const orig = baseProject().scenes.find((s) => s.id === id);
          if (!orig) return [];
          // Only assert on text + duration — those are the most-edited fields.
          return [
            { sceneId: id, field: "text", value: orig.text ?? null },
            { sceneId: id, field: "duration", value: orig.duration },
          ];
        }),
      },
    });
  }
}

export default cases;
