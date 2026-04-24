import React from "react";
import { AbsoluteFill, Img, OffthreadVideo, Sequence, useVideoConfig } from "remotion";
import type { BRoll as BRollType, ImageFilter } from "@/lib/scene-schema";

interface Props {
  broll: BRollType;
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

export const BRoll: React.FC<Props> = ({ broll }) => {
  const { fps } = useVideoConfig();
  const layout = layoutForPosition(broll.position);
  const scale = broll.scale ?? 1;
  const isFull = broll.position === "full";
  const isVideoLike = broll.kind === "clip" || broll.kind === "gif";

  const style: React.CSSProperties = {
    position: "absolute",
    left: layout.left + (broll.offsetX ?? 0),
    top: layout.top + (broll.offsetY ?? 0),
    width: layout.width,
    height: layout.height,
    opacity: broll.opacity ?? 1,
    transform: scale !== 1 ? `scale(${scale})` : undefined,
    transformOrigin: "center center",
    overflow: "hidden",
    borderRadius: isFull ? 0 : 16,
    boxShadow: isFull ? undefined : "0 12px 40px rgba(0,0,0,0.55)",
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

export const BRollLayer: React.FC<{ brolls?: BRollType[] }> = ({ brolls }) => {
  if (!brolls || brolls.length === 0) return null;
  return (
    <>
      {brolls.map((b) => (
        <BRoll key={b.id} broll={b} />
      ))}
    </>
  );
};
