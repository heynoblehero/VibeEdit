import React from "react";
import { AbsoluteFill, Audio, Sequence, useCurrentFrame } from "remotion";
import type { CaptionStyle, MusicBed, Scene } from "@/lib/scene-schema";
import { sceneDurationFrames } from "@/lib/scene-schema";
import { SceneRenderer } from "./SceneRenderer";

interface CompositionProps {
  scenes: Scene[];
  fps: number;
  characters: Record<string, string>;
  sfx: Record<string, string>;
  music?: MusicBed;
  captionStyle?: CaptionStyle;
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

export const VideoComposition: React.FC<CompositionProps> = ({
  scenes,
  fps,
  characters,
  sfx,
  music,
  captionStyle,
  filmGrain = true,
}) => {
  let frameOffset = 0;
  const totalFrames = scenes.reduce(
    (sum, s) => sum + sceneDurationFrames(s, fps),
    0,
  );
  const duckRanges = music ? buildDuckingRanges(scenes, fps) : [];

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {scenes.map((scene) => {
        const dur = sceneDurationFrames(scene, fps);
        const el = (
          <Sequence key={scene.id} from={frameOffset} durationInFrames={dur}>
            <SceneRenderer
              scene={scene}
              characters={characters}
              sfx={sfx}
              captionStyle={captionStyle}
            />
          </Sequence>
        );
        frameOffset += dur;
        return el;
      })}

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
