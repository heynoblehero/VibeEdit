import React from "react";
import { AbsoluteFill, Audio, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { CaptionStyle, Scene } from "@/lib/scene-schema";
import { BeatFlash } from "./components/BeatFlash";
import { BRollLayer } from "./components/BRoll";
import { Counter } from "./components/Counter";
import { GradientBg } from "./components/GradientBg";
import { PunchText } from "./components/PunchText";
import { ScreenShake } from "./components/ScreenShake";
import { ZoomPunch } from "./components/ZoomPunch";
import { Captions } from "./components/Captions";
import { Montage } from "./components/Montage";
import { GRAPHIC_MAP } from "./assets";
import { bob } from "@/lib/anim";

interface SceneRendererProps {
  scene: Scene;
  characters: Record<string, string>;
  sfx: Record<string, string>;
  captionStyle?: CaptionStyle;
}

const CHAR_HEIGHT = 550;

export const SceneRenderer: React.FC<SceneRendererProps> = ({
  scene,
  characters,
  sfx,
  captionStyle,
}) => {
  const s = scene;
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const graphicSrc = s.background.graphic ? GRAPHIC_MAP[s.background.graphic] : undefined;
  // sceneSfxUrl (AI-generated) takes priority over the library sfxId.
  const sfxSrc = s.sceneSfxUrl ?? (s.sfxId ? sfx[s.sfxId] : null);
  const charSrc = s.characterId ? characters[s.characterId] : null;

  const enterDelay = 3;
  const charProgress = spring({
    frame: Math.max(0, frame - enterDelay),
    fps,
    // Slightly under-damped so characters arrive with a soft overshoot —
    // feels intentional, not robotic linear lerp.
    config: { damping: 10, mass: 0.7, stiffness: 170 },
    durationInFrames: 22,
  });

  // Soft 4-frame opacity ramp on scene entry so cuts breathe instead of pop.
  const sceneOpacity = interpolate(frame, [0, 4], [0, 1], {
    extrapolateRight: "clamp",
  });

  let charTx = 0;
  let charTy = 0;
  let charScale = s.characterScale ?? 1;
  const enterFrom = s.enterFrom ?? "scale";
  if (enterFrom === "left") charTx = (1 - charProgress) * -800;
  else if (enterFrom === "right") charTx = (1 - charProgress) * 800;
  else if (enterFrom === "bottom") charTy = (1 - charProgress) * 500;
  else charScale *= charProgress;

  const charBob = frame > enterDelay + 20 ? bob(frame, 3, 50) : 0;
  const showChar = charSrc && frame >= enterDelay;

  const charX = s.characterX ?? (enterFrom === "left" ? 300 : enterFrom === "right" ? 1400 : 960);
  const charY = s.characterY ?? 900;

  return (
    <AbsoluteFill style={{ opacity: sceneOpacity }}>
    <GradientBg
      color={s.background.color}
      graphic={graphicSrc}
      graphicY={s.background.graphicY ?? 650}
      graphicOpacity={s.background.graphicOpacity ?? 0.5}
      vignette={s.background.vignette ?? 0.5}
      imageUrl={s.background.imageUrl}
      imageOpacity={s.background.imageOpacity}
      kenBurns={s.background.kenBurns}
      cameraMove={s.background.cameraMove}
      videoUrl={s.background.videoUrl}
      videoStartSec={s.background.videoStartSec}
      videoMuted={s.background.videoMuted}
    >
      {s.type === "montage" && s.montageUrls && s.montageUrls.length > 0 && (
        <Montage urls={s.montageUrls} />
      )}
      {s.type === "split" && (s.splitLeftUrl || s.splitRightUrl) && (
        <div style={{ position: "absolute", inset: 0, display: "flex" }}>
          {s.splitLeftUrl && (
            <img
              src={s.splitLeftUrl}
              alt=""
              style={{ width: "50%", height: "100%", objectFit: "cover" }}
            />
          )}
          {s.splitRightUrl && (
            <img
              src={s.splitRightUrl}
              alt=""
              style={{ width: "50%", height: "100%", objectFit: "cover" }}
            />
          )}
          <div
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: "50%",
              width: 6,
              transform: "translateX(-3px)",
              background: s.splitDivider ?? "#10b981",
              boxShadow: "0 0 18px rgba(0,0,0,0.6)",
            }}
          />
        </div>
      )}
      <BRollLayer brolls={s.broll} />
      <ZoomPunch hitFrame={s.zoomPunch ? 0 : 9999} intensity={s.zoomPunch ?? 1.15}>
        <ScreenShake hitFrame={s.shakeIntensity ? 5 : 9999} intensity={s.shakeIntensity ?? 0} duration={12}>

          {showChar && (
            <img
              src={charSrc}
              alt=""
              style={{
                position: "absolute",
                height: CHAR_HEIGHT * charScale,
                left: charX + charTx - (CHAR_HEIGHT * charScale * 0.4),
                top: charY + charTy + charBob - CHAR_HEIGHT * charScale,
                transform: `scaleX(${s.flipCharacter ? -1 : 1})`,
                transformOrigin: "center bottom",
                filter: "drop-shadow(0 8px 30px rgba(0,0,0,0.6))",
                objectFit: "contain",
              }}
            />
          )}

          {s.text && (
            <PunchText
              text={s.text}
              startFrame={3}
              fontSize={s.textSize ?? 64}
              color={s.textColor ?? "#888888"}
              y={s.textY ?? 300}
              staggerFrames={4}
            />
          )}

          {s.emphasisText && (
            <PunchText
              text={s.emphasisText}
              startFrame={12}
              fontSize={s.emphasisSize ?? 96}
              color={s.emphasisColor ?? "white"}
              glowColor={s.emphasisGlow}
              y={(s.textY ?? 300) + (s.textSize ?? 64) + 20}
              staggerFrames={5}
            />
          )}

          {s.subtitleText && (
            <PunchText
              text={s.subtitleText}
              startFrame={25}
              fontSize={36}
              color={s.subtitleColor ?? "#666666"}
              y={(s.textY ?? 300) + (s.textSize ?? 64) + (s.emphasisSize ?? 96) + 50}
              staggerFrames={3}
            />
          )}

          {s.type === "big_number" && s.numberTo !== undefined && (
            <Counter
              from={s.numberFrom ?? 0}
              to={s.numberTo}
              startFrame={5}
              duration={Math.round(s.duration * 15)}
              fontSize={140}
              color={s.numberColor ?? "#10b981"}
              glowColor={s.numberColor ? `${s.numberColor}66` : undefined}
              y={380}
              suffix={s.numberSuffix}
            />
          )}

        </ScreenShake>
      </ZoomPunch>

      {s.transition === "beat_flash" && <BeatFlash hitFrame={0} />}
      {s.transition === "beat_flash_colored" && (
        <BeatFlash hitFrame={0} color={s.transitionColor ?? "#10b981"} peakOpacity={0.25} />
      )}

      {sfxSrc && <Audio src={sfxSrc} startFrom={0} volume={0.7} />}
      {s.voiceover?.audioUrl && (
        <Audio src={s.voiceover.audioUrl} startFrom={0} volume={1} />
      )}
      {s.showCaptions !== false && s.voiceover?.captions && (
        <Captions
          words={s.voiceover.captions}
          style={captionStyle}
          characterY={s.characterY}
        />
      )}
    </GradientBg>
    </AbsoluteFill>
  );
};
