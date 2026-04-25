import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";

// Static / framed graphic primitives. Each is an animated layout element
// rather than a flash effect. Use these to add visual structure to
// scenes that would otherwise be naked text on a background.

/** Horizontal bar that wipes across the frame, then reveals a label. */
export const BarWipe: React.FC<{
  startFrame?: number;
  text?: string;
  color?: string;
  textColor?: string;
  y?: number | string;
  height?: number;
}> = ({ startFrame = 0, text, color = "#10b981", textColor = "#000", y = "50%", height = 90 }) => {
  const frame = useCurrentFrame();
  const since = frame - startFrame;
  if (since < 0) return null;
  const wipeFrames = 14;
  const wipeT = Math.min(1, since / wipeFrames);
  const labelOpacity = since < wipeFrames ? 0 : Math.min(1, (since - wipeFrames) / 8);
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: y,
        height,
        transform: typeof y === "number" ? "translateY(-50%)" : "translateY(-50%)",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: color,
          transform: `scaleX(${wipeT})`,
          transformOrigin: "left center",
        }}
      />
      {text && (
        <div
          style={{
            position: "relative",
            zIndex: 1,
            opacity: labelOpacity,
            color: textColor,
            fontWeight: 950,
            fontSize: height * 0.5,
            fontFamily: "Inter, system-ui, sans-serif",
            letterSpacing: "0.02em",
            textTransform: "uppercase",
          }}
        >
          {text}
        </div>
      )}
    </div>
  );
};

/** Four-corner viewfinder brackets that frame the scene. Gaming/hud feel. */
export const CornerBrackets: React.FC<{
  startFrame?: number;
  color?: string;
  thickness?: number;
  /** Inset from each edge in px. */
  inset?: number;
  /** Length of each bracket arm. */
  arm?: number;
}> = ({ startFrame = 0, color = "#10b981", thickness = 4, inset = 60, arm = 90 }) => {
  const frame = useCurrentFrame();
  const since = frame - startFrame;
  if (since < 0) return null;
  const t = Math.min(1, since / 12);
  const len = arm * t;
  const corners: Array<{ pos: React.CSSProperties; v: React.CSSProperties; h: React.CSSProperties }> = [
    {
      pos: { top: inset, left: inset },
      v: { top: 0, left: 0, width: thickness, height: len },
      h: { top: 0, left: 0, height: thickness, width: len },
    },
    {
      pos: { top: inset, right: inset },
      v: { top: 0, right: 0, width: thickness, height: len },
      h: { top: 0, right: 0, height: thickness, width: len },
    },
    {
      pos: { bottom: inset, left: inset },
      v: { bottom: 0, left: 0, width: thickness, height: len },
      h: { bottom: 0, left: 0, height: thickness, width: len },
    },
    {
      pos: { bottom: inset, right: inset },
      v: { bottom: 0, right: 0, width: thickness, height: len },
      h: { bottom: 0, right: 0, height: thickness, width: len },
    },
  ];
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {corners.map((c, i) => (
        <div key={i} style={{ position: "absolute", width: arm, height: arm, ...c.pos }}>
          <div style={{ position: "absolute", background: color, ...c.v }} />
          <div style={{ position: "absolute", background: color, ...c.h }} />
        </div>
      ))}
    </AbsoluteFill>
  );
};

/**
 * Animated rectangular border that draws clockwise around a region.
 * Defaults to a centered emphasis box but x/y/w/h override.
 */
export const RevealBox: React.FC<{
  startFrame?: number;
  color?: string;
  thickness?: number;
  x?: number | string;
  y?: number | string;
  w?: number | string;
  h?: number | string;
}> = ({
  startFrame = 0,
  color = "#10b981",
  thickness = 4,
  x = "10%",
  y = "30%",
  w = "80%",
  h = "40%",
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const since = frame - startFrame;
  if (since < 0) return null;
  // Each side draws over 6 frames sequentially: top → right → bottom → left.
  const phase = (n: number) => Math.max(0, Math.min(1, (since - n * 6) / 6));
  const tTop = phase(0);
  const tRight = phase(1);
  const tBottom = phase(2);
  const tLeft = phase(3);
  // Resolve numeric layout for accurate side-length scaling.
  const px = (v: number | string, axis: "x" | "y") =>
    typeof v === "number" ? v : (parseFloat(v) / 100) * (axis === "x" ? width : height);
  const X = px(x, "x");
  const Y = px(y, "y");
  const W = px(w, "x");
  const H = px(h, "y");
  return (
    <div
      style={{
        position: "absolute",
        top: Y,
        left: X,
        width: W,
        height: H,
        pointerEvents: "none",
      }}
    >
      <div
        style={{ position: "absolute", left: 0, top: 0, height: thickness, width: W * tTop, background: color }}
      />
      <div
        style={{ position: "absolute", right: 0, top: 0, width: thickness, height: H * tRight, background: color }}
      />
      <div
        style={{ position: "absolute", right: 0, bottom: 0, height: thickness, width: W * tBottom, background: color }}
      />
      <div
        style={{ position: "absolute", left: 0, bottom: 0, width: thickness, height: H * tLeft, background: color }}
      />
    </div>
  );
};
