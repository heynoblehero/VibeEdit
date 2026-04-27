/**
 * Base 7-scene ~100s project shared by tiers 2–6. Seed cases that test
 * editing operations need a known-good initial state — this is it.
 *
 * Scenes follow a hook → 5 tip → CTA shape. Each has a known character
 * pose, SFX, and overlay choice so tier-2/4/6 assertions have stable
 * fixtures to point at.
 */

import type { Project, Scene } from "../../../src/lib/scene-schema";
import { ISAAC_ASSET_INDEX } from "../../fixtures/isaac-asset-index";

const ASSET_BASE = "file:///home/ishaan/Projects/LIVE_PRODUCTS/VibeEdit/eval/fixtures/isaac-pack";

function asset(path: string): string {
  return `${ASSET_BASE}/${path}`;
}

function scene(
  id: string,
  text: string,
  duration: number,
  characterPath: string,
  bgPath: string,
  sfxPath: string | null = null,
  emphasisText?: string,
): Scene {
  const s: Record<string, unknown> = {
    id,
    type: "character_text",
    duration,
    text,
    background: { imageUrl: asset(bgPath) },
    characterUrl: asset(characterPath),
  };
  if (sfxPath) s.sceneSfxUrl = asset(sfxPath);
  if (emphasisText) s.emphasisText = emphasisText;
  return s as unknown as Scene;
}

const SCENES: Scene[] = [
  // 1 · Hook
  scene(
    "scn-1",
    "Most editors waste 80% of their time",
    3.5,
    "Characters/Isaac8.png",
    "Graphics/Gradient1.png",
    "SFX/camera-shutter-314056.mp3",
    "WASTE",
  ),
  // 2 · Setup
  scene(
    "scn-2",
    "Here's why and how to fix it",
    2.5,
    "Characters/isaac 4.png",
    "Graphics/Gradient3.png",
    "SFX/swoosh-2-359826.mp3",
  ),
  // 3 · Tip 1
  scene(
    "scn-3",
    "Tip 1: cut your A-rolls tighter",
    3.0,
    "Characters/Isaac10.png",
    "Graphics/1.png",
    "SFX/click-234708.mp3",
  ),
  // 4 · Tip 2
  scene(
    "scn-4",
    "Tip 2: stack motion graphics on emphasis beats",
    3.0,
    "Characters/isaac 1.png",
    "Graphics/2 1.png",
    "SFX/typing-274133.mp3",
  ),
  // 5 · Tip 3
  scene(
    "scn-5",
    "Tip 3: drop a swoosh on every transition",
    2.8,
    "Characters/isaac 7.png",
    "Graphics/3.png",
    "SFX/swoosh-5-359829.mp3",
  ),
  // 6 · Reveal
  scene(
    "scn-6",
    "Do this and your videos hit different",
    3.0,
    "Characters/isaac 3.png",
    "Graphics/Gradient7.png",
    "SFX/SFX - Riser Metallic (Transition).mp3",
    "DIFFERENT",
  ),
  // 7 · CTA
  scene(
    "scn-7",
    "Subscribe for more breakdowns",
    2.5,
    "Characters/isaac 5.png",
    "Graphics/Gradient10.png",
  ),
];

const NOW = Date.now();
const isaacUploads = ISAAC_ASSET_INDEX.map((a, i) => ({
  id: `upl-${i}`,
  name: a.path.split("/").pop()!,
  url: `${ASSET_BASE}/${a.path}`,
  type:
    a.kind === "character" || a.kind === "graphic"
      ? "image/png"
      : a.kind === "overlay"
        ? "video/mp4"
        : "audio/mpeg",
  uploadedAt: NOW,
}));

/** Returns a fresh structural clone — don't share refs across cases. */
export function baseProject(): Project {
  return JSON.parse(
    JSON.stringify({
      id: "base-7scene",
      name: "Eval Base — 7-scene Isaac clip",
      script: "",
      scenes: SCENES,
      fps: 30,
      width: 1080,
      height: 1920,
      uploads: isaacUploads,
    }),
  ) as Project;
}

export const BASE_SCENE_IDS = SCENES.map((s) => s.id);
