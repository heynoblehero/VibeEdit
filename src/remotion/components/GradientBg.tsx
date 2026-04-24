import React from "react";
import { AbsoluteFill, Img, OffthreadVideo, useCurrentFrame, useVideoConfig } from "remotion";
import { bob } from "@/lib/anim";

interface GradientBgProps {
  color?: string;
  graphic?: string;
  graphicY?: number;
  graphicScale?: number;
  graphicOpacity?: number;
  vignette?: number;
  imageUrl?: string;
  imageOpacity?: number;
  kenBurns?: boolean;
  videoUrl?: string;
  videoStartSec?: number;
  videoMuted?: boolean;
  drift?: boolean;
  children?: React.ReactNode;
}

export const GradientBg: React.FC<GradientBgProps> = ({
  color = "#111111",
  graphic,
  graphicY = 600,
  graphicScale = 1.1,
  graphicOpacity = 0.6,
  vignette = 0.5,
  imageUrl,
  imageOpacity = 1,
  kenBurns = false,
  videoUrl,
  videoStartSec = 0,
  videoMuted = true,
  drift = true,
  children,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const driftX = drift ? bob(frame, 8, 200) : 0;
  const driftY = drift ? bob(frame + 50, 5, 160) : 0;

  // Ken Burns: smoothly scale from 1 → 1.1 across the scene's duration.
  const kbProgress = kenBurns ? Math.min(1, frame / Math.max(1, durationInFrames)) : 0;
  const kbScale = 1 + kbProgress * 0.1;
  const kbDriftX = kenBurns ? (kbProgress - 0.5) * 40 : 0;

  return (
    <AbsoluteFill style={{ backgroundColor: color, overflow: "hidden" }}>
      {videoUrl && (
        <OffthreadVideo
          src={videoUrl}
          startFrom={Math.round(videoStartSec * 30)}
          muted={videoMuted}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />
      )}
      {imageUrl && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            opacity: imageOpacity,
            overflow: "hidden",
          }}
        >
          <Img
            src={imageUrl}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              transform: `scale(${kbScale}) translateX(${kbDriftX}px)`,
              transformOrigin: "center center",
            }}
          />
        </div>
      )}

      {graphic && (
        <Img
          src={graphic}
          style={{
            position: "absolute",
            left: -50 + driftX,
            top: graphicY + driftY,
            transform: `scale(${graphicScale})`,
            opacity: graphicOpacity,
            maxHeight: "none",
          }}
        />
      )}

      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,${vignette}) 100%)`,
          pointerEvents: "none",
        }}
      />

      {children}
    </AbsoluteFill>
  );
};
