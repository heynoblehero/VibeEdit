import React from "react";
import { AbsoluteFill, Img, OffthreadVideo, Sequence, useCurrentFrame, useVideoConfig } from "remotion";
import type { BRoll as BRollType, ImageFilter, Scene } from "@/lib/scene-schema";
import { resolveClipsForElement } from "@/lib/motion-clips";

interface Props {
  broll: BRollType;
  /** Parent scene — needed so the broll can resolve any motion clips
   *  targeting its id. */
  scene: Scene;
}

const VIDEO_W = 1920;
const VIDEO_H = 1080;

function layoutForPosition(position: BRollType["position"]) {
  switch (position) {
    case "full":
      return { left: 0, top: 0, width: VIDEO_W, height: VIDEO_H };
    case "overlay-tl":
      return { left: 60, top: 60, width: 560, height: 315 };
    case "overlay-tr":
      return { left: VIDEO_W - 620, top: 60, width: 560, height: 315 };
    case "overlay-bl":
      return { left: 60, top: VIDEO_H - 375, width: 560, height: 315 };
    case "overlay-br":
      return { left: VIDEO_W - 620, top: VIDEO_H - 375, width: 560, height: 315 };
    case "pip-left":
      return { left: 80, top: 260, width: 760, height: 560 };
    case "pip-right":
      return { left: VIDEO_W - 840, top: 260, width: 760, height: 560 };
    case "lower-third":
      return { left: 0, top: VIDEO_H - 400, width: VIDEO_W, height: 400 };
    default:
      return { left: 0, top: 0, width: VIDEO_W, height: VIDEO_H };
  }
}

function filterCss(f?: ImageFilter): string | undefined {
  if (!f) return undefined;
  const parts: string[] = [];
  if (f.brightness != null) parts.push(`brightness(${f.brightness})`);
  if (f.contrast != null) parts.push(`contrast(${f.contrast})`);
  if (f.saturation != null) parts.push(`saturate(${f.saturation})`);
  if (f.blur != null) parts.push(`blur(${f.blur}px)`);
  if (f.grayscale != null) parts.push(`grayscale(${f.grayscale})`);
  return parts.length ? parts.join(" ") : undefined;
}

export const BRoll: React.FC<Props> = ({ broll, scene }) => {
  const { fps } = useVideoConfig();
  // BRoll lives inside a <Sequence from={broll.startFrame}>, so the
  // scene-frame the resolver expects is the broll's startFrame plus the
  // local frame inside the sequence.
  const localFrame = useCurrentFrame();
  const sceneFrame = broll.startFrame + localFrame;
  const clip = resolveClipsForElement(scene, "broll", sceneFrame, broll.id);
  const layout = layoutForPosition(broll.position);
  const scale = (broll.scale ?? 1) * clip.scale;
  const isFull = broll.position === "full";
  const isVideoLike = broll.kind === "clip" || broll.kind === "gif";

  const transformParts: string[] = [];
  if (scale !== 1) transformParts.push(`scale(${scale})`);
  if (clip.rotation) transformParts.push(`rotate(${clip.rotation}deg)`);

  const borderRadius =
    broll.borderRadius != null ? broll.borderRadius : isFull ? 0 : 16;
  const shadowKind = broll.shadow ?? (isFull ? "none" : "soft");
  const shadowColor = broll.shadowColor ?? "#ffffff";
  const boxShadow =
    shadowKind === "none"
      ? undefined
      : shadowKind === "soft"
        ? "0 12px 40px rgba(0,0,0,0.55)"
        : shadowKind === "hard"
          ? "0 8px 0 rgba(0,0,0,0.85)"
          : `0 0 32px ${shadowColor}, 0 0 64px ${shadowColor}`;
  const border =
    broll.borderColor && (broll.borderWidth ?? 0) > 0
      ? `${broll.borderWidth}px solid ${broll.borderColor}`
      : undefined;

  const style: React.CSSProperties = {
    position: "absolute",
    left: layout.left + (broll.offsetX ?? 0) + clip.tx,
    top: layout.top + (broll.offsetY ?? 0) + clip.ty,
    width: layout.width,
    height: layout.height,
    opacity: (broll.opacity ?? 1) * clip.opacity,
    transform: transformParts.length ? transformParts.join(" ") : undefined,
    transformOrigin: "center center",
    overflow: "hidden",
    borderRadius,
    border,
    boxShadow,
    filter: filterCss(broll.filter),
  };

  const mediaStyle: React.CSSProperties = {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  };

  const inner = (() => {
    if (broll.kind === "image") {
      return <Img src={broll.url} style={mediaStyle} />;
    }
    if (broll.kind === "gif") {
      // GIFs render fine via <img>; OffthreadVideo doesn't play them.
      return <img src={broll.url} style={mediaStyle} alt="" />;
    }
    return (
      <OffthreadVideo
        src={broll.url}
        style={mediaStyle}
        muted
        playbackRate={1}
      />
    );
  })();

  return (
    <Sequence from={broll.startFrame} durationInFrames={broll.durationFrames}>
      <AbsoluteFill>
        <div style={style}>{inner}</div>
      </AbsoluteFill>
    </Sequence>
  );
};

export const BRollLayer: React.FC<{ brolls?: BRollType[]; scene: Scene }> = ({ brolls, scene }) => {
  if (!brolls || brolls.length === 0) return null;
  return (
    <>
      {brolls.map((b) => (
        <BRoll key={b.id} broll={b} scene={scene} />
      ))}
    </>
  );
};
