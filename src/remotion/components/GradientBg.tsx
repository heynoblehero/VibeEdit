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
  blur?: number;
  brightness?: number;
  contrast?: number;
  saturation?: number;
  temperature?: number;
  videoUrl?: string;
  videoStartSec?: number;
  videoMuted?: boolean;
  drift?: boolean;
  /** Chroma-key the bg image/video. See SceneBackground.chromaKey. */
  chromaKey?: { color: string; tolerance: number; softness: number };
  /** Luma-key the bg image/video. See SceneBackground.lumaKey. */
  lumaKey?: { threshold: number; softness: number; invert?: boolean };
  /** Stable suffix used when generating SVG filter ids (per-scene). */
  filterIdSuffix?: string;
  /** Mirror bg image/video horizontally / vertically. */
  flipH?: boolean;
  flipV?: boolean;
  /** Rotate bg image/video by 90/180/270 degrees. */
  rotate?: 0 | 90 | 180 | 270;
  /** CSS object-fit / object-position passed through to bg media. */
  objectFit?: "cover" | "contain";
  objectPosition?: string;
  /** User-direct size + offset for image/video. Stack on top of cameraMove. */
  imageScale?: number;
  imageOffsetX?: number;
  imageOffsetY?: number;
  /** Explicit px size for the image. When set, image renders centered in a px-sized box instead of full-frame. */
  imageWidthPx?: number;
  imageHeightPx?: number;
  videoScale?: number;
  videoOffsetX?: number;
  videoOffsetY?: number;
  /** Explicit px size for the video. */
  videoWidthPx?: number;
  videoHeightPx?: number;
  children?: React.ReactNode;
}

/** 9-grid alignment names → CSS object-position percentages. */
function resolveObjectPosition(p?: string): string {
  if (!p || p === "center") return "center center";
  switch (p) {
    case "top": return "center top";
    case "bottom": return "center bottom";
    case "left": return "left center";
    case "right": return "right center";
    case "top-left": return "left top";
    case "top-right": return "right top";
    case "bottom-left": return "left bottom";
    case "bottom-right": return "right bottom";
    default: return p; // free-form "x% y%"
  }
}

/**
 * Builds an SVG <filter> for chroma-keying a single dominant-channel
 * color (greenscreen / bluescreen / redscreen). Pixels close to the key
 * color along the dominant axis are made transparent; the rest pass
 * through unchanged. tolerance shifts the cutoff; softness widens the
 * feathered band.
 */
function chromaKeyMatrix(color: string): [number, number, number] {
  const r = parseInt(color.slice(1, 3), 16) / 255;
  const g = parseInt(color.slice(3, 5), 16) / 255;
  const b = parseInt(color.slice(5, 7), 16) / 255;
  if (g >= r && g >= b) return [-1, 2, -1];
  if (b >= r && b >= g) return [-1, -1, 2];
  return [2, -1, -1];
}

/**
 * tableValues for luma-key feFuncA. We want pixels with luminance below
 * `threshold` to be culled (alpha=0). softness widens the feather band
 * around the threshold. invert flips the direction (cull bright pixels).
 */
function lumaTable(threshold: number, softness: number, invert: boolean): string {
  const t = Math.max(0, Math.min(1, threshold));
  const s = Math.max(0, Math.min(0.5, softness));
  // Build 16 evenly-spaced samples across [0..1] luminance.
  const N = 16;
  const vals: number[] = [];
  for (let i = 0; i < N; i++) {
    const x = i / (N - 1);
    let alpha: number;
    if (s === 0) alpha = x >= t ? 1 : 0;
    else {
      // Smooth ramp from (t-s) → (t+s).
      const lo = t - s;
      const hi = t + s;
      if (x <= lo) alpha = 0;
      else if (x >= hi) alpha = 1;
      else alpha = (x - lo) / (hi - lo);
    }
    if (invert) alpha = 1 - alpha;
    vals.push(alpha);
  }
  return vals.map((v) => v.toFixed(3)).join(" ");
}

