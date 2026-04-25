import React from "react";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";

interface StatBlockProps {
  value: string;
  label?: string;
  color?: string;
}

// Hero number + small label centered. Used by scene.type = "stat".
// Number scales in with a soft spring, label fades after a 6-frame delay.
export const StatBlock: React.FC<StatBlockProps> = ({
  value,
  label,
  color = "#10b981",
}) => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const valueScale = spring({
    frame,
    fps,
    config: { damping: 11, mass: 0.7, stiffness: 180 },
    durationInFrames: 22,
  });
  const labelOpacity = spring({
    frame: Math.max(0, frame - 6),
    fps,
    config: { damping: 22, mass: 0.6, stiffness: 200 },
    durationInFrames: 14,
  });
  // Roughly 22% of frame width per character, capped at 32% so a 4-char
  // value fills the screen but a 1-char doesn't take over.
  const valueFontSize = Math.min(width * 0.32, (width * 0.85) / Math.max(2, value.length));

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "1.5%",
      }}
    >
      <div
        style={{
          fontSize: valueFontSize,
          fontWeight: 950,
          letterSpacing: -0.04 * valueFontSize,
          fontFamily: "Inter, 'SF Pro Display', system-ui, sans-serif",
          color,
          transform: `scale(${valueScale})`,
          textShadow: `0 8px 40px ${color}55, 0 0 80px ${color}22`,
          lineHeight: 1,
        }}
      >
        {value}
      </div>
      {label && (
        <div
          style={{
            opacity: labelOpacity,
            fontSize: width * 0.038,
            fontWeight: 500,
            color: "#e5e5e5",
            fontFamily: "Inter, system-ui, sans-serif",
            textAlign: "center",
            maxWidth: "80%",
            letterSpacing: 0.5,
            textShadow: "0 4px 16px rgba(0,0,0,0.7)",
          }}
        >
          {label}
        </div>
      )}
    </div>
  );
};
