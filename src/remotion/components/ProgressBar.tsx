import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";

interface ProgressBarProps {
  startFrame?: number;
  /** Fraction 0-1 the bar fills to. Default 1. */
  to?: number;
  durationFrames?: number;
  color?: string;
  label?: string;
  /** Position from top, default 78%. */
  y?: number | string;
}

/** Linear progress bar that fills from left to a target fraction. */
export const ProgressBar: React.FC<ProgressBarProps> = ({
  startFrame = 0,
  to = 1,
  durationFrames = 24,
  color = "#10b981",
  label,
  y = "78%",
}) => {
  const frame = useCurrentFrame();
  const { width } = useVideoConfig();
  const since = frame - startFrame;
  if (since < 0) return null;
  const t = Math.min(1, since / durationFrames);
  const fill = Math.min(1, to) * t;
  const barW = width * 0.8;
  const barH = Math.max(10, width * 0.012);
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: y,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: barH * 0.6,
        pointerEvents: "none",
      }}
    >
      {label && (
        <div
          style={{
            fontSize: width * 0.028,
            color: "#fff",
            fontFamily: "Inter, system-ui, sans-serif",
            fontWeight: 700,
            textShadow: "0 2px 12px rgba(0,0,0,0.85)",
            letterSpacing: 0.4,
          }}
        >
          {label}{" "}
          <span style={{ color, fontWeight: 950 }}>{Math.round(fill * 100)}%</span>
        </div>
      )}
      <div
        style={{
          width: barW,
          height: barH,
          background: "rgba(255,255,255,0.15)",
          borderRadius: barH,
          overflow: "hidden",
          boxShadow: "0 4px 20px rgba(0,0,0,0.6)",
        }}
      >
        <div
          style={{
            width: barW * fill,
            height: "100%",
            background: color,
            borderRadius: barH,
            boxShadow: `0 0 18px ${color}88`,
          }}
        />
      </div>
    </div>
  );
};
