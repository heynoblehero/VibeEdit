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
import { LensFlare } from "./components/LensFlare";
import { Montage } from "./components/Montage";
import { StatBlock } from "./components/StatBlock";
import { CirclePing, RadialPulse, ScanLine } from "./components/effects";
import { BarWipe, CornerBrackets, RevealBox } from "./components/graphics";
import { Arrow, Highlight } from "./components/Annotation";
import { Particles } from "./components/Particles";
import { ProgressBar } from "./components/ProgressBar";
import { ThreeCard, ThreeParticles, ThreeText } from "./components/Three3D";
import { Glitch, Typewriter } from "./components/TextEffects";
import { BarChart } from "./components/BarChart";
import { BulletList } from "./components/BulletList";
import { LowerThird } from "./components/LowerThird";
import { QuoteBlock } from "./components/QuoteBlock";
import { SlideTransition, ZoomBlur } from "./components/SlideTransition";
import { GRAPHIC_MAP } from "./assets";
import { bob } from "@/lib/anim";

interface SceneRendererProps {
  scene: Scene;
  characters: Record<string, string>;
  sfx: Record<string, string>;
  captionStyle?: CaptionStyle;
  /**
   * When false, SceneRenderer skips its own per-scene <Audio> elements
   * (voiceover + sfx). The host (Composition.tsx) renders them at the
   * composition level instead so J/L cuts can shift audio independently
   * of the visual sequence start.
   *
   * Single-scene preview (via SingleSceneWrapper) keeps it true so
   * isolated previews still play sound.
   */
  renderAudio?: boolean;
}

const CHAR_HEIGHT = 550;