function chromaTable(softness: number): string {
  const s = Math.max(0, Math.min(1, softness));
  // soft=0 → "1 0" (hard step). soft=1 → smooth gradient with 8 steps.
  const steps = Math.max(2, Math.round(2 + s * 6));
  const half = Math.floor(steps / 2);
  const vals: number[] = [];
  for (let i = 0; i < half; i++) vals.push(1);
  for (let i = half; i < steps; i++) {
    // Smooth tail when soft > 0 — interpolate from 1 → 0 across remaining
    // steps so edges feather instead of hard-cutting.
    if (s === 0) vals.push(0);
    else vals.push(Math.max(0, 1 - (i - half + 1) / (steps - half)));
  }
  return vals.join(" ");
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
  blur = 0,
  brightness = 1,
  contrast = 1,
  saturation = 1,
  temperature = 0,
  videoUrl,
  videoStartSec = 0,
  videoMuted = true,
  drift = true,
  chromaKey,
  lumaKey,
  filterIdSuffix = "default",
  flipH = false,
  flipV = false,
  rotate = 0,
  objectFit = "cover",
  objectPosition,
  imageScale,
  imageOffsetX = 0,
  imageOffsetY = 0,
  imageWidthPx,
  imageHeightPx,
  videoScale,
  videoOffsetX = 0,
  videoOffsetY = 0,
  videoWidthPx,
  videoHeightPx,
  children,
}) => {
  const resolvedObjectPosition = resolveObjectPosition(objectPosition);
  const orientationTransform = (() => {
    const parts: string[] = [];
    if (rotate) parts.push(`rotate(${rotate}deg)`);
    if (flipH) parts.push("scaleX(-1)");
    if (flipV) parts.push("scaleY(-1)");
    return parts.join(" ");
  })();
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const driftX = drift ? bob(frame, 8, 200) : 0;
  const driftY = drift ? bob(frame + 50, 5, 160) : 0;

  // Resolve camera move. Explicit `cameraMove` wins; fall back to legacy
  // kenBurns boolean which now maps to the diagonal drift template.
  const move = cameraMove ?? (kenBurns ? "ken_burns" : "still");
  const progress = Math.min(1, frame / Math.max(1, durationInFrames));
  const cam = cameraTransform(move, progress);

  // When neither image nor video is set, the bare color background
  // looks like the renderer crashed. Replace with a slow animated radial
  // gradient that pulses ±8% lightness so the scene reads alive.
  const noMedia = !videoUrl && !imageUrl;

  // Per-scene SVG filter ids — collide-free across composition since the
  // suffix is the scene id when called from SceneRenderer.
  const chromaId = chromaKey ? `chroma-${filterIdSuffix}` : null;
  const lumaId = lumaKey ? `luma-${filterIdSuffix}` : null;
  const keyFilters: string[] = [];
  if (chromaId) keyFilters.push(`url(#${chromaId})`);
  if (lumaId) keyFilters.push(`url(#${lumaId})`);

  return (
    <AbsoluteFill style={{ backgroundColor: color, overflow: "hidden" }}>
      {(chromaKey || lumaKey) && (
        <svg
          width="0"
          height="0"
          style={{ position: "absolute", pointerEvents: "none" }}
          aria-hidden
        >
          <defs>
            {chromaKey && chromaId && (
              <filter id={chromaId} colorInterpolationFilters="sRGB">
                <feColorMatrix
                  type="matrix"
                  values={`1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  ${chromaKeyMatrix(chromaKey.color).join(" ")} 0 ${(-Math.max(0, Math.min(1, chromaKey.tolerance))).toFixed(3)}`}
                  result="keyed"
                />
                <feComponentTransfer in="keyed" result="mask">
                  <feFuncA type="table" tableValues={chromaTable(chromaKey.softness)} />
                </feComponentTransfer>
                <feComposite operator="in" in="SourceGraphic" in2="mask" />
              </filter>
            )}
            {lumaKey && lumaId && (
              <filter id={lumaId} colorInterpolationFilters="sRGB">
                <feColorMatrix
                  type="luminanceToAlpha"
                  result="lum"
                />
                <feComponentTransfer in="lum" result="mask">
                  <feFuncA
                    type="table"
                    tableValues={lumaTable(lumaKey.threshold, lumaKey.softness, !!lumaKey.invert)}
                  />
                </feComponentTransfer>
                <feComposite operator="in" in="SourceGraphic" in2="mask" />
              </filter>
            )}
          </defs>
        </svg>
      )}
      {noMedia && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `radial-gradient(ellipse at ${50 + Math.sin(frame / 60) * 12}% ${50 + Math.cos(frame / 70) * 10}%, ${color}ee 0%, ${color} 60%, ${color}88 100%)`,
            transition: "none",
          }}
        />
      )}
      {videoUrl && (() => {
        const videoBoxed = videoWidthPx !== undefined || videoHeightPx !== undefined;
        const boxStyle: React.CSSProperties = videoBoxed
          ? {
              position: "absolute",
              top: "50%",
              left: "50%",
              width: videoWidthPx !== undefined ? `${videoWidthPx}px` : "100%",
              height: videoHeightPx !== undefined ? `${videoHeightPx}px` : "100%",
              transform: "translate(-50%, -50%)",
              overflow: "hidden",
            }
          : { position: "absolute", inset: 0, overflow: "hidden" };
        return (
          <div style={boxStyle}>
            <OffthreadVideo
              src={videoUrl}
              startFrom={Math.round(videoStartSec * 30)}
              muted={videoMuted}
              style={{
                width: "100%",
                height: "100%",
                objectFit,
                objectPosition: resolvedObjectPosition,
                filter: keyFilters.length ? keyFilters.join(" ") : undefined,
                // User scale/offset stacks ON TOP of orientation flips —
                // lets the user shrink/move a clip without losing flips.
                transform:
                  [
                    videoScale !== undefined ? `scale(${videoScale})` : null,
                    videoOffsetX || videoOffsetY
                      ? `translate(${videoOffsetX}px, ${videoOffsetY}px)`
                      : null,
                    orientationTransform || null,
                  ]
                    .filter(Boolean)
                    .join(" ") || undefined,
                transformOrigin: "center center",
              }}
            />
          </div>
        );
      })()}
      {imageUrl && (
        <div
          style={
            imageWidthPx !== undefined || imageHeightPx !== undefined
              ? {
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  width: imageWidthPx !== undefined ? `${imageWidthPx}px` : "100%",
                  height: imageHeightPx !== undefined ? `${imageHeightPx}px` : "100%",
                  transform: "translate(-50%, -50%)",
                  opacity: imageOpacity,
                  overflow: "hidden",
                }
              : {
                  position: "absolute",
                  inset: 0,
                  opacity: imageOpacity,
                  overflow: "hidden",
                }
          }
        >
          <Img
            src={imageUrl}
            style={{
              width: "100%",
              height: "100%",
              objectFit,
              objectPosition: resolvedObjectPosition,
              transform: [
                imageScale !== undefined ? `scale(${imageScale})` : null,
                imageOffsetX || imageOffsetY
                  ? `translate(${imageOffsetX}px, ${imageOffsetY}px)`
                  : null,
                `scale(${cam.scale}) translate(${cam.tx}px, ${cam.ty}px)`,
                orientationTransform,
              ]
                .filter(Boolean)
                .join(" "),
              filter: [
                gradeFilter(colorGrade),
                brightness !== 1 ? `brightness(${brightness})` : null,
                contrast !== 1 ? `contrast(${contrast})` : null,
                saturation !== 1 ? `saturate(${saturation})` : null,
                temperature !== 0 ? `hue-rotate(${(temperature * 20).toFixed(1)}deg)` : null,
                blur > 0 ? `blur(${blur}px)` : null,
                ...keyFilters,
              ]
                .filter(Boolean)
                .join(" "),
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
