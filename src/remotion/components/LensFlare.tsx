import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";

interface LensFlareProps {
  /** Frame at which the flare hits its brightest point. */
  hitFrame: number;
  /** Color of the flare. Default warm-white. */
  color?: string;
  /** Position as percentage of frame: {x: 0-1, y: 0-1}. Default top-right. */
  x?: number;
  y?: number;
}

// Soft radial glow that ramps in over 8 frames around hitFrame, peaks,
// and decays over 16. Used on emphasis beats (zoomPunch + lensFlare).
// Cheap — just a single radial-gradient div with screen blend.
export const LensFlare: React.FC<LensFlareProps> = ({
  hitFrame,
  color = "rgba(255, 235, 200, 1)",
  x = 0.78,
  y = 0.22,
}) => {
  const frame = useCurrentFrame();
  const since = frame - hitFrame;
  let intensity = 0;
  if (since >= -8 && since <= 0) intensity = (since + 8) / 8;
  else if (since > 0 && since <= 16) intensity = 1 - since / 16;
  if (intensity <= 0) return null;
  return (
    <AbsoluteFill
      style={{
        pointerEvents: "none",
        mixBlendMode: "screen",
        opacity: 0.85 * intensity,
        background: `radial-gradient(circle at ${x * 100}% ${y * 100}%, ${color} 0%, transparent 35%)`,
      }}
    />
  );
};
