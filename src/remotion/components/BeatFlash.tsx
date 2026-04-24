import React from "react";
import { interpolate, useCurrentFrame } from "remotion";

interface BeatFlashProps {
  hitFrame: number;
  color?: string;
  peakOpacity?: number;
  duration?: number;
}

export const BeatFlash: React.FC<BeatFlashProps> = ({
  hitFrame,
  color = "white",
  peakOpacity = 0.35,
  duration = 4,
}) => {
  const frame = useCurrentFrame();

  if (frame < hitFrame || frame > hitFrame + duration) return null;

  const opacity = interpolate(
    frame,
    [hitFrame, hitFrame + 1, hitFrame + duration],
    [0, peakOpacity, 0],
  );

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        backgroundColor: color,
        opacity,
        pointerEvents: "none",
      }}
    />
  );
};
