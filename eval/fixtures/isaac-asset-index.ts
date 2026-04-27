/**
 * Hand-tagged semantic index for the Isaac Pack.
 *
 * Each entry maps a relative asset path to a list of keywords. The
 * asset-match judge looks up an asset URL the agent picked, pulls its
 * keywords, and asserts at least one keyword overlaps with the scene's
 * narration / text / mood. Ambiguous cases escalate to the LLM-judge.
 *
 * Tagging rules:
 * - "kind" is the agent-facing field type the asset gets dropped into.
 * - "keywords" should be the words a human creator would think when
 *   reaching for this asset (mood + action + content).
 * - One asset can satisfy many keywords — be generous, the judge does
 *   set-overlap not strict equality.
 *
 * If you add new poses / SFX / overlays, append entries here AND update
 * the seeds in eval/cases/seeds/ that reference them by keyword.
 */

export type AssetKind = "character" | "graphic" | "overlay" | "sfx";

export interface AssetTag {
  /** Path relative to eval/fixtures/isaac-pack/. */
  path: string;
  kind: AssetKind;
  keywords: string[];
  /** Free-text human description (used by LLM-judge as context). */
  description: string;
}

export const ISAAC_ASSET_INDEX: AssetTag[] = [
  // ── Characters ──────────────────────────────────────────────────
  {
    path: "Characters/isaac.png",
    kind: "character",
    keywords: ["waiting", "time", "checking", "watch", "delay", "patience", "neutral"],
    description: "Looking down at his wristwatch — checking time / waiting beat.",
  },
  {
    path: "Characters/isaac 1.png",
    kind: "character",
    keywords: ["pointing", "presenting", "introduce", "show", "neutral", "standing"],
    description: "Standing relaxed, one hand pointing slightly to the side — gentle presenter pose.",
  },
  {
    path: "Characters/isaac 3.png",
    kind: "character",
    keywords: ["celebrating", "victory", "win", "yes", "hype", "excited", "success", "arms-up"],
    description: "Both arms raised in victory — celebration / hype beat.",
  },
  {
    path: "Characters/isaac 4.png",
    kind: "character",
    keywords: ["pointing", "emphasis", "explain", "you", "directing", "confident", "double-point"],
    description: "Both hands pointing forward / sideways — emphatic explanation, calling out the viewer.",
  },
  {
    path: "Characters/isaac 5.png",
    kind: "character",
    keywords: ["working", "reading", "tablet", "clipboard", "studying", "focus", "research"],
    description: "Holding a tablet / clipboard — working / studying beat.",
  },
  {
    path: "Characters/isaac 7.png",
    kind: "character",
    keywords: ["thinking", "contemplating", "wondering", "considering", "fist-to-chin", "uncertain"],
    description: "Hand near face / fist near beard — thinking / contemplation beat.",
  },
  {
    path: "Characters/Isaac8.png",
    kind: "character",
    keywords: ["proud", "portrait", "formal", "confident", "hero", "intro", "profile"],
    description: "Profile portrait, suit + tie — proud / formal hero shot, ideal for intro or title.",
  },
  {
    path: "Characters/isaac 9.png",
    kind: "character",
    keywords: ["shrug", "uncertain", "i-dont-know", "confused", "questioning", "hands-up", "ambiguous"],
    description: "Shrugging with both hands open — uncertainty / 'I dunno' beat.",
  },
  {
    path: "Characters/Isaac10.png",
    kind: "character",
    keywords: ["offering", "presenting", "explaining", "open-hand", "welcoming", "introducing", "show-and-tell"],
    description: "Outstretched hand, holding a folder — offering / showing / 'here it is' beat.",
  },

  // ── Graphics (numbered) ────────────────────────────────────────
  // Numbered graphics are typically used as section headers / list markers.
  {
    path: "Graphics/1.png",
    kind: "graphic",
    keywords: ["one", "first", "step-1", "tip-1", "number", "counter"],
    description: "Stylized number 1 graphic — section / step / list-item header.",
  },
  {
    path: "Graphics/2 1.png",
    kind: "graphic",
    keywords: ["two", "second", "step-2", "tip-2", "number", "counter"],
    description: "Stylized number 2 graphic.",
  },
  {
    path: "Graphics/3.png",
    kind: "graphic",
    keywords: ["three", "third", "step-3", "tip-3", "number", "counter"],
    description: "Stylized number 3 graphic.",
  },
  {
    path: "Graphics/4.png",
    kind: "graphic",
    keywords: ["four", "fourth", "step-4", "tip-4", "number", "counter"],
    description: "Stylized number 4 graphic.",
  },
  {
    path: "Graphics/5.png",
    kind: "graphic",
    keywords: ["five", "fifth", "step-5", "tip-5", "number", "counter"],
    description: "Stylized number 5 graphic.",
  },
  {
    path: "Graphics/6.png",
    kind: "graphic",
    keywords: ["six", "sixth", "step-6", "tip-6", "number", "counter"],
    description: "Stylized number 6 graphic.",
  },

  // ── Graphics (gradients) ───────────────────────────────────────
  // Gradients are background fills — agent should pick a mood-matched one.
  // We tag them generically by warmth / cool — the LLM-judge handles
  // specific shade matching.
  ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => ({
    path: `Graphics/Gradient${n === 9 ? "9 " : n}.png`,
    kind: "graphic" as const,
    keywords: ["gradient", "background", "backdrop", "fill", "mood", "ambient"],
    description: `Color gradient backdrop variant ${n} — ambient background fill.`,
  })),

  // ── Graphics (rectangles) ──────────────────────────────────────
  {
    path: "Graphics/Rectangle1.png",
    kind: "graphic",
    keywords: ["rectangle", "box", "frame", "container", "lower-third", "callout"],
    description: "Rectangle frame — lower-third / text container / callout box.",
  },
  {
    path: "Graphics/Recatngle2.png",
    kind: "graphic",
    keywords: ["rectangle", "box", "frame", "container", "lower-third", "callout"],
    description: "Rectangle frame variant 2.",
  },

  // ── Overlays (MP4) ─────────────────────────────────────────────
  {
    path: "Overlays/Breaking Glass.mp4",
    kind: "overlay",
    keywords: ["break", "shatter", "glass", "impact", "crash", "reveal", "dramatic", "punch"],
    description: "Glass shatter overlay — dramatic reveal / impact moment.",
  },
  {
    path: "Overlays/DOWNLOAD IT !!!, ALL MY SCRIBBLE ANIMATION, download and add to you videos.mp4",
    kind: "overlay",
    keywords: ["scribble", "doodle", "annotation", "highlight", "circle", "draw", "marker", "emphasis"],
    description: "Scribble / doodle animation — handwritten emphasis on screen.",
  },
  {
    path: "Overlays/Neon Effect Black Screen _ Neon Effect Green Screen Neon Light Effect Baground _ Overlay Effect.mp4",
    kind: "overlay",
    keywords: ["neon", "glow", "light", "tech", "futuristic", "cyber", "intro", "transition"],
    description: "Neon glow effect overlay — tech / cyber / intro vibe.",
  },

  // ── SFX ────────────────────────────────────────────────────────
  {
    path: "SFX/camera-shutter-314056.mp3",
    kind: "sfx",
    keywords: ["snap", "shutter", "camera", "photo", "click", "moment", "freeze"],
    description: "Camera shutter snap — photo / freeze-frame beat.",
  },
  {
    path: "SFX/camera-shutter-6305.mp3",
    kind: "sfx",
    keywords: ["snap", "shutter", "camera", "photo", "click", "moment", "freeze"],
    description: "Camera shutter snap (variant 2).",
  },
  {
    path: "SFX/click-234708.mp3",
    kind: "sfx",
    keywords: ["click", "tap", "select", "button", "ui", "interaction"],
    description: "Generic click sound — UI / button / selection beat.",
  },
  {
    path: "SFX/click-tap-computer-mouse-352734.mp3",
    kind: "sfx",
    keywords: ["click", "mouse", "tap", "computer", "ui", "interaction"],
    description: "Mouse click — desktop / computer interaction.",
  },
  {
    path: "SFX/computer-mouse-click-351398.mp3",
    kind: "sfx",
    keywords: ["click", "mouse", "tap", "computer", "ui", "interaction"],
    description: "Mouse click variant.",
  },
  {
    path: "SFX/Distortion Sound Effect.mp3",
    kind: "sfx",
    keywords: ["distortion", "glitch", "static", "interference", "broken", "error", "warning"],
    description: "Distortion / glitch effect — broken / warning / error beat.",
  },
  {
    path: "SFX/gear-click-351962.mp3",
    kind: "sfx",
    keywords: ["click", "gear", "mechanism", "switch", "lock", "tech"],
    description: "Gear click — mechanism / switch / lock-in beat.",
  },
  {
    path: "SFX/mouse-click-290204.mp3",
    kind: "sfx",
    keywords: ["click", "mouse", "tap", "computer", "ui", "interaction"],
    description: "Mouse click variant 3.",
  },
  {
    path: "SFX/riser sound effect.mp3",
    kind: "sfx",
    keywords: ["riser", "build-up", "tension", "anticipation", "climax", "transition"],
    description: "Riser — building tension / anticipation before a reveal.",
  },
  {
    path: "SFX/SFX - Riser Metallic (Transition).mp3",
    kind: "sfx",
    keywords: ["riser", "metallic", "transition", "tension", "build-up", "swell"],
    description: "Metallic riser — transition between sections / acts.",
  },
  {
    path: "SFX/swoosh-2-359826.mp3",
    kind: "sfx",
    keywords: ["swoosh", "whoosh", "transition", "movement", "speed", "sweep"],
    description: "Swoosh — transition / fast movement / sweep beat.",
  },
  {
    path: "SFX/swoosh-5-359829.mp3",
    kind: "sfx",
    keywords: ["swoosh", "whoosh", "transition", "movement", "speed", "sweep"],
    description: "Swoosh variant 2.",
  },
  {
    path: "SFX/typing-274133.mp3",
    kind: "sfx",
    keywords: ["typing", "keyboard", "writing", "computer", "code", "work"],
    description: "Keyboard typing — writing / coding / working beat.",
  },
];

/** Lookup an asset by (full or relative) URL path. */
export function findAsset(url: string): AssetTag | null {
  const norm = url.replace(/^.*isaac-pack\//, "").replace(/\\/g, "/");
  return ISAAC_ASSET_INDEX.find((a) => a.path === norm) ?? null;
}

/** Pull just the keywords for a path. Empty array if unknown. */
export function keywordsFor(url: string): string[] {
  return findAsset(url)?.keywords ?? [];
}

/** Group all assets by kind — handy for prompt-injecting the catalog. */
export function assetsByKind(kind: AssetKind): AssetTag[] {
  return ISAAC_ASSET_INDEX.filter((a) => a.kind === kind);
}
