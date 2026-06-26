/**
 * Project edit-state — the "recipe" the AI rewrites, persisted so "edit by
 * talking" can iterate conversationally ("undo that", "make it tighter", "swap
 * those two"). Wraps the existing EditDecisionList (the thing render_edl already
 * consumes) and keeps a revision history of prior EDLs so undo is trivial.
 *
 * Asset manifests describe the ingredients; this describes the recipe; the
 * render is the build. See docs/vibe-edit-asset-model.md.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { projectDir, writeProjectFile } from "./fs";
import type { EditDecisionList } from "../ai/ffmpeg-tools";

export interface EditRevision {
  at: string;
  intent: string; // what the user asked for, e.g. "remove filler"
  edl: EditDecisionList; // snapshot of the EDL BEFORE this change (for undo)
}

export interface ProjectState {
  version: 1;
  projectId: string;
  mode?: "edit" | "build";
  personaRef?: string;
  edl: EditDecisionList; // current
  revisions: EditRevision[]; // prior EDLs, newest last
}

const STATE_FILE = "project.json";

function stateAbsPath(userId: string, projectId: string): string {
  return join(projectDir(userId, projectId), STATE_FILE);
}

export function readProjectState(userId: string, projectId: string): ProjectState | null {
  const file = stateAbsPath(userId, projectId);
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, "utf8")) as ProjectState;
  } catch {
    return null;
  }
}

function writeProjectState(userId: string, projectId: string, state: ProjectState): void {
  writeProjectFile(userId, projectId, STATE_FILE, JSON.stringify(state, null, 2));
}

// Assign stable s1/s2/… ids to any segment missing one, so chat can address
// individual cuts. Existing ids are preserved.
function withSegmentIds(edl: EditDecisionList): EditDecisionList {
  let n = 0;
  const used = new Set(edl.segments.map((s) => s.id).filter(Boolean) as string[]);
  const nextId = (): string => {
    let id: string;
    do {
      id = `s${++n}`;
    } while (used.has(id));
    used.add(id);
    return id;
  };
  return { ...edl, segments: edl.segments.map((s) => ({ ...s, id: s.id || nextId() })) };
}

/**
 * Persist a new EDL as the project's current edit-state, pushing the previous
 * EDL onto the revision stack (so it can be undone). Returns the saved state.
 */
export function applyEdit(
  userId: string,
  projectId: string,
  edl: EditDecisionList,
  intent: string,
  meta?: { mode?: "edit" | "build"; personaRef?: string },
): ProjectState {
  const prev = readProjectState(userId, projectId);
  const revisions = prev?.revisions ?? [];
  if (prev) {
    revisions.push({ at: new Date().toISOString(), intent, edl: prev.edl });
  }
  const state: ProjectState = {
    version: 1,
    projectId,
    mode: meta?.mode ?? prev?.mode,
    personaRef: meta?.personaRef ?? prev?.personaRef,
    edl: withSegmentIds(edl),
    revisions,
  };
  writeProjectState(userId, projectId, state);
  return state;
}

/**
 * Revert to the previous EDL. Returns the restored state, or null if there is
 * nothing to undo.
 */
export function undoEdit(userId: string, projectId: string): ProjectState | null {
  const state = readProjectState(userId, projectId);
  if (!state || state.revisions.length === 0) return null;
  const last = state.revisions.pop()!;
  state.edl = last.edl;
  writeProjectState(userId, projectId, state);
  return state;
}

// Human-readable one-liner about the current edit-state.
export function describeState(state: ProjectState): string {
  const segs = state.edl.segments.length;
  const total = state.edl.segments.reduce(
    (s, seg) => s + (seg.end - seg.start) / (seg.speed ?? 1),
    0,
  );
  const overlays = state.edl.overlays?.length ?? 0;
  const caps = state.edl.captions?.length ?? 0;
  return `${segs} segment(s), ~${total.toFixed(1)}s${overlays ? `, ${overlays} overlay(s)` : ""}${caps ? `, ${caps} caption(s)` : ""} · ${state.revisions.length} undo step(s) available`;
}
