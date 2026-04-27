/**
 * Scope discipline judge. When focusedSceneId is set on the request,
 * the agent's mutations must land ONLY on that scene. This judge
 * inspects every tool call's args and flags any sceneId !== focused.
 *
 * Pure programmatic — no LLM. Mirrors the FOCUSED SCOPE constraint
 * the agent route already injects (route.ts:611-630).
 */

import type { ToolCallTrace } from "../runner/agent-client";

export interface ScopeFailure {
  kind: "out-of-scope-tool" | "out-of-scope-mutation";
  detail: string;
}

export interface ScopeResult {
  pass: boolean;
  failures: ScopeFailure[];
}

/** Tools that, when called with focusedSceneId set, MUST have their
 *  sceneId arg equal to the focused scene. */
const SCENE_SCOPED_TOOLS = new Set([
  "updateScene",
  "duplicateScene",
  "removeScene",
  "setSceneDuration",
  "generateImageForScene",
  "generateVideoForScene",
  "generateSfxForScene",
  "generateAvatarForScene",
  "narrateScene",
  "applyStylePresetToScene",
  "addKeyframe",
  "clearKeyframes",
  "visionCritiqueScene",
  "scoreAssetForScene",
  "prepareUploadForScene",
]);

/** Tools that mutate project-wide and should NEVER fire while
 *  focusedSceneId is set. */
const PROJECT_WIDE_TOOLS = new Set([
  "planVideo",
  "applySceneTemplate",
  "applyPaletteToProject",
  "switchWorkflow",
  "appendEndScreen",
  "generateMusicForProject",
  "narrateAllScenes",
  "applyStylePreset",
  "reorderScenes",
  "generateScenesFromScript",
  "setScript",
  "setProjectName",
  "setOrientation",
]);

export function judgeScope(
  trace: ToolCallTrace[],
  focusedSceneId: string | null,
): ScopeResult {
  const failures: ScopeFailure[] = [];
  if (!focusedSceneId) return { pass: true, failures };

  for (const call of trace) {
    if (PROJECT_WIDE_TOOLS.has(call.name)) {
      failures.push({
        kind: "out-of-scope-tool",
        detail: `${call.name} called while focused on ${focusedSceneId} (project-wide tool)`,
      });
      continue;
    }
    if (SCENE_SCOPED_TOOLS.has(call.name)) {
      const sid = (call.args as { sceneId?: string }).sceneId;
      // Agent route defaults missing sceneId to focused — only flag
      // when the agent actively passed a different one.
      if (typeof sid === "string" && sid !== focusedSceneId) {
        failures.push({
          kind: "out-of-scope-mutation",
          detail: `${call.name} mutated ${sid} but focus was ${focusedSceneId}`,
        });
      }
    }
  }
  return { pass: failures.length === 0, failures };
}
