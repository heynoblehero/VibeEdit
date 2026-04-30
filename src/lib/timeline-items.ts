/**
 * Layered-timeline derivation (sprint 19).
 *
 * Decomposes each Scene into a flat list of TimelineItem entries, one
 * per visible / audible layer the renderer composites. The frame
 * positions mirror the hardcoded values inside SceneRenderer:
 *   - text-main starts at scene-start + 3
 *   - text-emphasis at +12
 *   - text-subtitle at +25
 *   - character at +3 (enterDelay)
 *   - counter at +5 (big_number type)
 * B-roll and SceneEffect already carry explicit startFrame on the
 * schema and are passed through verbatim.
 *
 * Effects don't have explicit duration on the schema — we estimate
 * one per kind so the timeline shows a finite-length block instead of
 * a zero-width hairline. Estimates match the components' visible
 * animation length; off-screen overflow is harmless.
 */

import type { Scene, SceneEffect, SceneEffectKind } from "@/lib/scene-schema";
import { sceneDurationFrames } from "@/lib/scene-schema";
import type { EditTarget } from "@/store/editor-store";

export type LayerKind =
  | "bg"
  | "character"
  | "text-main"
  | "text-emphasis"
  | "text-subtitle"
  | "voiceover"
  | "broll"
  | "effects"
  | "shape"
  | "montage"
  | "stat"
  | "bullets"
  | "quote"
  | "bar-chart"
  | "three"
  | "split"
  | "counter";

export interface TimelineItem {
  /** Globally unique within a project: `{sceneId}:{kind}[:N]`. */
  id: string;
  sceneId: string;
  kind: LayerKind;
  /** User-facing badge label. */
  label: string;
  /** Global frame position on the project timeline. */
  startFrame: number;
  /** Length in frames. */
  durationFrames: number;
  /** Tailwind-friendly text colour key for the block. */
  color:
    | "neutral"
    | "sky"
    | "emerald"
    | "amber"
    | "purple"
    | "cyan"
    | "pink";
  /** Optional supplementary metadata for the editor (broll/effect index). */
  index?: number;
}

/** Estimated visible animation length per effect kind, in frames. */
const EFFECT_DURATION_BY_KIND: Record<SceneEffectKind, number> = {
  circle_ping: 30,
  radial_pulse: 40,
  scan_line: 24,
  bar_wipe: 30,
  corner_brackets: 40,
  reveal_box: 36,
  lower_third: 90,
  typewriter: 60,
  glitch: 20,
  arrow: 60,
  highlight: 90,
  particles: 60,
  progress_bar: 45,
};

function effectDuration(effect: SceneEffect): number {
  // Typewriter scales with text length; estimate at ~3 frames/char,
  // capped at the kind default.
  if (effect.kind === "typewriter" && effect.text) {
    return Math.min(120, Math.max(20, effect.text.length * 3));
  }
  return EFFECT_DURATION_BY_KIND[effect.kind] ?? 30;
}

/**
 * Map a layer kind to the editor sidebar tab the user expects when
 * clicking that block. Returns null when no panel exists for that
 * kind (the click should still selectScene but leave editTarget alone).
 */
export function kindToEditTarget(kind: LayerKind): EditTarget | null {
  switch (kind) {
    case "text-main":
    case "text-emphasis":
    case "text-subtitle":
    case "stat":
    case "bullets":
    case "quote":
    case "bar-chart":
    case "counter":
      return "text";
    // All media kinds route into the unified flat MediaPanel — bg /
    // character / broll show as cards there, with "advanced" links
    // back to their dedicated panels for power-user fields.
    case "character":
    case "bg":
    case "montage":
    case "split":
    case "three":
    case "broll":
      return "media";
    case "effects":
      return "effects";
    case "shape":
      return "shape";
    case "voiceover":
      // No dedicated panel today — leave editTarget alone, just select scene.
      return null;
  }
}

/**
 * Derive every timeline item for a single scene at its global
 * frame offset. Returns blocks ordered by startFrame ascending so
 * the layered timeline can hand them to React in render order.
 */
