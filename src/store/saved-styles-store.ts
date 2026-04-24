import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { CaptionStyle, StylePack } from "@/lib/scene-schema";

export interface SavedStyle {
  id: string;
  name: string;
  createdAt: number;
  captionStyle?: CaptionStyle;
  stylePack?: StylePack;
  musicUrl?: string; // reference only; user must re-add the file if it was uploaded
  musicName?: string;
}

interface SavedStylesStore {
  styles: SavedStyle[];
  save: (style: Omit<SavedStyle, "id" | "createdAt">) => SavedStyle;
  remove: (id: string) => void;
  rename: (id: string, name: string) => void;
}

export const useSavedStylesStore = create<SavedStylesStore>()(
  persist(
    (set) => ({
      styles: [],
      save: (s) => {
        const entry: SavedStyle = {
          id: `style_${Math.random().toString(36).slice(2, 10)}`,
          createdAt: Date.now(),
          ...s,
        };
        set((state) => ({ styles: [...state.styles, entry] }));
        return entry;
      },
      remove: (id) =>
        set((state) => ({ styles: state.styles.filter((x) => x.id !== id) })),
      rename: (id, name) =>
        set((state) => ({
          styles: state.styles.map((x) => (x.id === id ? { ...x, name } : x)),
        })),
    }),
    {
      name: "vibeedit-saved-styles",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
