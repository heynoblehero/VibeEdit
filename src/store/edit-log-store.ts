"use client";

/**
 * Manual-edit log — the awareness layer that lets the agent know what
 * the user just changed by hand. Sprint-21 sync work.
 *
 * Both the agent and manual UI mutate the same Project (via
 * useProjectStore), so state itself is already in sync. The gap was
 * "did the agent notice?". This store subscribes to project changes,
 * skips them while the agent is streaming (those are agent edits, not
 * manual), and coalesces same-field edits within a 5s window so a
 * burst of typing collapses into one entry. ChatSidebar attaches the
 * recent N entries to /api/agent on every send; the route folds them
 * into the system prompt so the agent treats them as user intent to
 * preserve.
 */

import { create } from "zustand";
import type { Scene } from "@/lib/scene-schema";
import { useChatStore } from "./chat-store";
import { useProjectStore } from "./project-store";

export interface ManualEdit {
  sceneId: string;
  sceneIndex: number;
  field: string;
  oldValue: string | number | null;
  newValue: string | number | null;
  at: number;
}

interface EditLogStore {
  entries: ManualEdit[];
  push: (e: Omit<ManualEdit, "at">) => void;
  clear: () => void;
  getRecent: (n: number) => ManualEdit[];
}

const COALESCE_MS = 5_000;
const MAX_ENTRIES = 50;

export const useEditLogStore = create<EditLogStore>((set, get) => ({
  entries: [],
  push: (e) =>
    set((s) => {
      const now = Date.now();
      const last = s.entries[s.entries.length - 1];
      if (
        last &&
        last.sceneId === e.sceneId &&
        last.field === e.field &&
        now - last.at < COALESCE_MS
      ) {
        const merged: ManualEdit = { ...last, newValue: e.newValue, at: now };
        return { entries: [...s.entries.slice(0, -1), merged] };
      }
      const next = [...s.entries, { ...e, at: now }];
      return { entries: next.slice(-MAX_ENTRIES) };
    }),
  clear: () => set({ entries: [] }),
  getRecent: (n) => get().entries.slice(-n),
}));

// Tracked fields — the ones a user actually edits manually. Computed/
// agent-owned fields (effects[], cuts, motion presets, qualityScore) are
// intentionally excluded — the diff log isn't a full audit, it's a
// "what did the user just type / nudge" signal.
const TRACKED_FIELDS = [
  "text",
  "emphasisText",
  "subtitleText",
  "duration",
  "label",
  "characterId",
] as const;

function readField(s: Scene, field: string): string | number | null {
  const v = (s as unknown as Record<string, unknown>)[field];
  if (typeof v === "string" || typeof v === "number") return v;
  return null;
}

if (typeof window !== "undefined") {
  let lastScenes: Scene[] = useProjectStore.getState().project.scenes;
  useProjectStore.subscribe((state) => {
    const next = state.project.scenes;
    if (next === lastScenes) return;
    // Skip diffing while the agent is writing — those are agent edits.
    if (useChatStore.getState().isStreaming) {
      lastScenes = next;
      return;
    }
    const oldById = new Map(lastScenes.map((s) => [s.id, s]));
    next.forEach((s, idx) => {
      const old = oldById.get(s.id);
      if (!old) return; // brand-new scene — manual creation, but no field-level edit to log
      for (const field of TRACKED_FIELDS) {
        const oldVal = readField(old, field);
        const newVal = readField(s, field);
        if (oldVal !== newVal) {
          useEditLogStore.getState().push({
            sceneId: s.id,
            sceneIndex: idx,
            field,
            oldValue: oldVal,
            newValue: newVal,
          });
        }
      }
    });
    lastScenes = next;
  });
}

/** Format the recent edits as a compact bullet list for the agent's
 *  system block. Returns null when there's nothing recent. */
export function formatRecentEditsForAgent(
  entries: ManualEdit[],
): string | null {
  if (entries.length === 0) return null;
  const lines = entries.map((e) => {
    const truncate = (v: unknown) => {
      const s = String(v ?? "");
      return s.length > 60 ? `${s.slice(0, 57)}…` : s;
    };
    return `· scene ${e.sceneIndex + 1} (${e.sceneId}) · ${e.field}: "${truncate(
      e.oldValue,
    )}" → "${truncate(e.newValue)}"`;
  });
  return lines.join("\n");
}
