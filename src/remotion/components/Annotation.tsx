import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";

interface ArrowProps {
  startFrame?: number;
  /** Tail position (where arrow grows from). */
  fromX?: number | string;
  fromY?: number | string;
  /** Head position (what it points at). */
  toX?: number | string;
  toY?: number | string;
  color?: string;
  thickness?: number;
}

/**
 * Hand-drawn-style arrow that draws from tail to head over 12 frames,
 * with a triangle arrowhead at the tip. Coordinates accept "%".
 */
export const Arrow: React.FC<ArrowProps> = ({
  startFrame = 0,
  fromX = "20%",
  fromY = "70%",
  toX = "50%",
  toY = "40%",
  color = "#10b981",
  thickness = 6,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const since = frame - startFrame;
  if (since < 0) return null;
  const t = Math.min(1, since / 12);
  const px = (v: number | string, axis: "x" | "y") =>
    typeof v === "number" ? v : (parseFloat(v) / 100) * (axis === "x" ? width : height);
  const x1 = px(fromX, "x");
  const y1 = px(fromY, "y");
  const x2t = px(toX, "x");
  const y2t = px(toY, "y");
  // Animate the head along the line.
  const x2 = x1 + (x2t - x1) * t;
  const y2 = y1 + (y2t - y1) * t;
  // Arrowhead vectors.
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const headLen = 28;
  const ax1 = x2 - headLen * Math.cos(angle - Math.PI / 7);
  const ay1 = y2 - headLen * Math.sin(angle - Math.PI / 7);
  const ax2 = x2 - headLen * Math.cos(angle + Math.PI / 7);
  const ay2 = y2 - headLen * Math.sin(angle + Math.PI / 7);
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <svg width="100%" height="100%">
        <line
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke={color}
          strokeWidth={thickness}
          strokeLinecap="round"
        />
        {t >= 1 && (
          <polygon
            points={`${x2},${y2} ${ax1},${ay1} ${ax2},${ay2}`}
            fill={color}
          />
        )}
      </svg>
    </AbsoluteFill>
  );
};

interface HighlightProps {
  startFrame?: number;
  x?: number | string;
  y?: number | string;
  w?: number | string;
  h?: number | string;
  color?: string;
}

/**
 * Semi-transparent highlight rectangle that fades in. Used to point at
 * a region of an underlying image.
 */
export const Highlight: React.FC<HighlightProps> = ({
  startFrame = 0,
  x = "30%",
  y = "30%",
  w = "40%",
  h = "30%",
  color = "rgba(245, 209, 66, 0.35)",
}) => {
  const frame = useCurrentFrame();
  const since = frame - startFrame;
  if (since < 0) return null;
  const opacity = Math.min(1, since / 8);
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: w,
        height: h,
        background: color,
        boxShadow: "inset 0 0 0 4px " + color.replace(/[\d.]+\)/, "0.9)"),
        borderRadius: 8,
        opacity,
        pointerEvents: "none",
      }}
    />
  );
};
