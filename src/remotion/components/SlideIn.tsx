import React from "react";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";

interface SlideInProps {
  from: "left" | "right" | "bottom" | "top";
  startFrame?: number;
  distance?: number;
  children: React.ReactNode;
  style?: React.CSSProperties;
}

export const SlideIn: React.FC<SlideInProps> = ({
  from,
  startFrame = 0,
  distance = 500,
  children,
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  if (frame < startFrame) return null;

  const p = spring({
    frame: frame - startFrame,
    fps,
    config: { damping: 13, mass: 0.7, stiffness: 160 },
    durationInFrames: 22,
  });

  const offset = (1 - p) * distance;
  const dirs: Record<string, string> = {
    left: `translateX(${-offset}px)`,
    right: `translateX(${offset}px)`,
    bottom: `translateY(${offset}px)`,
    top: `translateY(${-offset}px)`,
  };

  return (
    <div style={{ transform: dirs[from], ...style }}>
      {children}
    </div>
  );
};
