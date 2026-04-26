/**
 * motion-presets.ts
 *
 * Maps a MotionPreset name (schema enum) to a function that emits a
 * Keyframe[] spanning [0, durationFrames]. The renderer expands the
 * preset to keyframes once per scene and feeds them to evaluateKeyframes
 * each frame.
 *
 * Keep this catalog tightly aligned with the MotionPreset union in
 * scene-schema.ts — adding a name there without adding it here will
 * silently fall back to a static value.
 */

import type { Keyframe, MotionPreset } from "./scene-schema";

type PresetFn = (durationFrames: number) => Keyframe[];

export const MOTION_PRESETS: Record<MotionPreset, PresetFn> = {
  /** No motion — single keyframe at the static value. */
  none: () => [],

  /** Slow drift upward over the scene. Used for hero text on a flat bg. */
  drift_up: (dur) => [
    { frame: 0, value: 0, easing: "ease_out" },
    { frame: dur, value: -40, easing: "ease_out" },
  ],

  /** Slow drift downward — descent / "settling" feel. */
  drift_down: (dur) => [
    { frame: 0, value: 0, easing: "ease_out" },
    { frame: dur, value: 40, easing: "ease_out" },
  ],

  /** Heartbeat-style scale pulse repeating ~once per second. */
  pulse: (dur) => {
    const period = 30; // ~1s @ 30fps
    const out: Keyframe[] = [];
    for (let f = 0; f <= dur; f += period / 4) {
      const phase = (f % period) / period;
      const val = 1 + Math.sin(phase * Math.PI * 2) * 0.06;
      out.push({ frame: Math.round(f), value: val, easing: "ease_in_out" });
    }
    return out;
  },

  /** Quick lateral shake — anger / glitch beats. */
  shake: (dur) => {
    const out: Keyframe[] = [];
    for (let f = 0; f <= dur; f += 2) {
      const sign = f % 4 === 0 ? 1 : f % 4 === 2 ? -1 : 0;
      out.push({ frame: f, value: sign * 6, easing: "linear" });
    }
    out.push({ frame: dur, value: 0, easing: "ease_out" });
    return out;
  },

  /** Slow zoom-in (1.0 → 1.12). */
  ken_burns_in: (dur) => [
    { frame: 0, value: 1.0, easing: "ease_in_out" },
    { frame: dur, value: 1.12, easing: "ease_in_out" },
  ],

  /** Slow zoom-out (1.12 → 1.0). */
  ken_burns_out: (dur) => [
    { frame: 0, value: 1.12, easing: "ease_in_out" },
    { frame: dur, value: 1.0, easing: "ease_in_out" },
  ],

  /** Subtle horizontal parallax drift — slow. */
  parallax_slow: (dur) => [
    { frame: 0, value: -15, easing: "linear" },
    { frame: dur, value: 15, easing: "linear" },
  ],

  /** Same direction, more aggressive. */
  parallax_fast: (dur) => [
    { frame: 0, value: -40, easing: "linear" },
    { frame: dur, value: 40, easing: "linear" },
  ],

  /** Spring scale in — overshoot then settle. */
  bounce_in: (dur) => {
    const settleAt = Math.min(20, Math.round(dur * 0.5));
    return [
      { frame: 0, value: 0.6, easing: "ease_out_back" },
      { frame: settleAt, value: 1.0, easing: "ease_out" },
      { frame: dur, value: 1.0 },
    ];
  },

  /** Soft fade in / fade out. */
  fade_in_out: (dur) => {
    const fade = Math.min(8, Math.round(dur * 0.15));
    return [
      { frame: 0, value: 0, easing: "ease_out" },
      { frame: fade, value: 1, easing: "ease_in_out" },
      { frame: dur - fade, value: 1, easing: "ease_in" },
      { frame: dur, value: 0 },
    ];
  },

  /** Slow rotation-style wobble — used as a transform degrees value. */
  wobble: (dur) => {
    const out: Keyframe[] = [];
    const cycles = 3;
    for (let i = 0; i <= cycles * 2; i++) {
      const f = Math.round((i / (cycles * 2)) * dur);
      const v = i % 2 === 0 ? 0 : i % 4 === 1 ? 2 : -2;
      out.push({ frame: f, value: v, easing: "ease_in_out" });
    }
    return out;
  },
};

/** Default preset value when no keyframes are specified. */
export function presetBaseValue(name: MotionPreset, property: string): number {
  // Scale-style properties default to 1.0; positional/opacity default
  // to 0 / 1 respectively. Keeps "none" rendering identical to no preset.
  if (property.endsWith("Scale")) return 1.0;
  if (property === "textOpacity" || property === "emphasisOpacity" || property === "overlayOpacity") return 1.0;
  void name;
  return 0;
}
