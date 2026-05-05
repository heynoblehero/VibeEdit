"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type ActivityKind =
	| "ai-edit"
	| "scene-add"
	| "scene-delete"
	| "voiceover"
	| "render"
	| "import"
	| "manual";

export interface ActivityEvent {
	id: string;
	projectId: string;
	kind: ActivityKind;
	label: string;
	at: number;
}

interface ActivityStore {
	events: Record<string, ActivityEvent[]>;
	log: (event: Omit<ActivityEvent, "id" | "at"> & { at?: number }) => void;
	clear: (projectId: string) => void;
}

const MAX_PER_PROJECT = 20;

/**
 * Project-scoped activity feed — a small ring buffer of human-readable
 * events surfaced under the project name in the editor topbar. Lets
 * users glance at "AI added 3 scenes · 2m ago" so nothing happens
 * behind their back. Persisted via the standard adapter so events
 * survive reloads.
 *
 * This is intentionally separate from the undo/redo history (which is
 * snapshot-based and per-edit) — activity tracks "what just happened"
 * at a higher abstraction.
 */
export const useActivityStore = create<ActivityStore>()(
	persist(
		(set) => ({
			events: {},
			log: (event) =>
				set((s) => {
					const prev = s.events[event.projectId] ?? [];
					const next: ActivityEvent = {
						id: `act_${Math.random().toString(36).slice(2, 10)}`,
						at: event.at ?? Date.now(),
						projectId: event.projectId,
						kind: event.kind,
						label: event.label,
					};
					const list = [next, ...prev].slice(0, MAX_PER_PROJECT);
					return { events: { ...s.events, [event.projectId]: list } };
				}),
			clear: (projectId) =>
				set((s) => {
					const events = { ...s.events };
					delete events[projectId];
					return { events };
				}),
		}),
		{
			name: "vibeedit-activity",
			storage: createJSONStorage(() => localStorage),
		},
	),
);
