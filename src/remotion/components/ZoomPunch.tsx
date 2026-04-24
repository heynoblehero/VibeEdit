import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

interface ZoomPunchProps {
  hitFrame: number;
  intensity?: number;
  children: React.ReactNode;
}

export const ZoomPunch: React.FC<ZoomPunchProps> = ({
  hitFrame,
  intensity = 1.15,
  children,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  let scale = 1;
  if (frame >= hitFrame) {
    const settle = spring({
      frame: frame - hitFrame,
      fps,
      config: { damping: 14, mass: 0.6, stiffness: 180 },
      durationInFrames: 20,
    });
    scale = interpolate(settle, [0, 1], [intensity, 1]);
  }

  return (
    <div
      style={{
        transform: `scale(${scale})`,
        transformOrigin: "center center",
        width: "100%",
        height: "100%",
      }}
    >
      {children}
    </div>
  );
};
