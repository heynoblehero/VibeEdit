import React from "react";
import { Img, spring, useCurrentFrame, useVideoConfig } from "remotion";

interface LowerThirdProps {
  graphic?: string;
  text?: string;
  subtext?: string;
  startFrame?: number;
  textColor?: string;
  subtextColor?: string;
}

export const LowerThird: React.FC<LowerThirdProps> = ({
  graphic,
  text,
  subtext,
  startFrame = 0,
  textColor = "white",
  subtextColor = "#999999",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  if (frame < startFrame) return null;

  const slide = spring({
    frame: frame - startFrame,
    fps,
    config: { damping: 14, mass: 0.6, stiffness: 150 },
    durationInFrames: 20,
  });

  return (
    <div
      style={{
        position: "absolute",
        bottom: 80,
        left: 0,
        right: 0,
        transform: `translateY(${(1 - slide) * 120}px)`,
        opacity: slide,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
      }}
    >
      {graphic && (
        <Img
          src={graphic}
          style={{
            height: 60,
            opacity: 0.7,
            maxHeight: "none",
          }}
        />
      )}
      {text && (
        <span
          style={{
            fontSize: 36,
            fontWeight: 700,
            color: textColor,
            fontFamily: "system-ui, sans-serif",
            textShadow: "0 2px 12px rgba(0,0,0,0.5)",
          }}
        >
          {text}
        </span>
      )}
      {subtext && (
        <span
          style={{
            fontSize: 22,
            fontWeight: 500,
            color: subtextColor,
            fontFamily: "system-ui, sans-serif",
          }}
        >
          {subtext}
        </span>
      )}
    </div>
  );
};
