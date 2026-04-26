import { interpolate, spring, Easing } from 'remotion';
import { snappy, bouncy } from './easing';
import type { Easing as EasingName, Keyframe } from './scene-schema';

// === impact / squash ===

/**
 * Peaks at peakFrame with given amount; returns squashY value (1 = neutral).
 * Shape: quick compress down to (1-amount), then bounce back slightly over past (1+amount/3), then settle to 1.
 * Duration ~ 20 frames total centered on peakFrame.
 */
export function squash(frame: number, peakFrame: number, amount = 0.25): number {
  const dt = frame - peakFrame;
  if (dt < -10 || dt > 15) return 1;
  if (dt < 0) {
    // compressing
    const t = (dt + 10) / 10; // 0..1
    return interpolate(t, [0, 1], [1, 1 - amount], { easing: snappy });
  }
  if (dt < 5) {
    // rebound past 1
    const t = dt / 5;
    return interpolate(t, [0, 1], [1 - amount, 1 + amount / 2.5], { easing: bouncy });
  }
  // settle
  const t = (dt - 5) / 10;
  return interpolate(t, [0, 1], [1 + amount / 2.5, 1], { easing: Easing.out(Easing.ease) });
}

// Compensating X scale so volume roughly preserved
export function squashPair(
  frame: number,
  peakFrame: number,
  amount = 0.25
): { sx: number; sy: number } {
  const sy = squash(frame, peakFrame, amount);
  const sx = 1 / Math.sqrt(sy);
  return { sx, sy };
}

// === springy arrival ===

/**
 * spring 0..1 over duration frames after startFrame, with bouncy overshoot.
 */
export function bounceIn(
  frame: number,
  startFrame: number,
  durationFrames = 20,
  fps = 30,
  _overshoot = 1.2
): number {
  if (frame < startFrame) return 0;
  return spring({
    frame: frame - startFrame,
    fps,
    config: { damping: 10, mass: 0.6, stiffness: 120 },
    durationInFrames: durationFrames,
  });
}

// === hold/snap ===

/**
 * "Animate on twos" — returns the frame quantized to every `stepSize` frames, so
 * any animation derived from it updates in choppy jumps like old cartoons.
 */
export function onTwos(frame: number, stepSize = 2): number {
  return Math.floor(frame / stepSize) * stepSize;
}

/**
 * Hold a pose at `poseValue` between `from` and `to`, smoothly transitioning into/out of it over
 * `blend` frames.
 */
export function holdBetween(
  frame: number,
  from: number,
  to: number,
  poseValue: number,
  restValue: number,
  blend = 6
): number {
  if (frame < from - blend) return restValue;
  if (frame < from)
    return interpolate(frame, [from - blend, from], [restValue, poseValue], { easing: snappy });
  if (frame <= to) return poseValue;
  if (frame < to + blend)
    return interpolate(frame, [to, to + blend], [poseValue, restValue], { easing: snappy });
  return restValue;
}

// === shake ===

/** Sinusoidal shake — returns {x, y} offset in px. Intensity fades toward end if fadeAfter set. */
export function shake(
  frame: number,
  startFrame: number,
  endFrame: number,
  intensity = 6,
  freq = 0.8
): { x: number; y: number } {
  if (frame < startFrame || frame > endFrame) return { x: 0, y: 0 };
  // quasi-random via two different sin frequencies
  return {
    x:
      Math.sin((frame * freq * 2 * Math.PI) / 1) *
      intensity *
      (Math.sin(frame * 0.37) * 0.5 + 0.5),
    y: Math.cos((frame * freq * 2.3 * Math.PI) / 1) * intensity * 0.6,
  };
}

// === bobbing idle ===

/** Gentle vertical bob — for breathing, walking in place. */
export function bob(frame: number, amplitude = 4, period = 40): number {
  return Math.sin((frame / period) * Math.PI * 2) * amplitude;
}

// === fades / transitions ===

/** Fade from black in first `frames`, fade to black in last `frames` of a scene of given duration. */
export function sceneFade(frame: number, sceneDuration: number, fadeFrames = 10): number {
  if (frame < fadeFrames) return interpolate(frame, [0, fadeFrames], [0, 1]);
  if (frame > sceneDuration - fadeFrames)
    return interpolate(frame, [sceneDuration - fadeFrames, sceneDuration], [1, 0]);
  return 1;
}

// === keyframe helper ===

/** Key-frame style: pass `[ [frame0, value0], [frame1, value1], ... ]` and get interpolated value. */
export function keyframes(
  frame: number,
  kfs: Array<[number, number]>,
  easing = snappy
): number {
  const frames = kfs.map(([f]) => f);
  const values = kfs.map(([, v]) => v);
  return interpolate(frame, frames, values, {
    easing,
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
}

/**
 * Resolve a named easing from the schema enum to a Remotion easing
 * function. Spring is special — Remotion's spring() takes config so we
 * approximate it here with cubic-bezier ease-out. Use the actual spring
 * function for character entry / impact beats; this resolver is for
 * the keyframe / cut paths where we just need a curve.
 */
export function resolveEasing(name: EasingName | undefined): (n: number) => number {
  switch (name) {
    case "linear":
    case undefined:
      return Easing.linear;
    case "ease_in":
      return Easing.in(Easing.cubic);
    case "ease_out":
      return Easing.out(Easing.cubic);
    case "ease_in_out":
      return Easing.inOut(Easing.cubic);
    case "ease_in_back":
      return Easing.in(Easing.back(1.7));
    case "ease_out_back":
      return Easing.out(Easing.back(1.7));
    case "ease_in_out_back":
      return Easing.inOut(Easing.back(1.4));
    case "spring":
      // Approximation — true spring uses Remotion's spring() per frame.
      // For keyframe-segment interpolation we use a soft ease-out that
      // mimics the post-overshoot settle.
      return Easing.bezier(0.34, 1.56, 0.64, 1);
    case "snappy":
      return snappy;
    case "bouncy":
      return bouncy;
  }
}

/**
 * Evaluate a Keyframe[] (sorted by frame ascending) at the given frame.
 * Locates the surrounding pair, interpolates with the leading keyframe's
 * easing. Clamps to the first/last value outside the range.
 *
 * Used by the renderer to read motion-preset and explicit-keyframe
 * animations for textY / opacity / scale / etc.
 */
export function evaluateKeyframes(frame: number, kfs: Keyframe[]): number {
  if (kfs.length === 0) return 0;
  if (kfs.length === 1) return kfs[0].value;
  if (frame <= kfs[0].frame) return kfs[0].value;
  if (frame >= kfs[kfs.length - 1].frame) return kfs[kfs.length - 1].value;
  // Linear search is fine for the small (≤8) keyframe sets we expect.
  for (let i = 0; i < kfs.length - 1; i++) {
    const a = kfs[i];
    const b = kfs[i + 1];
    if (frame >= a.frame && frame <= b.frame) {
      return interpolate(frame, [a.frame, b.frame], [a.value, b.value], {
        easing: resolveEasing(a.easing),
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      });
    }
  }
  return kfs[kfs.length - 1].value;
}
