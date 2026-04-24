import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type LibraryAssetKind = "music" | "sfx" | "clip" | "image";

export interface LibraryAsset {
  id: string;
  kind: LibraryAssetKind;
  url: string;
  name: string;
  tags: string[];
  addedAt: number;
  bytes?: number;
}

interface AssetLibraryStore {
  assets: LibraryAsset[];
  add: (asset: Omit<LibraryAsset, "id" | "addedAt">) => LibraryAsset;
  remove: (id: string) => void;
  addTag: (id: string, tag: string) => void;
  removeTag: (id: string, tag: string) => void;
}

export const useAssetLibraryStore = create<AssetLibraryStore>()(
  persist(
    (set) => ({
      assets: [],
      add: (asset) => {
        const entry: LibraryAsset = {
          id: `asset_${Math.random().toString(36).slice(2, 10)}`,
          addedAt: Date.now(),
          ...asset,
        };
        set((s) => ({ assets: [...s.assets, entry] }));
        return entry;
      },
      remove: (id) =>
        set((s) => ({ assets: s.assets.filter((a) => a.id !== id) })),
      addTag: (id, tag) =>
        set((s) => ({
          assets: s.assets.map((a) =>
            a.id === id && !a.tags.includes(tag)
              ? { ...a, tags: [...a.tags, tag] }
              : a,
          ),
        })),
      removeTag: (id, tag) =>
        set((s) => ({
          assets: s.assets.map((a) =>
            a.id === id ? { ...a, tags: a.tags.filter((t) => t !== tag) } : a,
          ),
        })),
    }),
    {
      name: "vibeedit-asset-library",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
