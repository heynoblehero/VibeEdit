// Per-user Auto/Manual model selection. Persisted as a JSON blob in
// userPreferences.modelPreferences (see lib/db/schema.ts). Read/write helpers
// here are the only code that should touch that column directly; everything else
// goes through resolveModelForTask to turn a (task, prefs) pair into a concrete
// model entry.

import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { userPreferences } from "@/lib/db/schema";
import { defaultModelForTask, getModel, type ModelEntry, type ModelTask } from "./models";

export type ModelMode = "auto" | "manual";

export interface ModelPreferences {
  mode: ModelMode;
  /** Chosen model id per task. Only consulted in "manual" mode. */
  choices: Partial<Record<ModelTask, string>>;
}

const DEFAULT_PREFERENCES: ModelPreferences = { mode: "auto", choices: {} };

const VALID_TASKS: ReadonlySet<string> = new Set<ModelTask>([
  "brain",
  "image",
  "video",
  "music",
  "voice",
  "motion",
]);

/** True if `id` is a real, enabled model registered for `task`. */
function isValidChoice(task: ModelTask, id: unknown): id is string {
  if (typeof id !== "string") return false;
  const m = getModel(id);
  return !!m && m.task === task && m.enabled;
}

/**
 * Parse + sanitize whatever is stored. Unknown modes fall back to "auto",
 * unknown task keys are dropped, and choices pointing at missing/disabled/
 * mismatched models are dropped — so a stale blob can never resolve to a bad
 * model.
 */
function sanitize(raw: unknown): ModelPreferences {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_PREFERENCES };
  const obj = raw as Record<string, unknown>;
  const mode: ModelMode = obj.mode === "manual" ? "manual" : "auto";
  const choices: Partial<Record<ModelTask, string>> = {};
  const rawChoices = obj.choices;
  if (rawChoices && typeof rawChoices === "object") {
    for (const [task, id] of Object.entries(rawChoices as Record<string, unknown>)) {
      if (VALID_TASKS.has(task) && isValidChoice(task as ModelTask, id)) {
        choices[task as ModelTask] = id;
      }
    }
  }
  return { mode, choices };
}

/** Read the user's preferences, defaulting to { mode:"auto", choices:{} }. */
export function readModelPreferences(userId: string): ModelPreferences {
  const row = db
    .select({ modelPreferences: userPreferences.modelPreferences })
    .from(userPreferences)
    .where(eq(userPreferences.userId, userId))
    .get();
  if (!row?.modelPreferences) return { ...DEFAULT_PREFERENCES };
  try {
    return sanitize(JSON.parse(row.modelPreferences));
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

/**
 * Validate + persist. Throws on an invalid mode or on a choice that isn't a
 * real enabled model for its task. Upserts the userPreferences row so the
 * column can be set even before onboarding has created one.
 */
export function writeModelPreferences(userId: string, prefs: ModelPreferences): void {
  if (prefs.mode !== "auto" && prefs.mode !== "manual") {
    throw new Error(`invalid model mode: ${String(prefs.mode)}`);
  }
  const choices: Partial<Record<ModelTask, string>> = {};
  for (const [task, id] of Object.entries(prefs.choices ?? {})) {
    if (!VALID_TASKS.has(task)) {
      throw new Error(`unknown model task: ${task}`);
    }
    if (!isValidChoice(task as ModelTask, id)) {
      throw new Error(`invalid model choice for ${task}: ${String(id)}`);
    }
    choices[task as ModelTask] = id;
  }

  const clean: ModelPreferences = { mode: prefs.mode, choices };
  const json = JSON.stringify(clean);
  const now = new Date();

  const existing = db
    .select({ userId: userPreferences.userId })
    .from(userPreferences)
    .where(eq(userPreferences.userId, userId))
    .get();

  if (existing) {
    db.update(userPreferences)
      .set({ modelPreferences: json, updatedAt: now })
      .where(eq(userPreferences.userId, userId))
      .run();
  } else {
    db.insert(userPreferences).values({ userId, modelPreferences: json, updatedAt: now }).run();
  }
}

/**
 * Turn a (task, prefs) pair into the concrete model to use:
 *   - manual mode + a valid enabled choice for the task → that model
 *   - otherwise (auto mode, or no/invalid choice) → defaultModelForTask(task)
 */
export function resolveModelForTask(
  task: ModelTask,
  prefs: ModelPreferences,
): ModelEntry | undefined {
  if (prefs.mode === "manual") {
    const id = prefs.choices[task];
    if (id && isValidChoice(task, id)) {
      return getModel(id);
    }
  }
  return defaultModelForTask(task);
}
