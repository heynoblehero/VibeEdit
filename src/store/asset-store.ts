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
  // Original semantic-named set — pose by emotion / framing.
  { id: "watch", name: "Watch", src: "/characters/isaac-watch.png" },
  { id: "point", name: "Point", src: "/characters/isaac-point.png" },
  { id: "celebrate", name: "Celebrate", src: "/characters/isaac-celebrate.png" },
  { id: "frustrated", name: "Frustrated", src: "/characters/isaac-frustrated.png" },
  { id: "tablet", name: "Tablet", src: "/characters/isaac-tablet.png" },
  { id: "shrug", name: "Shrug", src: "/characters/isaac-shrug.png" },
  { id: "hero", name: "Hero", src: "/characters/isaac-hero.png" },
  { id: "wide", name: "Wide", src: "/characters/isaac-wide.png" },
  { id: "closeup", name: "Closeup", src: "/characters/isaac-closeup.png" },
  // Issac Pack — second pose set imported from the AE-style asset bundle.
  // Numeric naming preserved from the source pack; keep ids prefixed so
  // they can never collide with the semantic set above.
  { id: "issac-pack-1", name: "Issac Pack 1", src: "/characters/issac-pack/issac-1.png" },
  { id: "issac-pack-2", name: "Issac Pack 2", src: "/characters/issac-pack/issac-2.png" },
  { id: "issac-pack-3", name: "Issac Pack 3", src: "/characters/issac-pack/issac-3.png" },
  { id: "issac-pack-4", name: "Issac Pack 4", src: "/characters/issac-pack/issac-4.png" },
  { id: "issac-pack-5", name: "Issac Pack 5", src: "/characters/issac-pack/issac-5.png" },
  { id: "issac-pack-6", name: "Issac Pack 6", src: "/characters/issac-pack/issac-6.png" },
  { id: "issac-pack-7", name: "Issac Pack 7", src: "/characters/issac-pack/issac-7.png" },
  { id: "issac-pack-8", name: "Issac Pack 8", src: "/characters/issac-pack/issac-8.png" },
  { id: "issac-pack-9", name: "Issac Pack 9", src: "/characters/issac-pack/issac-9.png" },
];

const DEFAULT_SFX: SfxAsset[] = [
  // Original picks.
  { id: "swoosh1", name: "Swoosh 1", src: "/sfx/swoosh-2-359826.mp3" },
  { id: "swoosh2", name: "Swoosh 2", src: "/sfx/swoosh-5-359829.mp3" },
  { id: "click1", name: "Click", src: "/sfx/click-234708.mp3" },
  { id: "click2", name: "Gear Click", src: "/sfx/gear-click-351962.mp3" },
  { id: "riser", name: "Riser", src: "/sfx/SFX - Riser Metallic (Transition).mp3" },
  { id: "distortion", name: "Distortion", src: "/sfx/Distortion Sound Effect.mp3" },
  // Issac Pack — 13 SFX from the AE-style asset bundle.
  { id: "issac-pack-camera-shutter-1", name: "Camera Shutter 1 — Issac", src: "/sfx/issac-pack/camera-shutter-1.mp3" },
  { id: "issac-pack-camera-shutter-2", name: "Camera Shutter 2 — Issac", src: "/sfx/issac-pack/camera-shutter-2.mp3" },
  { id: "issac-pack-click-1", name: "Click — Issac", src: "/sfx/issac-pack/click-1.mp3" },
  { id: "issac-pack-click-tap", name: "Click Tap — Issac", src: "/sfx/issac-pack/click-tap.mp3" },
  { id: "issac-pack-mouse-click-1", name: "Mouse Click 1 — Issac", src: "/sfx/issac-pack/mouse-click-1.mp3" },
  { id: "issac-pack-mouse-click-2", name: "Mouse Click 2 — Issac", src: "/sfx/issac-pack/mouse-click-2.mp3" },
  { id: "issac-pack-gear-click", name: "Gear Click — Issac", src: "/sfx/issac-pack/gear-click.mp3" },
  { id: "issac-pack-distortion", name: "Distortion — Issac", src: "/sfx/issac-pack/distortion.mp3" },
  { id: "issac-pack-riser", name: "Riser — Issac", src: "/sfx/issac-pack/riser.mp3" },
  { id: "issac-pack-riser-metallic", name: "Riser Metallic — Issac", src: "/sfx/issac-pack/riser-metallic.mp3" },
  { id: "issac-pack-swoosh-1", name: "Swoosh 1 — Issac", src: "/sfx/issac-pack/swoosh-1.mp3" },
  { id: "issac-pack-swoosh-2", name: "Swoosh 2 — Issac", src: "/sfx/issac-pack/swoosh-2.mp3" },
  { id: "issac-pack-typing", name: "Typing — Issac", src: "/sfx/issac-pack/typing.mp3" },
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
      // Bump when DEFAULT_CHARACTERS / DEFAULT_SFX gain entries that
      // existing localStorage rolls won't have. The migrate step
      // backfills any hardcoded id that's missing — user-added items
      // (via addCharacter / addSfx) are preserved.
      version: 2,
      migrate: (persisted, _from) => {
        const state = persisted as Partial<AssetStore> | null;
        if (!state) return { characters: DEFAULT_CHARACTERS, sfx: DEFAULT_SFX };
        const seenChars = new Set((state.characters ?? []).map((c) => c.id));
        const seenSfx = new Set((state.sfx ?? []).map((s) => s.id));
        return {
          ...state,
          characters: [
            ...(state.characters ?? []),
            ...DEFAULT_CHARACTERS.filter((d) => !seenChars.has(d.id)),
          ],
          sfx: [
            ...(state.sfx ?? []),
            ...DEFAULT_SFX.filter((d) => !seenSfx.has(d.id)),
          ],
        };
      },
    },
  ),
);
