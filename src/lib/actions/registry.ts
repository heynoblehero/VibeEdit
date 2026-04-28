import type { AnyAction } from "./types";
import {
  musicSetAction,
  sceneRemoveAction,
  sceneUpdateAction,
  scriptSetAction,
} from "./handlers/scene";

/**
 * The single source of truth for "things that can mutate the project".
 *
 * Phase-1 set focuses on the highest-friction overlaps from the survey:
 *   - scene.update : flat-alias bridge lives here once
 *   - scene.remove : ripple-deletes cuts referencing the scene
 *   - script.set   : trivial scalar
 *   - music.set    : trivial scalar
 *
 * Both surfaces (agent-tools.ts on the server, Zustand stores on the
 * client) call dispatchAction(name, args) instead of mutating state
 * directly. Future phases migrate the rest of the survey list:
 *   - scene.create, scene.duplicate, scene.reorder
 *   - caption.style.set, motion.preset.set
 *   - cut.upsert, cut.remove
 *   - keyframe.upsert, keyframe.clear
 *   - workflow.set
 */
export const ACTION_REGISTRY: Record<string, AnyAction> = {
  [sceneUpdateAction.name]: sceneUpdateAction as AnyAction,
  [sceneRemoveAction.name]: sceneRemoveAction as AnyAction,
  [scriptSetAction.name]: scriptSetAction as AnyAction,
  [musicSetAction.name]: musicSetAction as AnyAction,
};

export function getAction(name: string): AnyAction | undefined {
  return ACTION_REGISTRY[name];
}

export function listActionNames(): string[] {
  return Object.keys(ACTION_REGISTRY).sort();
}

export function describeActions(): string {
  return Object.values(ACTION_REGISTRY)
    .map((a) => `- ${a.name}: ${a.description}`)
    .join("\n");
}
