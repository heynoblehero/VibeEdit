// Caption/text overlay presets — the HTML/CSS replacement for the libass ASS
// presets in ffmpeg-tools.ts. Because the final render is the Hyperframes CLI
// running index.html (see render/queue.ts), captions are a native composition
// layer, so we get real CSS typography: variable weight, text-stroke, gradient
// fills, glow, and GSAP word-pop — none of which libass could do.
//
// Two families the agent picks by niche:
//   - "word-pop": big, bold, 1-2 words at a time, active word scaled/highlighted
//     (shorts / hooks / social — the Captions/Opus/Hormozi look)
//   - "minimal": smaller, full phrases, subtle pill, bottom-center
//     (interviews / documentary / corporate)

export type CaptionFamily = "word-pop" | "minimal";

// Parity presets mirror the five libass looks 1:1 (no visual regression); the
// premium presets show off what HTML unlocks.
export type CaptionPresetId =
  | "clean"
  | "bold"
  | "karaoke"
  | "minimal"
  | "documentary"
  | "gradient"
  | "glow"
  | "spring";

export interface CaptionOverlayPreset {
  id: CaptionPresetId;
  family: CaptionFamily;
  /** Fraction of composition HEIGHT → font-size px (matches ASS fontScale). */
  fontScale: number;
  fontFamily: string;
  fontWeight: number;
  uppercase: boolean;
  letterSpacingEm: number;
  /** Solid fill color (CSS). Ignored when `gradient` is set. */
  fillColor: string;
  /** Optional CSS gradient applied as a clipped text fill (premium). */
  gradient?: string;
  /** Active-word color for word-pop families (the highlighted current word). */
  activeColor?: string;
  /** Text outline width as a fraction of font-size; 0 disables the stroke. */
  strokeScale: number;
  strokeColor: string;
  /** Extra CSS text-shadow (drop shadow and/or glow). */
  textShadow?: string;
  /** Optional background pill behind the text. */
  pill?: { color: string; padXEm: number; padYEm: number; radiusEm: number };
  /** Vertical anchor of the caption block. */
  position: "bottom" | "center";
  /** Distance from the anchored edge as a fraction of composition HEIGHT. */
  marginVScale: number;
  /** Caption block max width as a fraction of composition WIDTH. */
  maxWidthScale: number;
  /** Per-word scale-in pop (the "produced" feel). */
  pop: boolean;
}