export function deriveItemsFromScene(
  scene: Scene,
  sceneStartFrame: number,
  fps: number,
): TimelineItem[] {
  const items: TimelineItem[] = [];
  const sceneDur = sceneDurationFrames(scene, fps);
  const sid = scene.id;

  // Background — full-scene span. Always emitted (even with no media,
  // the renderer paints a colour).
  items.push({
    id: `${sid}:bg`,
    sceneId: sid,
    kind: "bg",
    label:
      scene.background.videoUrl
        ? "Video bg"
        : scene.background.imageUrl
          ? "Image bg"
          : "Color bg",
    startFrame: sceneStartFrame,
    durationFrames: sceneDur,
    color: "neutral",
  });

  // Character — only when the scene references one.
  if (scene.characterId) {
    items.push({
      id: `${sid}:character`,
      sceneId: sid,
      kind: "character",
      label: "Character",
      startFrame: sceneStartFrame + 3,
      durationFrames: Math.max(1, sceneDur - 3),
      color: "sky",
    });
  }

  // Text layers — three independent reveals. Each appears only when
  // the scene has matching text content.
  if (scene.text) {
    items.push({
      id: `${sid}:text-main`,
      sceneId: sid,
      kind: "text-main",
      label: scene.text.slice(0, 24) || "Text",
      startFrame: sceneStartFrame + 3,
      durationFrames: Math.max(1, sceneDur - 3),
      color: "emerald",
    });
  }
  if (scene.emphasisText) {
    items.push({
      id: `${sid}:text-emphasis`,
      sceneId: sid,
      kind: "text-emphasis",
      label: scene.emphasisText.slice(0, 24) || "Emphasis",
      startFrame: sceneStartFrame + 12,
      durationFrames: Math.max(1, sceneDur - 12),
      color: "emerald",
    });
  }
  if (scene.subtitleText) {
    items.push({
      id: `${sid}:text-subtitle`,
      sceneId: sid,
      kind: "text-subtitle",
      label: scene.subtitleText.slice(0, 24) || "Subtitle",
      startFrame: sceneStartFrame + 25,
      durationFrames: Math.max(1, sceneDur - 25),
      color: "emerald",
    });
  }

  // Type-specific content. These exist for one scene-type at a time —
  // they won't double-emit even if the user pastes weirdly because the
  // schema fields are mutually exclusive in practice.
  if (scene.type === "montage" && scene.montageUrls && scene.montageUrls.length > 0) {
    items.push({
      id: `${sid}:montage`,
      sceneId: sid,
      kind: "montage",
      label: `Montage · ${scene.montageUrls.length}`,
      startFrame: sceneStartFrame,
      durationFrames: sceneDur,
      color: "pink",
    });
  }
  if (scene.type === "stat" && scene.statValue) {
    items.push({
      id: `${sid}:stat`,
      sceneId: sid,
      kind: "stat",
      label: `Stat · ${scene.statValue}`,
      startFrame: sceneStartFrame + 3,
      durationFrames: Math.max(1, sceneDur - 3),
      color: "pink",
    });
  }
  if (scene.type === "bullet_list" && scene.bulletItems && scene.bulletItems.length > 0) {
    items.push({
      id: `${sid}:bullets`,
      sceneId: sid,
      kind: "bullets",
      label: `Bullets · ${scene.bulletItems.length}`,
      startFrame: sceneStartFrame + 3,
      durationFrames: Math.max(1, sceneDur - 3),
      color: "pink",
    });
  }
  if (scene.type === "quote" && scene.quoteText) {
    items.push({
      id: `${sid}:quote`,
      sceneId: sid,
      kind: "quote",
      label: scene.quoteText.slice(0, 24),
      startFrame: sceneStartFrame + 3,
      durationFrames: Math.max(1, sceneDur - 3),
      color: "pink",
    });
  }
  if (scene.type === "bar_chart" && scene.chartBars && scene.chartBars.length > 0) {
    items.push({
      id: `${sid}:bar-chart`,
      sceneId: sid,
      kind: "bar-chart",
      label: `Chart · ${scene.chartBars.length}`,
      startFrame: sceneStartFrame,
      durationFrames: sceneDur,
      color: "pink",
    });
  }
  if (
    (scene.type === "three_text" ||
      scene.type === "three_card" ||
      scene.type === "three_particles") &&
    (scene.threeText || scene.threeCardImageUrl || scene.threeParticleCount)
  ) {
    items.push({
      id: `${sid}:three`,
      sceneId: sid,
      kind: "three",
      label: `3D ${scene.type.replace("three_", "")}`,
      startFrame: sceneStartFrame,
      durationFrames: sceneDur,
      color: "pink",
    });
  }
  if (scene.type === "split" && (scene.splitLeftUrl || scene.splitRightUrl)) {
    items.push({
      id: `${sid}:split`,
      sceneId: sid,
      kind: "split",
      label: "Split",
      startFrame: sceneStartFrame,
      durationFrames: sceneDur,
      color: "pink",
    });
  }
  if (scene.type === "big_number" && (scene.numberFrom !== undefined || scene.numberTo !== undefined)) {
    const from = scene.numberFrom ?? 0;
    const to = scene.numberTo ?? 0;
    items.push({
      id: `${sid}:counter`,
      sceneId: sid,
      kind: "counter",
      label: `${from}→${to}`,
      startFrame: sceneStartFrame + 5,
      durationFrames: Math.max(1, sceneDur - 5),
      color: "pink",
    });
  }

  // Shapes — full-scene span. Index suffix references scene.shapes[N]
  // for the SceneCard layer click + ShapePanel scope.
  for (let i = 0; i < (scene.shapes?.length ?? 0); i++) {
    const sh = scene.shapes![i];
    items.push({
      id: `${sid}:shape:${sh.id}`,
      sceneId: sid,
      kind: "shape",
      label: `Shape · ${sh.kind}`,
      startFrame: sceneStartFrame,
      durationFrames: sceneDur,
      color: "amber",
      index: i,
    });
  }

  // B-roll — already explicit start/duration. Index suffix lets the
  // sprint-20 drag handler write back to scene.broll[N] cleanly.
  for (let i = 0; i < (scene.broll?.length ?? 0); i++) {
    const b = scene.broll![i];
    items.push({
      id: `${sid}:broll:${i}`,
      sceneId: sid,
      kind: "broll",
      label: `B-roll ${i + 1}`,
      startFrame: sceneStartFrame + b.startFrame,
      durationFrames: b.durationFrames,
      color: "amber",
      index: i,
    });
  }

  // Effects — same indexing pattern.
  for (let i = 0; i < (scene.effects?.length ?? 0); i++) {
    const e = scene.effects![i];
    items.push({
      id: `${sid}:effect:${i}`,
      sceneId: sid,
      kind: "effects",
      label: e.kind.replace(/_/g, " "),
      startFrame: sceneStartFrame + (e.startFrame ?? 0),
      durationFrames: effectDuration(e),
      color: "purple",
      index: i,
    });
  }

  // Voiceover — full scene span (or the audio's own length if shorter).
  if (scene.voiceover?.audioUrl) {
    const voFrames = scene.voiceover.audioDurationSec
      ? Math.round(scene.voiceover.audioDurationSec * fps)
      : sceneDur;
    items.push({
      id: `${sid}:voiceover`,
      sceneId: sid,
      kind: "voiceover",
      label: "VO",
      startFrame: sceneStartFrame,
      durationFrames: Math.min(voFrames, sceneDur),
      color: "cyan",
    });
  }

  return items.sort((a, b) => a.startFrame - b.startFrame);
}

/**
 * Display order of layer rows in LayeredTimeline. Bg first (deepest
 * z), audio last. Group rows by category so related layers stack
 * visually next to each other.
 */
export const LAYER_ROW_ORDER: LayerKind[] = [
  "bg",
  "character",
  "text-main",
  "text-emphasis",
  "text-subtitle",
  "shape",
  "broll",
  "effects",
  "montage",
  "stat",
  "bullets",
  "quote",
  "bar-chart",
  "three",
  "split",
  "counter",
  "voiceover",
];

/** Human label shown in the row's left rail. */
export const LAYER_LABEL: Record<LayerKind, string> = {
  bg: "Bg",
  character: "Char",
  "text-main": "Text",
  "text-emphasis": "Emph",
  "text-subtitle": "Sub",
  shape: "Shape",
  broll: "B-roll",
  effects: "FX",
  montage: "Montage",
  stat: "Stat",
  bullets: "Bullets",
  quote: "Quote",
  "bar-chart": "Chart",
  three: "3D",
  split: "Split",
  counter: "Count",
  voiceover: "VO",
};
