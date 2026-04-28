import type { AnyAction } from "./types";
import {
  captionStyleSetAction,
  cutUpsertAction,
  keyframeUpsertAction,
  motionPresetSetAction,
  sceneCreateAction,
  workflowSetAction,
} from "./handlers/project";
import {
  musicSetAction,
  sceneRemoveAction,
  sceneUpdateAction,
  scriptSetAction,
} from "./handlers/scene";

/**
 * The single source of truth for "things that can mutate the project".
 *
 * Both surfaces (agent-tools.ts on the server, Zustand stores on the
 * client) call dispatchAction(name, args) instead of mutating state
 * directly. Adding a new mutation = add one handler here; both
 * surfaces pick it up automatically.
 */
export const ACTION_REGISTRY: Record<string, AnyAction> = {
  [sceneCreateAction.name]: sceneCreateAction as AnyAction,
  [sceneUpdateAction.name]: sceneUpdateAction as AnyAction,
  [sceneRemoveAction.name]: sceneRemoveAction as AnyAction,
  [scriptSetAction.name]: scriptSetAction as AnyAction,
  [musicSetAction.name]: musicSetAction as AnyAction,
  [captionStyleSetAction.name]: captionStyleSetAction as AnyAction,
  [motionPresetSetAction.name]: motionPresetSetAction as AnyAction,
  [cutUpsertAction.name]: cutUpsertAction as AnyAction,
  [keyframeUpsertAction.name]: keyframeUpsertAction as AnyAction,
  [workflowSetAction.name]: workflowSetAction as AnyAction,
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
