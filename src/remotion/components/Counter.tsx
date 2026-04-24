import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

interface CounterProps {
  from: number;
  to: number;
  startFrame?: number;
  duration?: number;
  fontSize?: number;
  color?: string;
  glowColor?: string;
  x?: number | "center";
  y?: number;
  prefix?: string;
  suffix?: string;
}

export const Counter: React.FC<CounterProps> = ({
  from,
  to,
  startFrame = 0,
  duration = 40,
  fontSize = 96,
  color = "white",
  glowColor,
  x = "center",
  y = 400,
  prefix = "",
  suffix = "",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  if (frame < startFrame) return null;

  const elapsed = frame - startFrame;
  const raw = interpolate(elapsed, [0, duration], [from, to], {
    extrapolateRight: "clamp",
  });

  const settleScale = spring({
    frame: Math.max(0, elapsed - duration),
    fps,
    config: { damping: 10, mass: 0.5, stiffness: 200 },
    durationInFrames: 15,
  });
  const scale = elapsed >= duration ? interpolate(settleScale, [0, 1], [1.2, 1]) : 1;

  const formatted = raw >= 1000 ? `${(raw / 1000).toFixed(1)}K` : Math.round(raw).toString();
  const glow = glowColor
    ? `0 0 30px ${glowColor}, 0 0 60px ${glowColor}`
    : "none";

  return (
    <div
      style={{
        position: "absolute",
        top: y,
        left: 0,
        right: 0,
        textAlign: x === "center" ? "center" : "left",
        paddingLeft: x !== "center" ? x : 0,
      }}
    >
      <span
        style={{
          fontSize,
          fontWeight: 900,
          fontFamily: "system-ui, -apple-system, sans-serif",
          color,
          textShadow: glow,
          transform: `scale(${scale})`,
          display: "inline-block",
          letterSpacing: "-0.03em",
        }}
      >
        {prefix}{formatted}{suffix}
      </span>
    </div>
  );
};
