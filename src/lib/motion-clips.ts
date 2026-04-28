/**
 * motion-clips.ts
 *
 * Self-contained motion segments per element. The renderer accumulates
 * all clips active at the current frame, combining their effects:
 *
 *   - translate (tx, ty): summed across clips
 *   - rotation:           summed
 *   - scale:              multiplied (baseline 1)
 *   - opacity:            multiplied (baseline 1)
 *
 * Adding a new MotionClipKind:
 *   1. Extend `MotionClipKind` in scene-schema.ts.
 *   2. Add a case to applyClipKind() returning the partial transform
 *      at progress t ∈ [0, 1].
 *   3. (Optional) Document the kind's `intensity` / `degrees` semantics.
 */

import type { MotionClip, MotionClipElement, Scene } from "./scene-schema";

/** Off-screen sentinel for slide_in/out — a tiny bit beyond a typical
 *  1080-tall / 1920-wide frame so the clip is genuinely out of view at
 *  the start of slide_in (and at the end of slide_out). */
const OFFSCREEN = 1080;

export interface ResolvedTransform {
  tx: number; // additive
  ty: number; // additive
  scale: number; // multiplicative, baseline 1
  rotation: number; // additive degrees
  opacity: number; // multiplicative, baseline 1
}

const IDENTITY: ResolvedTransform = {
  tx: 0,
  ty: 0,
  scale: 1,
  rotation: 0,
  opacity: 1,
};

/** ease_out_cubic: snappy entrance feel. */
function easeOut(t: number): number {
  const u = 1 - Math.max(0, Math.min(1, t));
  return 1 - u * u * u;
}

/** ease_in_cubic: snappy exit. */
function easeIn(t: number): number {
  const u = Math.max(0, Math.min(1, t));
  return u * u * u;
}

function easeInOut(t: number): number {
  const u = Math.max(0, Math.min(1, t));
  return u < 0.5 ? 4 * u * u * u : 1 - ((-2 * u + 2) ** 3) / 2;
}

/** Map a clip + progress to a partial transform. The renderer combines
 *  this with other active clips (sum/multiply rules above). */
function applyClipKind(clip: MotionClip, t: number): ResolvedTransform {
  const out: ResolvedTransform = { ...IDENTITY };
  switch (clip.kind) {
    case "slide_in_right":
      out.tx = (1 - easeOut(t)) * OFFSCREEN;
      return out;
    case "slide_in_left":
      out.tx = -(1 - easeOut(t)) * OFFSCREEN;
      return out;
    case "slide_in_top":
      out.ty = -(1 - easeOut(t)) * OFFSCREEN;
      return out;
    case "slide_in_bottom":
      out.ty = (1 - easeOut(t)) * OFFSCREEN;
      return out;
    case "slide_out_right":
      out.tx = easeIn(t) * OFFSCREEN;
      return out;
    case "slide_out_left":
      out.tx = -easeIn(t) * OFFSCREEN;
      return out;
    case "slide_out_top":
      out.ty = -easeIn(t) * OFFSCREEN;
      return out;
    case "slide_out_bottom":
      out.ty = easeIn(t) * OFFSCREEN;
      return out;
    case "fade_in":
      out.opacity = easeOut(t);
      return out;
    case "fade_out":
      out.opacity = 1 - easeIn(t);
      return out;
    case "zoom_in":
      // 0.6 → 1.0
      out.scale = 0.6 + 0.4 * easeOut(t);
      return out;
    case "zoom_out":
      // 1.0 → 0.6
      out.scale = 1 - 0.4 * easeIn(t);
      return out;
    case "shake": {
      const amplitude = clip.intensity ?? 6;
      // 8 oscillations across the clip; damped by (1 - t) so it
      // settles toward the end.
      out.tx = Math.sin(t * Math.PI * 8) * amplitude * (1 - t * 0.6);
      return out;
    }
    case "wobble": {
      const degrees = clip.degrees ?? 2;
      out.rotation = Math.sin(t * Math.PI * 6) * degrees;
      return out;
    }
    case "pulse": {
      const jitter = clip.intensity ?? 0.06;
      out.scale = 1 + Math.sin(t * Math.PI * 4) * jitter;
      return out;
    }
    case "flip_x_180":
      // Y-axis rotation actually reads as a "flip" in 3D, but our
      // renderer applies a 2D rotate(deg) — visually a spin in the
      // image plane. Good enough for v1.
      out.rotation = (clip.degrees ?? 180) * easeInOut(t);
      return out;
    case "flip_y_180":
      out.rotation = (clip.degrees ?? 180) * easeInOut(t);
      return out;
    case "spin_360":
      out.rotation = (clip.degrees ?? 360) * t;
      return out;
    default: {
      // Defensive: if a new kind ships in the schema before we wire
      // it here, return identity instead of throwing — better to drop
      // the animation than break the whole render.
      const _exhaustive: never = clip.kind;
      void _exhaustive;
      return out;
    }
  }
}

/**
 * Resolve every active clip on the given element at the given frame
 * into a single transform the renderer can stack into its existing
 * style strings.
 *
 * For element="broll", pass `targetId` so the resolver only picks clips
 * tied to that specific BRoll item. A clip with no targetId applies to
 * every broll in the scene (rare; mostly used for "all overlays fade").
 */
export function resolveClipsForElement(
  scene: Scene,
  element: MotionClipElement,
  frame: number,
  targetId?: string,
): ResolvedTransform {
  const clips = scene.motionClips ?? [];
  if (clips.length === 0) return { ...IDENTITY };
  const out: ResolvedTransform = { ...IDENTITY };
  for (const clip of clips) {
    if (clip.element !== element) continue;
    if (clip.durationFrames <= 0) continue;
    if (element === "broll" && targetId && clip.targetId && clip.targetId !== targetId) continue;
    const local = frame - clip.startFrame;
    if (local < 0 || local > clip.durationFrames) continue;
    const t = local / clip.durationFrames;
    const partial = applyClipKind(clip, t);
    out.tx += partial.tx;
    out.ty += partial.ty;
    out.scale *= partial.scale;
    out.rotation += partial.rotation;
    out.opacity *= partial.opacity;
  }
  return out;
}