export const SceneRenderer: React.FC<SceneRendererProps> = ({
  scene,
  characters,
  sfx,
  captionStyle,
  renderAudio = true,
}) => {
  const s = scene;
  const frame = useCurrentFrame();
  const { fps, width: frameW, height: frameH } = useVideoConfig();
  // Default text Y: 28% from top. Lands cleanly above center on either AR
  // and lets us size emphasis/subtitle stacks below it without overflow.
  const defaultTextY = Math.round(frameH * 0.28);
  void frameW;
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
      colorGrade={s.background.colorGrade}
      blur={s.background.blur}
      videoUrl={s.background.videoUrl}
      videoStartSec={s.background.videoStartSec}
      videoMuted={s.background.videoMuted}
    >
      {s.type === "montage" && s.montageUrls && s.montageUrls.length > 0 && (
        <Montage urls={s.montageUrls} />
      )}
      {s.type === "stat" && s.statValue && (
        <StatBlock value={s.statValue} label={s.statLabel} color={s.statColor} />
      )}
      {s.type === "bullet_list" && s.bulletItems && s.bulletItems.length > 0 && (
        <BulletList items={s.bulletItems} color={s.bulletColor} />
      )}
      {s.type === "quote" && s.quoteText && (
        <QuoteBlock
          text={s.quoteText}
          attribution={s.quoteAttribution}
          color={s.bulletColor}
        />
      )}
      {s.type === "bar_chart" && s.chartBars && s.chartBars.length > 0 && (
        <BarChart bars={s.chartBars} title={s.chartTitle} unit={s.chartUnit} />
      )}
      {s.type === "three_text" && s.threeText && (
        <ThreeText text={s.threeText} accent={s.threeAccentColor} />
      )}
      {s.type === "three_card" && s.threeCardImageUrl && (
        <ThreeCard imageUrl={s.threeCardImageUrl} accent={s.threeAccentColor} />
      )}
      {s.type === "three_particles" && (
        <ThreeParticles count={s.threeParticleCount} accent={s.threeAccentColor} />
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
       {/* Secondary subtle zoom when emphasis text appears (frame 12)
           so the reveal feels punctuated without needing a full beat. */}
       <ZoomPunch hitFrame={s.emphasisText ? 12 : 9999} intensity={1.05}>
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
              y={s.textY ?? defaultTextY}
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
              y={(s.textY ?? defaultTextY) + (s.textSize ?? 64) + 20}
              staggerFrames={5}
            />
          )}

          {s.subtitleText && (
            <PunchText
              text={s.subtitleText}
              startFrame={25}
              fontSize={36}
              color={s.subtitleColor ?? "#666666"}
              y={(s.textY ?? defaultTextY) + (s.textSize ?? 64) + (s.emphasisSize ?? 96) + 50}
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
      </ZoomPunch>

      {s.lensFlare && <LensFlare hitFrame={0} color={s.lensFlareColor} />}
      {s.effects?.map((e, i) => {
        const start = e.startFrame ?? 0;
        switch (e.kind) {
          case "circle_ping":
            return (
              <CirclePing
                key={i}
                hitFrame={start}
                color={e.color}
                size={e.size}
                x={typeof e.x === "number" ? e.x : undefined}
                y={typeof e.y === "number" ? e.y : undefined}
              />
            );
          case "radial_pulse":
            return <RadialPulse key={i} hitFrame={start} color={e.color} />;
          case "scan_line":
            return <ScanLine key={i} hitFrame={start} color={e.color} />;
          case "bar_wipe":
            return (
              <BarWipe
                key={i}
                startFrame={start}
                text={e.text}
                color={e.color}
                y={e.y}
                height={e.size}
              />
            );
          case "corner_brackets":
            return (
              <CornerBrackets
                key={i}
                startFrame={start}
                color={e.color}
                thickness={e.thickness}
              />
            );
          case "reveal_box":
            return (
              <RevealBox
                key={i}
                startFrame={start}
                color={e.color}
                thickness={e.thickness}
                x={e.x}
                y={e.y}
                w={e.w}
                h={e.h}
              />
            );
          case "lower_third":
            return (
              <LowerThird
                key={i}
                startFrame={start}
                text={e.text}
                subtext={e.subtext}
                textColor={e.color}
              />
            );
          case "typewriter":
            return (
              <Typewriter
                key={i}
                startFrame={start}
                text={e.text ?? ""}
                color={e.color}
                fontSize={e.size}
                y={e.y}
              />
            );
          case "glitch":
            return (
              <Glitch
                key={i}
                startFrame={start}
                text={e.text ?? ""}
                color={e.color}
                fontSize={e.size}
                y={e.y}
              />
            );
          case "arrow":
            return (
              <Arrow
                key={i}
                startFrame={start}
                fromX={e.fromX}
                fromY={e.fromY}
                toX={e.x}
                toY={e.y}
                color={e.color}
                thickness={e.thickness}
              />
            );
          case "highlight":
            return (
              <Highlight
                key={i}
                startFrame={start}
                x={e.x}
                y={e.y}
                w={e.w}
                h={e.h}
                color={e.color}
              />
            );
          case "particles":
            return (
              <Particles
                key={i}
                startFrame={start}
                color={e.color}
                count={e.size}
                x={typeof e.x === "number" ? e.x : undefined}
                y={typeof e.y === "number" ? e.y : undefined}
              />
            );
          case "progress_bar":
            return (
              <ProgressBar
                key={i}
                startFrame={start}
                to={e.to}
                color={e.color}
                label={e.text}
                y={e.y}
              />
            );
        }
      })}
      {s.transition === "beat_flash" && <BeatFlash hitFrame={0} />}
      {s.transition === "beat_flash_colored" && (
        <BeatFlash hitFrame={0} color={s.transitionColor ?? "#10b981"} peakOpacity={0.25} />
      )}
      {s.transition === "slide_left" && (
        <SlideTransition direction="left" color={s.transitionColor} />
      )}
      {s.transition === "slide_right" && (
        <SlideTransition direction="right" color={s.transitionColor} />
      )}
      {s.transition === "zoom_blur" && <ZoomBlur />}

      {/* Audio rendered here only when renderAudio is true (single-scene
          preview path). Composition.tsx renders the same elements at the
          top level for the full timeline so J/L cuts can shift them. */}
      {renderAudio && sfxSrc && <Audio src={sfxSrc} startFrom={0} volume={0.7} />}
      {renderAudio && s.voiceover?.audioUrl && (
        <Audio
          src={s.voiceover.audioUrl}
          startFrom={0}
          volume={(f) => {
            const fade = 3;
            const total = Math.round((s.voiceover?.audioDurationSec ?? s.duration) * fps);
            if (f < fade) return f / fade;
            if (f > total - fade) return Math.max(0, (total - f) / fade);
            return 1;
          }}
        />
      )}
      {s.showCaptions !== false && s.voiceover?.captions && (
        <Captions
          words={s.voiceover.captions}
          style={captionStyle}
          characterY={s.characterY}
          reservedZones={(() => {
            // Bands occupied by in-scene text layers, expressed in canvas
            // pixels. Captions sees these and picks an unused band.
            const zones: Array<{ top: number; bottom: number }> = [];
            const baseY = s.textY ?? defaultTextY;
            if (s.text) {
              zones.push({ top: baseY, bottom: baseY + (s.textSize ?? 64) * 1.4 });
            }
            if (s.emphasisText) {
              const eY = baseY + (s.textSize ?? 64) + 20;
              zones.push({ top: eY, bottom: eY + (s.emphasisSize ?? 96) * 1.4 });
            }
            if (s.subtitleText) {
              const sY = baseY + (s.textSize ?? 64) + (s.emphasisSize ?? 96) + 50;
              zones.push({ top: sY, bottom: sY + 36 * 1.4 });
            }
            // big_number Counter is centered at y=380 — block the middle.
            if (s.type === "big_number") zones.push({ top: 350, bottom: 540 });
            // stat scene takes the whole center.
            if (s.type === "stat") zones.push({ top: frameH * 0.3, bottom: frameH * 0.65 });
            return zones;
          })()}
        />
      )}
    </GradientBg>
    </AbsoluteFill>
  );
};
