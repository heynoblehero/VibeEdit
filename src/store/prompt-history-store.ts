"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type PromptSurface = "animate" | "agent" | "voiceover";

interface PromptHistoryStore {
	prompts: Record<PromptSurface, string[]>;
	push: (surface: PromptSurface, prompt: string) => void;
	clear: (surface: PromptSurface) => void;
}

const MAX_PER_SURFACE = 10;

/**
 * Per-surface ring of the last N prompts the user typed. Surfaces show
 * them as suggestion chips when the input is empty, so users don't
 * lose phrases that worked.
 */
export const usePromptHistoryStore = create<PromptHistoryStore>()(
	persist(
		(set) => ({
			prompts: { animate: [], agent: [], voiceover: [] },
			push: (surface, prompt) =>
				set((s) => {
					const trimmed = prompt.trim();
					if (!trimmed) return s;
					const prev = s.prompts[surface] ?? [];
					// Dedupe — bump existing match to top instead of duplicating.
					const filtered = prev.filter((p) => p !== trimmed);
					const next = [trimmed, ...filtered].slice(0, MAX_PER_SURFACE);
					return { prompts: { ...s.prompts, [surface]: next } };
				}),
			clear: (surface) =>
				set((s) => ({ prompts: { ...s.prompts, [surface]: [] } })),
		}),
		{
			name: "vibeedit-prompt-history",
			storage: createJSONStorage(() => localStorage),
		},
	),
);
