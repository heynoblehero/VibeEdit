import React from "react";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";

interface PunchTextProps {
  text: string;
  startFrame?: number;
  fontSize?: number;
  color?: string;
  glowColor?: string;
  x?: number | "center";
  y?: number;
  staggerFrames?: number;
  fontWeight?: number;
}

// Rough overflow-aware sizing. Frame ~1080px wide on portrait, 1920 on
// landscape; we don't know orientation here, so target a safe ~960px
// effective text-area and shrink fontSize when char-count would push
// the longest word past it. Measures characters at ~0.55 × fontSize per
// char (decent for system-ui condensed weight 800+).
function clampFontSize(text: string, requested: number, frameWidth: number): number {
  const longest = Math.max(...text.split(/\s+/).map((w) => w.length));
  if (longest === 0) return requested;
  const safeWidth = frameWidth * 0.88;
  const px = longest * requested * 0.55;
  if (px <= safeWidth) return requested;
  return Math.max(28, Math.floor((safeWidth / (longest * 0.55))));
}

export const PunchText: React.FC<PunchTextProps> = ({
  text,
  startFrame = 0,
  fontSize: requestedFontSize = 72,
  color = "white",
  glowColor,
  x = "center",
  y = 480,
  staggerFrames = 5,
  fontWeight = 800,
}) => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const fontSize = clampFontSize(text, requestedFontSize, width);
  const words = text.split(" ");

  return (
    <div
      style={{
        position: "absolute",
        top: y,
        left: 0,
        right: 0,
        display: "flex",
        justifyContent: x === "center" ? "center" : "flex-start",
        paddingLeft: x !== "center" ? x : 0,
        gap: fontSize * 0.3,
        flexWrap: "wrap",
      }}
    >
      {words.map((word, i) => {
        const wordStart = startFrame + i * staggerFrames;
        const s = spring({
          frame: Math.max(0, frame - wordStart),
          fps,
          config: { damping: 11, mass: 0.7, stiffness: 200 },
          durationInFrames: 18,
        });

        if (frame < wordStart) return null;

        const glow = glowColor
          ? `0 0 ${fontSize * 0.4}px ${glowColor}, 0 0 ${fontSize * 0.8}px ${glowColor}`
          : "none";

        return (
          <span
            key={i}
            style={{
              fontSize,
              fontWeight,
              fontFamily: "system-ui, -apple-system, sans-serif",
              color,
              transform: `scale(${s})`,
              display: "inline-block",
              textShadow: glow,
              letterSpacing: "-0.02em",
            }}
          >
            {word}
          </span>
        );
      })}
    </div>
  );
};
