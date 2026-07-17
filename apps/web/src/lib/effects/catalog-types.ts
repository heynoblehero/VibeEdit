// The Effects Store catalog — one entry per curated, AI-usable effect. The
// `compositing` field is what lets the agent apply an effect CORRECTLY (a
// black-screen light leak MUST be mix-blend-mode: screen, not layered normally).
//
// Asset bytes live under STORAGE_ROOT/effects/ (persistent volume, not git) and
// are served via /api/effects/<presetId>/{file|preview}. The catalog itself is
// committed metadata.

export type EffectBlend = "screen" | "alpha" | "normal" | "add";
export type EffectCategory =
  | "overlay"
  | "transition"
  | "background"
  | "sfx"
  | "grade"
  | "typography"
  | "character"
  | "code-block";
export type EffectKind = "video" | "audio" | "image" | "html-block";

export type EffectEntry = {
  presetId: string; // stable slug, e.g. "light-leak-short-01"
  name: string;
  description: string;
  category: EffectCategory;
  kind: EffectKind;
  // Keywords the agent matches against ("warm", "vintage", "scene-open", "impact").
  useWhen: string[];
  compositing: {
    blend: EffectBlend;
    defaultOpacity?: number;
    loop?: boolean;
    hasAudio?: boolean;
  };
  durationSeconds?: number;
  ext: string; // stored file extension, e.g. "mp4" | "mp3" | "png"
  previewExt: "webp" | "png";
  license: string;
  sourceUrl?: string;
};

export function effectFileUrl(entry: EffectEntry): string {
  return `/api/effects/${entry.presetId}/file`;
}
export function effectPreviewUrl(entry: EffectEntry): string {
  return `/api/effects/${entry.presetId}/preview`;
}
