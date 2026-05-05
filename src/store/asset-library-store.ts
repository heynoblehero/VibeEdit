import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { assetStorage, STORAGE_KEYS } from "@/lib/storage/asset-storage";

export type LibraryAssetKind = "music" | "sfx" | "clip" | "image" | "animation";

export interface LibraryAsset {
  id: string;
  kind: LibraryAssetKind;
  url: string;
  name: string;
  tags: string[];
  addedAt: number;
  bytes?: number;
  /** For kind === "animation": the spec, so the user can re-edit
   *  later. The rendered mp4 (if any) is stored at `url`. */
  animationSpec?: import("@/lib/animate/spec").AnimationSpec;
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
      name: STORAGE_KEYS.assetLibrary,
      // Routed through the storage adapter so swapping in a DB-backed
      // implementation later is one boot-time call (setStorageAdapter).
      storage: createJSONStorage(() => assetStorage),
    },
  ),
);
