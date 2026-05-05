import { create } from "zustand";

export type AiTaskKind = "chat" | "voiceover" | "image" | "animation" | "render" | "transcribe";

export interface AiTask {
	id: string;
	kind: AiTaskKind;
	label: string;
	startedAt: number;
}

interface AiStatusStore {
	tasks: AiTask[];
	/** Aggregate USD spend for the current session, in cents to avoid
	 *  float drift. Resets on hard reload. */
	spendCents: number;
	start: (task: Omit<AiTask, "startedAt"> & { startedAt?: number }) => void;
	end: (id: string) => void;
	addSpend: (usd: number) => void;
	clear: () => void;
}

/**
 * Aggregates in-flight AI work across the whole app — chat, voiceover,
 * image gen, animation, render, transcription. Components dispatch
 * `start` when they kick off a job and `end` when it settles. The
 * global indicator in the header shows a pulse whenever `tasks` is
 * non-empty, with a tooltip listing what's running. Surfaces stay
 * decoupled — they call `start/end` and forget.
 */
export const useAiStatusStore = create<AiStatusStore>((set) => ({
	tasks: [],
	spendCents: 0,
	start: (t) =>
		set((s) => ({
			tasks: [...s.tasks, { ...t, startedAt: t.startedAt ?? Date.now() }],
		})),
	end: (id) => set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) })),
	addSpend: (usd) =>
		set((s) => ({ spendCents: s.spendCents + Math.round(usd * 100 * 100) / 100 })),
	clear: () => set({ tasks: [], spendCents: 0 }),
}));
