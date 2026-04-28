import type { Project } from "@/lib/scene-schema";
import { getAction } from "./registry";
import type { ActionResult } from "./types";

/**
 * Server-side dispatch. The agent's dispatchAction tool calls this;
 * client-side Zustand store actions can also call it (Phase 2). Both
 * paths flow through the same registry so behavior never drifts.
 *
 * Returns the new project + a message. Caller is responsible for
 * persisting the new project (route mutates ctx.project; client calls
 * useProjectStore.setProject).
 */
export function dispatchAction(
  project: Project,
  name: string,
  args: Record<string, unknown>,
): ActionResult {
  const action = getAction(name);
  if (!action) {
    return {
      ok: false,
      project,
      message: `unknown action "${name}". Call listActions to see what's available.`,
    };
  }
  if (action.validate) {
    const err = action.validate(args);
    if (err) {
      return {
        ok: false,
        project,
        message: `[invalid-args] ${name}: ${err}`,
      };
    }
  }
  try {
    return action.handler(project, args);
  } catch (e) {
    return {
      ok: false,
      project,
      message: `[handler-threw] ${name}: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}
