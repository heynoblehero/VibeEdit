/**
 * Manual-edit preservation judge. Tier-6 cases set fields by hand
 * (simulating recentManualEdits) and assert those fields remain
 * untouched after the agent runs. This directly tests the new
 * recentManualEdits awareness layer in /api/agent.
 */

import type { Project, Scene } from "../../src/lib/scene-schema";
import type { ManualEditPreserveExpectation } from "../runner/case-types";

export interface ManualEditFailure {
  kind: "scene-missing" | "field-changed";
  detail: string;
}

export interface ManualEditResult {
  pass: boolean;
  failures: ManualEditFailure[];
}

function readField(scene: Scene, field: string): unknown {
  // Dot-paths into the scene object; supports the common manual-edit
  // tracked fields: text, emphasisText, subtitleText, duration, label,
  // characterId, voiceover.transcript, etc.
  return field.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object") return (acc as Record<string, unknown>)[key];
    return undefined;
  }, scene as unknown);
}

export function judgeManualEditsPreserved(
  project: Project,
  expectations: ManualEditPreserveExpectation[],
): ManualEditResult {
  const failures: ManualEditFailure[] = [];
  const sceneById = new Map(project.scenes.map((s) => [s.id, s]));
  for (const exp of expectations) {
    const scene = sceneById.get(exp.sceneId);
    if (!scene) {
      failures.push({
        kind: "scene-missing",
        detail: `scene ${exp.sceneId} not present after agent run`,
      });
      continue;
    }
    const actual = readField(scene, exp.field);
    if (actual !== exp.value) {
      failures.push({
        kind: "field-changed",
        detail: `${exp.sceneId}.${exp.field}: agent overwrote ${JSON.stringify(exp.value)} → ${JSON.stringify(actual)}`,
      });
    }
  }
  return { pass: failures.length === 0, failures };
}