export const CAPTION_PRESETS: Record<CaptionPresetId, CaptionOverlayPreset> = {
  // ── Parity with the libass presets ──────────────────────────────────────
  clean: {
    id: "clean",
    family: "minimal",
    fontScale: 0.05,
    fontFamily: '"Inter", "Liberation Sans", system-ui, sans-serif',
    fontWeight: 700,
    uppercase: false,
    letterSpacingEm: 0,
    fillColor: "#ffffff",
    strokeScale: 0.06,
    strokeColor: "#000000",
    textShadow: "0 2px 6px rgba(0,0,0,0.55)",
    position: "bottom",
    marginVScale: 0.06,
    maxWidthScale: 0.86,
    pop: false,
  },
  bold: {
    id: "bold",
    family: "word-pop",
    fontScale: 0.075,
    fontFamily: '"Inter", "Liberation Sans", system-ui, sans-serif',
    fontWeight: 900,
    uppercase: true,
    letterSpacingEm: 0.01,
    fillColor: "#ffffff",
    activeColor: "#d4ff3a",
    strokeScale: 0.11,
    strokeColor: "#000000",
    textShadow: "0 3px 10px rgba(0,0,0,0.6)",
    position: "bottom",
    marginVScale: 0.1,
    maxWidthScale: 0.82,
    pop: true,
  },
  karaoke: {
    id: "karaoke",
    family: "word-pop",
    fontScale: 0.072,
    fontFamily: '"Inter", "Liberation Sans", system-ui, sans-serif',
    fontWeight: 900,
    uppercase: true,
    letterSpacingEm: 0.01,
    fillColor: "#ffdd00",
    activeColor: "#ffffff",
    strokeScale: 0.11,
    strokeColor: "#000000",
    textShadow: "0 3px 10px rgba(0,0,0,0.6)",
    position: "center",
    marginVScale: 0,
    maxWidthScale: 0.82,
    pop: true,
  },
  minimal: {
    id: "minimal",
    family: "minimal",
    fontScale: 0.038,
    fontFamily: '"Inter", "Liberation Sans", system-ui, sans-serif',
    fontWeight: 500,
    uppercase: false,
    letterSpacingEm: 0,
    fillColor: "#ffffff",
    strokeScale: 0.04,
    strokeColor: "#000000",
    textShadow: "0 1px 4px rgba(0,0,0,0.5)",
    position: "bottom",
    marginVScale: 0.05,
    maxWidthScale: 0.8,
    pop: false,
  },
  documentary: {
    id: "documentary",
    family: "minimal",
    fontScale: 0.042,
    fontFamily: '"Georgia", "Liberation Serif", serif',
    fontWeight: 600,
    uppercase: false,
    letterSpacingEm: 0,
    fillColor: "#ffffff",
    strokeScale: 0,
    strokeColor: "#000000",
    textShadow: "0 2px 8px rgba(0,0,0,0.7)",
    pill: { color: "rgba(0,0,0,0.42)", padXEm: 0.5, padYEm: 0.2, radiusEm: 0.25 },
    position: "bottom",
    marginVScale: 0.06,
    maxWidthScale: 0.7,
    pop: false,
  },
  // ── Premium — showcase what HTML unlocks ────────────────────────────────
  gradient: {
    id: "gradient",
    family: "word-pop",
    fontScale: 0.078,
    fontFamily: '"Inter", "Liberation Sans", system-ui, sans-serif',
    fontWeight: 900,
    uppercase: true,
    letterSpacingEm: 0.01,
    fillColor: "#ffffff",
    gradient: "linear-gradient(180deg, #ffffff 0%, #d4ff3a 100%)",
    activeColor: "#d4ff3a",
    strokeScale: 0.09,
    strokeColor: "#0a0a0a",
    textShadow: "0 4px 14px rgba(0,0,0,0.55)",
    position: "bottom",
    marginVScale: 0.1,
    maxWidthScale: 0.82,
    pop: true,
  },
  glow: {
    id: "glow",
    family: "word-pop",
    fontScale: 0.072,
    fontFamily: '"Inter", "Liberation Sans", system-ui, sans-serif',
    fontWeight: 800,
    uppercase: true,
    letterSpacingEm: 0.02,
    fillColor: "#ffffff",
    activeColor: "#7cf5ff",
    strokeScale: 0,
    strokeColor: "#000000",
    textShadow:
      "0 0 6px rgba(124,245,255,0.7), 0 0 22px rgba(124,245,255,0.45), 0 2px 8px rgba(0,0,0,0.6)",
    position: "center",
    marginVScale: 0,
    maxWidthScale: 0.8,
    pop: true,
  },
  spring: {
    id: "spring",
    family: "word-pop",
    fontScale: 0.08,
    fontFamily: '"Inter", "Liberation Sans", system-ui, sans-serif',
    fontWeight: 900,
    uppercase: true,
    letterSpacingEm: 0,
    fillColor: "#ffffff",
    activeColor: "#ff4d6d",
    strokeScale: 0.1,
    strokeColor: "#0a0a0a",
    textShadow: "0 3px 10px rgba(0,0,0,0.6)",
    pill: { color: "rgba(255,77,109,0.16)", padXEm: 0.35, padYEm: 0.12, radiusEm: 0.3 },
    position: "bottom",
    marginVScale: 0.11,
    maxWidthScale: 0.82,
    pop: true,
  },
};

export const DEFAULT_CAPTION_PRESET: CaptionPresetId = "bold";

// Pick a sensible default preset for a detected niche/family. The agent already
// classifies the niche; this maps it to a caption look so it doesn't have to
// hardcode preset ids. Anything social/short → word-pop; talking/doc → minimal.
export function presetForFamily(family: CaptionFamily): CaptionPresetId {
  return family === "minimal" ? "clean" : "bold";
}

export function isCaptionPresetId(value: string): value is CaptionPresetId {
  return value in CAPTION_PRESETS;
}
