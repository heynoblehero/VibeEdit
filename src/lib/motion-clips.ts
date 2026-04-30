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

import { evaluateKeyframes } from "./anim";
import { MOTION_PRESETS } from "./motion-presets";
import type {
  MotionClip,
  MotionClipElement,
  MotionClipKind,
  MotionPreset,
  Scene,
  TextItem,
  TextItemEnterKind,
  TextItemExitKind,
} from "./scene-schema";

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

/**
 * Build synthetic MotionClips for a text item's enter / exit / fade
 * settings. Returns 0–4 clips anchored at the item's startFrame and
 * its end (startFrame + durationFrames). Synthetic clips never get
 * persisted — they're materialised every frame.
 */
function synthEnterExitClips(item: TextItem, itemStart: number, itemDur: number): MotionClip[] {
  const out: MotionClip[] = [];
  const enterDur = Math.max(1, item.enterDurationFrames ?? 12);
  const exitDur = Math.max(1, item.exitDurationFrames ?? 12);
  if (item.enterMotion) {
    out.push({
      id: `_enter`,
      element: "scene",
      kind: item.enterMotion as MotionClipKind,
      startFrame: itemStart,
      durationFrames: Math.min(enterDur, itemDur),
    });
  }
  if (item.exitMotion) {
    out.push({
      id: `_exit`,
      element: "scene",
      kind: item.exitMotion as MotionClipKind,
      startFrame: itemStart + Math.max(0, itemDur - exitDur),
      durationFrames: Math.min(exitDur, itemDur),
    });
  }
  if (item.fadeInFrames && item.fadeInFrames > 0) {
    out.push({
      id: `_fade_in`,
      element: "scene",
      kind: "fade_in",
      startFrame: itemStart,
      durationFrames: Math.min(item.fadeInFrames, itemDur),
    });
  }
  if (item.fadeOutFrames && item.fadeOutFrames > 0) {
    out.push({
      id: `_fade_out`,
      element: "scene",
      kind: "fade_out",
      startFrame: itemStart + Math.max(0, itemDur - item.fadeOutFrames),
      durationFrames: Math.min(item.fadeOutFrames, itemDur),
    });
  }
  return out;
}

/**
 * Map a MotionPreset to which transform component it drives. Presets
 * are single-axis (drift_up → ty, pulse → scale, etc.) — see
 * motion-presets.ts for the value semantics behind each one.
 */
type PresetTarget = "tx" | "ty" | "scale" | "opacity" | "rotation";

function presetTarget(name: MotionPreset): PresetTarget {
  switch (name) {
    case "drift_up":
    case "drift_down":
    case "slide_in_top":
    case "slide_in_bottom":
    case "slide_out_top":
    case "slide_out_bottom":
      return "ty";
    case "shake":
    case "parallax_slow":
    case "parallax_fast":
    case "slide_in_left":
    case "slide_in_right":
    case "slide_out_left":
    case "slide_out_right":
      return "tx";
    case "pulse":
    case "ken_burns_in":
    case "ken_burns_out":
    case "bounce_in":
      return "scale";
    case "fade_in_out":
      return "opacity";
    case "wobble":
    case "flip_x_180":
      return "rotation";
    case "none":
      return "tx";
  }
}

function applyMotionPreset(
  out: ResolvedTransform,
  preset: MotionPreset,
  itemDur: number,
  localFrame: number,
): void {
  if (preset === "none") return;
  const generator = MOTION_PRESETS[preset];
  if (!generator) return;
  const kfs = generator(itemDur);
  if (kfs.length === 0) return;
  const value = evaluateKeyframes(localFrame, kfs);
  switch (presetTarget(preset)) {
    case "tx":
      out.tx += value;
      break;
    case "ty":
      out.ty += value;
      break;
    case "scale":
      out.scale *= value;
      break;
    case "opacity":
      out.opacity *= value;
      break;
    case "rotation":
      out.rotation += value;
      break;
  }
}

/**
 * Resolve all animation contributions for a text item at the current
 * scene frame. Stacks (in order):
 *   1. Synthetic enter/exit/fade clips
 *   2. Named motion preset (drift_up, pulse, …)
 *   3. User-authored motionClips on the item
 *   4. Per-property keyframes (item-local frame)
 */
export function resolveClipsForTextItem(
  item: TextItem,
  sceneFrame: number,
  sceneDurFrames: number,
): ResolvedTransform {
  const itemStart = item.startFrame ?? 0;
  const itemDur = Math.max(1, item.durationFrames ?? sceneDurFrames - itemStart);
  const out: ResolvedTransform = { ...IDENTITY };
  const localFrame = sceneFrame - itemStart;

  // 1. Synthetic enter/exit/fade clips.
  for (const clip of synthEnterExitClips(item, itemStart, itemDur)) {
    if (clip.durationFrames <= 0) continue;
    const local = sceneFrame - clip.startFrame;
    if (local < 0 || local > clip.durationFrames) continue;
    const t = local / clip.durationFrames;
    const partial = applyClipKind(clip, t);
    out.tx += partial.tx;
    out.ty += partial.ty;
    out.scale *= partial.scale;
    out.rotation += partial.rotation;
    out.opacity *= partial.opacity;
  }

  // 2. Motion preset.
  if (item.motion) applyMotionPreset(out, item.motion, itemDur, localFrame);

  // 3. User-authored motion clips. Their startFrame is item-local
  //    (mirrors how the agent thinks: "shake at frame 30" = 30 frames
  //    after the item appears).
  for (const clip of item.motionClips ?? []) {
    if (clip.durationFrames <= 0) continue;
    const local = localFrame - clip.startFrame;
    if (local < 0 || local > clip.durationFrames) continue;
    const t = local / clip.durationFrames;
    const partial = applyClipKind(clip, t);
    out.tx += partial.tx;
    out.ty += partial.ty;
    out.scale *= partial.scale;
    out.rotation += partial.rotation;
    out.opacity *= partial.opacity;
  }

  // 4. Per-property keyframes. Item-local frames.
  if (item.keyframes) {
    const kfs = item.keyframes;
    if (kfs.itemOpacity?.length) out.opacity *= evaluateKeyframes(localFrame, kfs.itemOpacity);
    if (kfs.itemX?.length) out.tx += evaluateKeyframes(localFrame, kfs.itemX);
    if (kfs.itemY?.length) out.ty += evaluateKeyframes(localFrame, kfs.itemY);
    if (kfs.itemScale?.length) out.scale *= evaluateKeyframes(localFrame, kfs.itemScale);
    if (kfs.itemRotation?.length) out.rotation += evaluateKeyframes(localFrame, kfs.itemRotation);
  }

  return out;
}

/**
 * Whether the item is on screen at the given scene frame. Used by the
 * renderer to skip painting outside the item's window.
 */
export function isTextItemActive(item: TextItem, sceneFrame: number, sceneDurFrames: number): boolean {
  const start = item.startFrame ?? 0;
  const dur = Math.max(1, item.durationFrames ?? sceneDurFrames - start);
  return sceneFrame >= start && sceneFrame <= start + dur;
}
