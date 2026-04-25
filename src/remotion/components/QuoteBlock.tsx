import React from "react";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";

interface QuoteBlockProps {
  text: string;
  attribution?: string;
  color?: string;
}

// Pull-quote with corner ornaments. Italic body fades in, attribution
// fades after with a small em-dash prefix.
export const QuoteBlock: React.FC<QuoteBlockProps> = ({
  text,
  attribution,
  color = "#10b981",
}) => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const bodyP = spring({
    frame,
    fps,
    config: { damping: 18, mass: 0.7, stiffness: 160 },
    durationInFrames: 18,
  });
  const attrP = spring({
    frame: Math.max(0, frame - 12),
    fps,
    config: { damping: 22, mass: 0.6, stiffness: 200 },
    durationInFrames: 14,
  });
  const fontSize = Math.min(width * 0.07, 110);
  const ornament = fontSize * 1.2;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: `0 ${width * 0.08}px`,
        gap: fontSize * 0.6,
      }}
    >
      <div
        style={{
          opacity: bodyP,
          transform: `translateY(${(1 - bodyP) * 30}px)`,
          fontSize,
          color: "#fff",
          fontFamily: "'Playfair Display', Georgia, serif",
          fontStyle: "italic",
          fontWeight: 700,
          textAlign: "center",
          lineHeight: 1.2,
          textShadow: "0 6px 28px rgba(0,0,0,0.8)",
          position: "relative",
          maxWidth: "85%",
        }}
      >
        <span
          style={{
            position: "absolute",
            top: -ornament * 0.4,
            left: -ornament * 0.5,
            fontSize: ornament,
            color,
            opacity: 0.85,
            fontStyle: "normal",
            lineHeight: 1,
          }}
        >
          “
        </span>
        {text}
      </div>
      {attribution && (
        <div
          style={{
            opacity: attrP,
            fontSize: fontSize * 0.4,
            color: "#bbb",
            fontFamily: "Inter, system-ui, sans-serif",
            letterSpacing: 1,
            textTransform: "uppercase",
          }}
        >
          — {attribution}
        </div>
      )}
    </div>
  );
};
