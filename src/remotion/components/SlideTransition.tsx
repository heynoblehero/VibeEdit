import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";

interface SlideTransitionProps {
  /** "left" = panel comes from right, sweeps left → off; "right" = inverse. */
  direction: "left" | "right";
  color?: string;
  durationFrames?: number;
}

/**
 * Solid-color panel that swipes across the frame at scene start, hiding
 * the cut. Lasts ~10 frames by default. Pair with scene.transition =
 * "slide_left" or "slide_right".
 */
export const SlideTransition: React.FC<SlideTransitionProps> = ({
  direction,
  color = "#0a0a0a",
  durationFrames = 10,
}) => {
  const frame = useCurrentFrame();
  if (frame > durationFrames) return null;
  const t = frame / durationFrames; // 0 → 1
  // Panel covers the full frame at t=0.5, then exits the opposite side.
  // direction "left": comes in from right, exits left.
  const offset = direction === "left" ? (1 - t * 2) * 100 : (t * 2 - 1) * 100;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: color,
          transform: `translateX(${offset}%)`,
        }}
      />
    </AbsoluteFill>
  );
};

interface ZoomBlurProps {
  durationFrames?: number;
}

/**
 * Quick zoom + radial blur on scene entry. Done with a CSS filter on a
 * full-frame backdrop ramp — no actual content blur, but the visual cue
 * sells a "we just cut" punch.
 */
export const ZoomBlur: React.FC<ZoomBlurProps> = ({ durationFrames = 8 }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  if (frame > durationFrames) return null;
  const t = frame / durationFrames;
  const scale = 1 + (1 - t) * 0.18;
  const blur = (1 - t) * 18;
  const opacity = (1 - t) * 0.55;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(circle at 50% 50%, transparent 30%, rgba(0,0,0,1) 100%)`,
          transform: `scale(${scale})`,
          filter: `blur(${blur}px)`,
          opacity,
          width,
          height,
        }}
      />
    </AbsoluteFill>
  );
};
