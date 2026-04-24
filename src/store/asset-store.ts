import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export interface CharacterAsset {
  id: string;
  name: string;
  src: string;
}

export interface SfxAsset {
  id: string;
  name: string;
  src: string;
}

interface AssetStore {
  characters: CharacterAsset[];
  sfx: SfxAsset[];
  addCharacter: (asset: CharacterAsset) => void;
  removeCharacter: (id: string) => void;
  addSfx: (asset: SfxAsset) => void;
  loadDefaults: () => void;
}

const DEFAULT_CHARACTERS: CharacterAsset[] = [
  { id: "watch", name: "Watch", src: "/characters/isaac-watch.png" },
  { id: "point", name: "Point", src: "/characters/isaac-point.png" },
  { id: "celebrate", name: "Celebrate", src: "/characters/isaac-celebrate.png" },
  { id: "frustrated", name: "Frustrated", src: "/characters/isaac-frustrated.png" },
  { id: "tablet", name: "Tablet", src: "/characters/isaac-tablet.png" },
  { id: "shrug", name: "Shrug", src: "/characters/isaac-shrug.png" },
  { id: "hero", name: "Hero", src: "/characters/isaac-hero.png" },
  { id: "wide", name: "Wide", src: "/characters/isaac-wide.png" },
  { id: "closeup", name: "Closeup", src: "/characters/isaac-closeup.png" },
];

const DEFAULT_SFX: SfxAsset[] = [
  { id: "swoosh1", name: "Swoosh 1", src: "/sfx/swoosh-2-359826.mp3" },
  { id: "swoosh2", name: "Swoosh 2", src: "/sfx/swoosh-5-359829.mp3" },
  { id: "click1", name: "Click", src: "/sfx/click-234708.mp3" },
  { id: "click2", name: "Gear Click", src: "/sfx/gear-click-351962.mp3" },
  { id: "riser", name: "Riser", src: "/sfx/SFX - Riser Metallic (Transition).mp3" },
  { id: "distortion", name: "Distortion", src: "/sfx/Distortion Sound Effect.mp3" },
];

export const useAssetStore = create<AssetStore>()(
  persist(
    (set) => ({
      characters: DEFAULT_CHARACTERS,
      sfx: DEFAULT_SFX,
      addCharacter: (asset) =>
        set((s) => ({ characters: [...s.characters, asset] })),
      removeCharacter: (id) =>
        set((s) => ({ characters: s.characters.filter((c) => c.id !== id) })),
      addSfx: (asset) =>
        set((s) => ({ sfx: [...s.sfx, asset] })),
      loadDefaults: () =>
        set({ characters: DEFAULT_CHARACTERS, sfx: DEFAULT_SFX }),
    }),
    {
      name: "vibeedit-assets",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
