"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type PromptSurface = "agent" | "voiceover";

interface PromptHistoryStore {
	prompts: Record<PromptSurface, string[]>;
	pinned: Record<PromptSurface, string[]>;
	push: (surface: PromptSurface, prompt: string) => void;
	clear: (surface: PromptSurface) => void;
	pin: (surface: PromptSurface, prompt: string) => void;
	unpin: (surface: PromptSurface, prompt: string) => void;
	isPinned: (surface: PromptSurface, prompt: string) => boolean;
}

const MAX_PER_SURFACE = 10;
const MAX_PINNED = 5;

/**
 * Per-surface ring of the last N prompts the user typed. Surfaces show
 * them as suggestion chips when the input is empty, so users don't
 * lose phrases that worked. A separate `pinned` list keeps prompts the
 * user explicitly starred so they stay visible regardless of recency.
 */
export const usePromptHistoryStore = create<PromptHistoryStore>()(
	persist(
		(set, get) => ({
			prompts: { agent: [], voiceover: [] },
			pinned: { agent: [], voiceover: [] },
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
			pin: (surface, prompt) =>
				set((s) => {
					const trimmed = prompt.trim();
					if (!trimmed) return s;
					const prev = s.pinned[surface] ?? [];
					if (prev.includes(trimmed)) return s;
					const next = [trimmed, ...prev].slice(0, MAX_PINNED);
					return { pinned: { ...s.pinned, [surface]: next } };
				}),
			unpin: (surface, prompt) =>
				set((s) => ({
					pinned: {
						...s.pinned,
						[surface]: (s.pinned[surface] ?? []).filter((p) => p !== prompt),
					},
				})),
			isPinned: (surface, prompt) =>
				(get().pinned[surface] ?? []).includes(prompt.trim()),
		}),
		{
			name: "vibeedit-prompt-history",
			storage: createJSONStorage(() => localStorage),
			version: 2,
			migrate: (state, version) => {
				// v1 had no `pinned`; backfill empty per-surface arrays.
				const s = (state ?? {}) as Partial<PromptHistoryStore>;
				if (version < 2 && !s.pinned) {
					s.pinned = { agent: [], voiceover: [] };
				}
				return s as PromptHistoryStore;
			},
		},
	),
);
