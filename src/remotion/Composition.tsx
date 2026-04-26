import React from "react";
import { AbsoluteFill, Audio, useCurrentFrame } from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import type { CaptionStyle, Cut, MusicBed, Scene } from "@/lib/scene-schema";
import { sceneDurationFrames } from "@/lib/scene-schema";
import { SceneRenderer } from "./SceneRenderer";
import { presentationFor } from "./cut-presentations";

interface CompositionProps {
  scenes: Scene[];
  fps: number;
  characters: Record<string, string>;
  sfx: Record<string, string>;
  music?: MusicBed;
  captionStyle?: CaptionStyle;
  cuts?: Cut[];
  /** Canvas dims — required by some transition presentations (iris, clockWipe). */
  width: number;
  height: number;
  /** Subtle filmic grain overlay. Defaults on. */
  filmGrain?: boolean;
}

const FilmGrain: React.FC = () => {
  // Slowly shift the noise seed so the grain animates instead of looking
  // like a static texture stuck to the lens.
  const frame = useCurrentFrame();
  const seed = Math.floor(frame / 2) % 1000;
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        mixBlendMode: "overlay",
        opacity: 0.18,
      }}
    >
      <svg width="100%" height="100%">
        <filter id="grain">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.9"
            numOctaves="2"
            seed={seed}
          />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#grain)" />
      </svg>
    </div>
  );
};

interface DuckingRange {
  from: number;
  duration: number;
}

function buildDuckingRanges(
  scenes: Scene[],
  fps: number,
): DuckingRange[] {
  const ranges: DuckingRange[] = [];
  let frameOffset = 0;
  for (const s of scenes) {
    const sceneDur = sceneDurationFrames(s, fps);
    if (s.voiceover?.audioUrl) {
      const vo = Math.round((s.voiceover.audioDurationSec ?? s.duration) * fps);
      ranges.push({
        from: frameOffset,
        duration: Math.min(sceneDur, vo),
      });
    }
    frameOffset += sceneDur;
  }
  return ranges;
}

/** Frames where the music should temporarily *swell* (over-volume). */
function buildSwellFrames(scenes: Scene[], fps: number): number[] {
  const out: number[] = [];
  let frameOffset = 0;
  for (const s of scenes) {
    const sceneDur = sceneDurationFrames(s, fps);
    // Stat / big_number / lensFlare / emphasis-text + non-narrated:
    // these are the moments where a 0.5s music swell sells the impact.
    const isImpact =
      s.type === "stat" ||
      s.type === "big_number" ||
      !!s.lensFlare ||
      (!!s.emphasisText && !s.voiceover?.audioUrl);
    if (isImpact) {
      // Swell starts at the beat (frame 0 of the scene + tiny lead) and
      // covers ~14 frames.
      out.push(frameOffset + Math.min(8, sceneDur / 4));
    }
    frameOffset += sceneDur;
  }
  return out;
}

export const VideoComposition: React.FC<CompositionProps> = ({
  scenes,
  fps,
  characters,
  sfx,
  music,
  captionStyle,
  cuts,
  width,
  height,
  filmGrain = true,
}) => {
  const totalFrames = scenes.reduce(
    (sum, s) => sum + sceneDurationFrames(s, fps),
    0,
  );
  const duckRanges = music ? buildDuckingRanges(scenes, fps) : [];
  const swellFrames = music ? buildSwellFrames(scenes, fps) : [];

  // Lookup table so we can find the cut between any two consecutive
  // scenes without scanning the project.cuts array per pair.
  const cutByPair = new Map<string, Cut>();
  for (const c of cuts ?? []) {
    cutByPair.set(`${c.fromSceneId}->${c.toSceneId}`, c);
  }

  // Build the TransitionSeries children inline. We emit a Sequence for
  // every scene and a Transition between consecutive scenes ONLY when
  // there's a cut with durationFrames > 0 — adjacent Sequences with no
  // Transition between them produce a hard cut, which is what we want
  // for the default case.
  const seriesChildren: React.ReactNode[] = [];
  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    const dur = sceneDurationFrames(scene, fps);
    seriesChildren.push(
      <TransitionSeries.Sequence key={`seq-${scene.id}`} durationInFrames={dur}>
        <SceneRenderer
          scene={scene}
          characters={characters}
          sfx={sfx}
          captionStyle={captionStyle}
        />
      </TransitionSeries.Sequence>,
    );
    const next = scenes[i + 1];
    if (next) {
      // Prefer the explicit project.cuts entry; fall back to
      // scene.transition for legacy projects saved before sprint 8.
      const cut = cutByPair.get(`${scene.id}->${next.id}`);
      const cutDur = cut?.durationFrames ?? 0;
      if (cutDur > 0) {
        seriesChildren.push(
          <TransitionSeries.Transition
            key={`trans-${scene.id}-${next.id}`}
            presentation={presentationFor(cut!.kind, { width, height, color: cut?.color })}
            timing={linearTiming({ durationInFrames: cutDur })}
          />,
        );
      }
    }
  }

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <TransitionSeries>{seriesChildren}</TransitionSeries>

      {music?.url && totalFrames > 0 && (
        <Audio
          src={music.url}
          startFrom={0}
          loop
          volume={(frame) => {
            // Anticipatory ducking: start fading down ~6 frames BEFORE the
            // narrator starts and ramping back up ~10 frames AFTER they
            // stop. Real broadcast audio does this — keeps voice clear at
            // the consonant attack instead of slamming on top of music.
            const lead = 6;
            const tail = 10;
            const baseVol = music.volume ?? 0.55;
            const duckVol = music.duckedVolume ?? 0.18;
            // Find proximity to nearest ducking range.
            let target = baseVol;
            for (const r of duckRanges) {
              const start = r.from - lead;
              const end = r.from + r.duration + tail;
              if (frame >= start && frame < end) {
                if (frame < r.from) {
                  // ducking down
                  const t = (frame - start) / lead;
                  target = baseVol + (duckVol - baseVol) * t;
                } else if (frame >= r.from + r.duration) {
                  // ducking back up
                  const t = (frame - (r.from + r.duration)) / tail;
                  target = duckVol + (baseVol - duckVol) * t;
                } else {
                  target = duckVol;
                }
                break;
              }
            }
            // Music swell on impact beats: 14-frame triangular envelope
            // bumping the bed up by 35% so stat/big_number reveals carry
            // weight even without an SFX hit.
            const swellWindow = 14;
            for (const sf of swellFrames) {
              if (frame >= sf && frame < sf + swellWindow) {
                const tw = frame - sf;
                const peak = swellWindow / 2;
                const swellAmt = tw < peak ? tw / peak : (swellWindow - tw) / peak;
                target = Math.min(1, target * (1 + swellAmt * 0.35));
                break;
              }
            }
            // Smooth fade in over first ~0.6s, fade out over last ~0.6s so
            // the bed never pops in/out at boundaries.
            const fadeFrames = Math.min(Math.round(fps * 0.6), Math.floor(totalFrames / 4));
            let envelope = 1;
            if (frame < fadeFrames) envelope = frame / fadeFrames;
            else if (frame > totalFrames - fadeFrames)
              envelope = Math.max(0, (totalFrames - frame) / fadeFrames);
            return target * envelope;
          }}
        />
      )}

      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.25) 100%)",
          pointerEvents: "none",
        }}
      />
      {filmGrain && <FilmGrain />}
    </AbsoluteFill>
  );
};
