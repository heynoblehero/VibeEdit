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
  cameraMove?:
    | "still"
    | "push_in"
    | "pull_out"
    | "pan_lr"
    | "pan_rl"
    | "tilt_up"
    | "tilt_down"
    | "ken_burns";
  colorGrade?: "warm" | "cool" | "punchy" | "bw" | "neutral";
  videoUrl?: string;
  videoStartSec?: number;
  videoMuted?: boolean;
  drift?: boolean;
  children?: React.ReactNode;
}

function gradeFilter(grade: NonNullable<GradientBgProps["colorGrade"]>): string {
  switch (grade) {
    case "warm":
      return "sepia(0.25) saturate(1.15) hue-rotate(-8deg) brightness(1.04)";
    case "cool":
      return "hue-rotate(180deg) saturate(0.85) brightness(0.96) contrast(1.05)";
    case "punchy":
      return "saturate(1.35) contrast(1.18) brightness(1.04)";
    case "bw":
      return "grayscale(1) contrast(1.12) brightness(1.02)";
    case "neutral":
      return "none";
  }
}

function cameraTransform(
  move: NonNullable<GradientBgProps["cameraMove"]>,
  progress: number,
): { scale: number; tx: number; ty: number } {
  // progress: 0 → 1 across the scene.
  switch (move) {
    case "still":
      return { scale: 1, tx: 0, ty: 0 };
    case "push_in":
      return { scale: 1 + progress * 0.18, tx: 0, ty: 0 };
    case "pull_out":
      return { scale: 1.18 - progress * 0.18, tx: 0, ty: 0 };
    case "pan_lr":
      return { scale: 1.12, tx: -60 + progress * 120, ty: 0 };
    case "pan_rl":
      return { scale: 1.12, tx: 60 - progress * 120, ty: 0 };
    case "tilt_up":
      return { scale: 1.12, tx: 0, ty: 60 - progress * 120 };
    case "tilt_down":
      return { scale: 1.12, tx: 0, ty: -60 + progress * 120 };
    case "ken_burns":
      return { scale: 1 + progress * 0.1, tx: (progress - 0.5) * 40, ty: 0 };
  }
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
  cameraMove,
  colorGrade = "neutral",
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

  // Resolve camera move. Explicit `cameraMove` wins; fall back to legacy
  // kenBurns boolean which now maps to the diagonal drift template.
  const move = cameraMove ?? (kenBurns ? "ken_burns" : "still");
  const progress = Math.min(1, frame / Math.max(1, durationInFrames));
  const cam = cameraTransform(move, progress);

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
              transform: `scale(${cam.scale}) translate(${cam.tx}px, ${cam.ty}px)`,
              filter: gradeFilter(colorGrade),
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
