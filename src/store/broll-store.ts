import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { BRollPosition } from "@/lib/scene-schema";
import type { SearchResult } from "@/lib/broll-search";

export interface SceneSuggestion {
  sceneId: string;
  keywords: string[];
  position: BRollPosition;
  kindPreference: string;
  rationale: string;
  clips: SearchResult[];
  images: SearchResult[];
  gifs: SearchResult[];
}

interface BRollStore {
  suggestions: Record<string, SceneSuggestion>;
  isLoading: boolean;
  error: string | null;
  setSuggestions: (list: SceneSuggestion[]) => void;
  clearSuggestion: (sceneId: string) => void;
  setLoading: (v: boolean) => void;
  setError: (e: string | null) => void;
}

export const useBRollStore = create<BRollStore>()(
  persist(
    (set) => ({
      suggestions: {},
      isLoading: false,
      error: null,
      setSuggestions: (list) =>
        set({
          suggestions: Object.fromEntries(list.map((s) => [s.sceneId, s])),
        }),
      clearSuggestion: (sceneId) =>
        set((s) => {
          const { [sceneId]: _drop, ...rest } = s.suggestions;
          void _drop;
          return { suggestions: rest };
        }),
      setLoading: (v) => set({ isLoading: v }),
      setError: (e) => set({ error: e }),
    }),
    {
      name: "vibeedit-broll",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ suggestions: s.suggestions }),
    },
  ),
);
