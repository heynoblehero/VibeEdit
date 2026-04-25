import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";

// Animated overlay primitives. Each takes a hitFrame (when the effect
// peaks/begins). All are pointer-events-none and absolute-positioned —
// drop them anywhere inside SceneRenderer and they self-place.

interface BaseProps {
  hitFrame: number;
  color?: string;
}

/** Expanding ring that fades as it grows. Good for "drop" / "ping" hits. */
export const CirclePing: React.FC<BaseProps & { x?: number; y?: number; size?: number }> = ({
  hitFrame,
  color = "#10b981",
  x,
  y,
  size = 800,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const cx = x ?? width / 2;
  const cy = y ?? height / 2;
  const since = frame - hitFrame;
  if (since < 0 || since > 24) return null;
  const t = since / 24;
  const radius = size * t;
  const opacity = (1 - t) * 0.85;
  return (
    <AbsoluteFill style={{ pointerEvents: "none", mixBlendMode: "screen" }}>
      <svg width="100%" height="100%">
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={Math.max(2, 14 * (1 - t))}
          opacity={opacity}
        />
      </svg>
    </AbsoluteFill>
  );
};

/** Radial gradient pulse from center. Use on hooks / reveals. */
export const RadialPulse: React.FC<BaseProps & { peakOpacity?: number }> = ({
  hitFrame,
  color = "rgba(255, 255, 255, 1)",
  peakOpacity = 0.35,
}) => {
  const frame = useCurrentFrame();
  const since = frame - hitFrame;
  if (since < -4 || since > 20) return null;
  let intensity = 0;
  if (since >= -4 && since <= 0) intensity = (since + 4) / 4;
  else if (since > 0) intensity = 1 - since / 20;
  return (
    <AbsoluteFill
      style={{
        pointerEvents: "none",
        mixBlendMode: "screen",
        opacity: peakOpacity * intensity,
        background: `radial-gradient(circle at 50% 50%, ${color} 0%, transparent 55%)`,
      }}
    />
  );
};

/** Vertical scan-line that sweeps top→bottom. Tech / hud feel. */
export const ScanLine: React.FC<BaseProps & { durationFrames?: number; band?: number }> = ({
  hitFrame,
  color = "rgba(16, 185, 129, 0.7)",
  durationFrames = 26,
  band = 8,
}) => {
  const frame = useCurrentFrame();
  const { height } = useVideoConfig();
  const since = frame - hitFrame;
  if (since < 0 || since > durationFrames) return null;
  const y = (since / durationFrames) * (height + band) - band;
  return (
    <AbsoluteFill style={{ pointerEvents: "none", mixBlendMode: "screen" }}>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: y,
          height: band,
          background: color,
          boxShadow: `0 0 24px ${color}`,
        }}
      />
    </AbsoluteFill>
  );
};
