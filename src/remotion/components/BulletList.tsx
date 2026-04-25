import React from "react";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";

interface BulletListProps {
  items: string[];
  color?: string;
}

// Staggered checklist: items slide in 6 frames apart with a green check.
// Used for type=bullet_list scenes.
export const BulletList: React.FC<BulletListProps> = ({ items, color = "#10b981" }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const itemFontSize = Math.min(width * 0.06, 80);
  const stagger = 6;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "flex-start",
        padding: `${height * 0.16}px ${width * 0.1}px`,
        gap: itemFontSize * 0.45,
      }}
    >
      {items.map((item, i) => {
        const start = i * stagger;
        const p = spring({
          frame: Math.max(0, frame - start),
          fps,
          config: { damping: 14, mass: 0.7, stiffness: 180 },
          durationInFrames: 16,
        });
        if (frame < start) return null;
        return (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              gap: itemFontSize * 0.5,
              opacity: p,
              transform: `translateX(${(1 - p) * -40}px)`,
            }}
          >
            <div
              style={{
                width: itemFontSize * 0.9,
                height: itemFontSize * 0.9,
                borderRadius: 8,
                background: color,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#000",
                fontSize: itemFontSize * 0.65,
                fontWeight: 950,
                fontFamily: "Inter, system-ui, sans-serif",
                boxShadow: `0 4px 18px ${color}55`,
              }}
            >
              ✓
            </div>
            <span
              style={{
                fontSize: itemFontSize,
                color: "#fff",
                fontWeight: 700,
                fontFamily: "Inter, system-ui, sans-serif",
                letterSpacing: -0.3,
                textShadow: "0 4px 16px rgba(0,0,0,0.7)",
              }}
            >
              {item}
            </span>
          </div>
        );
      })}
    </div>
  );
};
