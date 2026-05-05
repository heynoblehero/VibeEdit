import React from "react";
import { AbsoluteFill, Audio, Sequence, useCurrentFrame } from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { resolveEasing } from "@/lib/anim";
import type { AudioSfxClip, CaptionStyle, Cut, MusicBed, Scene, Track } from "@/lib/scene-schema";
import { sceneDurationFrames } from "@/lib/scene-schema";
import { SceneRenderer } from "./SceneRenderer";
import { presentationFor } from "./cut-presentations";

/** Build a Remotion timing object honoring the cut's `easing` (and
 *  custom bezier when easing === "custom"). Falls back to the linear
 *  default when nothing is set. */
function timingFor(cut: Cut, durationInFrames: number) {
  return linearTiming({
    durationInFrames,
    easing: resolveEasing(cut.easing, cut.bezier),
  });
}

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
  /** Project-wide audio mix gains (0–2). Each defaults to 1. */
  audioMix?: { music?: number; voice?: number; sfx?: number };
  /** Free-floating SFX clips placed on the project timeline (Audio
   *  workspace). Each becomes an extra audio rail at its startFrame. */
  sfxClips?: AudioSfxClip[];
  /**
   * Multi-track timeline (M2). When undefined, falls back to the
   * single-track behaviour using the `scenes` prop directly. When
   * defined, each track is rendered as its own layer at trackStartSec
   * with optional opacity / blendMode (overlay only). Audio-only
   * tracks contribute their audio rails but skip visuals.
   */
  tracks?: Track[];
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

/**
 * Renders one free-floating SFX clip as an audio rail. Lives outside
 * the per-scene loop because the clip is positioned absolutely on the
 * project timeline (startFrame), not relative to a scene.
 */
const FreeSfxClipRail: React.FC<{
  clip: AudioSfxClip;
  fps: number;
  mixSfx: number;
}> = ({ clip, fps, mixSfx }) => {
  const startFromFrames = Math.max(0, Math.round((clip.trimStartSec ?? 0) * fps));
  const endAtFrames = clip.trimEndSec
    ? Math.max(startFromFrames + 1, Math.round(clip.trimEndSec * fps))
    : undefined;
  const fadeInF = Math.max(0, Math.round((clip.fadeInSec ?? 0) * fps));
  const fadeOutF = Math.max(0, Math.round((clip.fadeOutSec ?? 0) * fps));
  const gain = Math.max(0, Math.min(2, clip.gain ?? 1));
  const dur = Math.max(1, clip.durationFrames);
  return (
    <Sequence from={Math.max(0, clip.startFrame)} durationInFrames={dur}>
      <Audio
        src={clip.url}
        startFrom={startFromFrames}
        endAt={endAtFrames}
        volume={(f) => {
          const minEdge = 2;
          const fIn = Math.max(minEdge, fadeInF);
          const fOut = Math.max(minEdge, fadeOutF);
          let env = 1;
          if (f < fIn) env = f / fIn;
          else if (f > dur - fOut) env = Math.max(0, (dur - f) / fOut);
          return env * gain * mixSfx;
        }}
      />
    </Sequence>
  );
};

/**
 * Per-scene start frame on the global timeline. Index aligns with `scenes`.
 */
function buildSceneStartFrames(scenes: Scene[], fps: number): number[] {
  const starts: number[] = [];
  let frameOffset = 0;
  for (const s of scenes) {
    starts.push(frameOffset);
    frameOffset += sceneDurationFrames(s, fps);
  }
  return starts;
}

/**
 * Per-scene voiceover *audio* start frame on the global timeline. This
 * is the visual start frame minus the J-cut audioLeadFrames from the
 * cut leading into this scene (audio-leads-visual).
 */
function buildAudioStartFrames(
  scenes: Scene[],
  fps: number,
  cuts: Cut[] | undefined,
): number[] {
  const visualStarts = buildSceneStartFrames(scenes, fps);
  if (!cuts || cuts.length === 0) return visualStarts.slice();
  const cutByPair = new Map<string, Cut>();
  for (const c of cuts) cutByPair.set(`${c.fromSceneId}->${c.toSceneId}`, c);
  return scenes.map((s, i) => {
    const prev = scenes[i - 1];
    if (!prev) return visualStarts[i];
    const cut = cutByPair.get(`${prev.id}->${s.id}`);
    return visualStarts[i] - (cut?.audioLeadFrames ?? 0);
  });
}

function buildDuckingRanges(
  scenes: Scene[],
  fps: number,
  cuts: Cut[] | undefined,
): DuckingRange[] {
  const audioStarts = buildAudioStartFrames(scenes, fps, cuts);
  const ranges: DuckingRange[] = [];
  for (let i = 0; i < scenes.length; i++) {
    const s = scenes[i];
    if (!s.voiceover?.audioUrl) continue;
    const vo = Math.round((s.voiceover.audioDurationSec ?? s.duration) * fps);
    const sceneDur = sceneDurationFrames(s, fps);
    ranges.push({
      from: audioStarts[i],
      duration: Math.min(sceneDur + (audioStarts[i + 1]
        ? audioStarts[i + 1] - audioStarts[i]
        : sceneDur), vo),
    });
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
  scenes: rawScenes,
  fps,
  characters,
  sfx,
  music,
  captionStyle,
  cuts,
  width,
  height,
  filmGrain = true,
  audioMix,
  sfxClips,
  tracks,
}) => {
  // Multi-track path (M2). Defined tracks → render each as its own
  // layer; legacy single-track render is the fallback.
  if (tracks && tracks.length > 0) {
    return (
      <MultiTrackRender
        rawScenes={rawScenes}
        tracks={tracks}
        fps={fps}
        characters={characters}
        sfx={sfx}
        music={music}
        captionStyle={captionStyle}
        cuts={cuts}
        width={width}
        height={height}
        filmGrain={filmGrain}
        audioMix={audioMix}
        sfxClips={sfxClips}
      />
    );
  }
  // Muted scenes are skipped at the comp level: they don't contribute
  // visuals OR audio to the render, but the Timeline UI still shows
  // them dimmed so the user can re-enable later.
  const scenes = rawScenes.filter((s) => !s.muted);
  // Master mix gains — clamp to the same 0–2 window the per-scene
  // audioGain uses so a runaway Project.audioMix can't blow the bus.
  const mixVoice = Math.max(0, Math.min(2, audioMix?.voice ?? 1));
  const mixSfx = Math.max(0, Math.min(2, audioMix?.sfx ?? 1));
  const mixMusic = Math.max(0, Math.min(2, audioMix?.music ?? 1));
  const totalFrames = scenes.reduce(
    (sum, s) => sum + sceneDurationFrames(s, fps),
    0,
  );
  const duckRanges = music ? buildDuckingRanges(scenes, fps, cuts) : [];
  const swellFrames = music ? buildSwellFrames(scenes, fps) : [];
  const audioStarts = buildAudioStartFrames(scenes, fps, cuts);
  const cutByPairForAudio = new Map<string, Cut>();
  for (const c of cuts ?? []) cutByPairForAudio.set(`${c.fromSceneId}->${c.toSceneId}`, c);

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
          renderAudio={false}
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
            timing={timingFor(cut!, cutDur)}
          />,
        );
      }
    }
  }

  // Per-scene audio rails rendered at composition level so J/L cuts can
  // shift them independently of the visual sequence start. Each scene's
  // voiceover lives inside a <Sequence from={audioStart}> so a J cut
  // (audioLeadFrames > 0) starts the audio before the visual cut and an
  // L cut (audioTrailFrames > 0 on the OUTGOING scene's cut) keeps the
  // audio playing past the cut by leaving its sequence-end past the
  // visual end. Outgoing trail = read the cut-leading-INTO-NEXT scene.
  const audioRails: React.ReactNode[] = [];
  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    const sceneDur = sceneDurationFrames(scene, fps);
    const audioStart = audioStarts[i];
    // Outgoing trail: the cut going from this scene to the next determines
    // how much we extend this scene's audio past the visual cut.
    const next = scenes[i + 1];
    const trailFrames = next
      ? cutByPairForAudio.get(`${scene.id}->${next.id}`)?.audioTrailFrames ?? 0
      : 0;
    const voDurFrames = scene.voiceover?.audioDurationSec
      ? Math.round(scene.voiceover.audioDurationSec * fps)
      : sceneDur;
    const audioDur = Math.max(1, sceneDur + trailFrames);
    if (scene.voiceover?.audioUrl) {
      // Per-scene audioGain multiplies the fade envelope. Defaults to 1.
      const gain = Math.max(0, Math.min(2, scene.audioGain ?? 1));
      const clipGain = Math.max(0, Math.min(2, scene.voiceover.gain ?? 1));
      // Speed warp: voiceover playback rate follows the scene's speed
      // factor. 0.5 = half-speed playback (slow-mo dialogue); 2.0 =
      // chipmunk audio. Pitch shift is intentional — matches every
      // other NLE's behavior. Visual animations stay scene-locked
      // (durationFrames-scaled springs / interpolates already adapt).
      const speed = Math.max(0.25, Math.min(4, scene.speedFactor ?? 1));
      const startFromFrames = Math.max(
        0,
        Math.round((scene.voiceover.trimStartSec ?? 0) * fps),
      );
      const endAtFrames = scene.voiceover.trimEndSec
        ? Math.max(startFromFrames + 1, Math.round(scene.voiceover.trimEndSec * fps))
        : undefined;
      const fadeInF = Math.max(0, Math.round((scene.voiceover.fadeInSec ?? 0) * fps));
      const fadeOutF = Math.max(0, Math.round((scene.voiceover.fadeOutSec ?? 0) * fps));
      audioRails.push(
        <Sequence
          key={`vo-${scene.id}`}
          from={audioStart}
          durationInFrames={audioDur}
        >
          <Audio
            src={scene.voiceover.audioUrl}
            startFrom={startFromFrames}
            endAt={endAtFrames}
            playbackRate={speed}
            volume={(f) => {
              const minEdge = 3;
              const fIn = Math.max(minEdge, fadeInF);
              const fOut = Math.max(minEdge, fadeOutF);
              let env = 1;
              if (f < fIn) env = f / fIn;
              else if (f > voDurFrames - fOut)
                env = Math.max(0, (voDurFrames - f) / fOut);
              return env * gain * clipGain * mixVoice;
            }}
          />
        </Sequence>,
      );
    }
    const sfxSrc = scene.sceneSfxUrl ?? (scene.sfxId ? sfx[scene.sfxId] : null);
    if (sfxSrc) {
      const gain = Math.max(0, Math.min(2, scene.audioGain ?? 1));
      const speed = Math.max(0.25, Math.min(4, scene.speedFactor ?? 1));
      audioRails.push(
        <Sequence
          key={`sfx-${scene.id}`}
          from={audioStart}
          durationInFrames={audioDur}
        >
          <Audio src={sfxSrc} startFrom={0} playbackRate={speed} volume={0.7 * gain * mixSfx} />
        </Sequence>,
      );
    }
  }

  // Free-floating SFX clips dropped on the project timeline (Audio
  // workspace). They live alongside scene-bound audio and are
  // independently positioned, trimmed, and faded.
  for (const clip of sfxClips ?? []) {
    audioRails.push(
      <FreeSfxClipRail key={`sfx-clip-${clip.id}`} clip={clip} fps={fps} mixSfx={mixSfx} />,
    );
  }

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <TransitionSeries>{seriesChildren}</TransitionSeries>
      {audioRails}

      {music?.url && totalFrames > 0 && (
        <Audio
          src={music.url}
          startFrom={Math.max(0, Math.round((music.trimStartSec ?? 0) * fps))}
          endAt={
            music.trimEndSec
              ? Math.max(
                  Math.round((music.trimStartSec ?? 0) * fps) + 1,
                  Math.round(music.trimEndSec * fps),
                )
              : undefined
          }
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
            const defaultFade = Math.min(Math.round(fps * 0.6), Math.floor(totalFrames / 4));
            const fadeInF = music.fadeInSec
              ? Math.max(1, Math.round(music.fadeInSec * fps))
              : defaultFade;
            const fadeOutF = music.fadeOutSec
              ? Math.max(1, Math.round(music.fadeOutSec * fps))
              : defaultFade;
            let envelope = 1;
            if (frame < fadeInF) envelope = frame / fadeInF;
            else if (frame > totalFrames - fadeOutF)
              envelope = Math.max(0, (totalFrames - frame) / fadeOutF);
            return target * envelope * mixMusic;
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

/**
 * Multi-track render path (M2). Each Track is its own TransitionSeries
 * inside a Sequence positioned at startOffsetSec on the global
 * timeline. Tracks render in array order — track[0] is the bottom-most
 * layer; later tracks stack on top with opacity + mix-blend-mode.
 *
 * Audio-only tracks emit Audio components for their scenes' VO/sfx
 * but skip the visual TransitionSeries entirely.
 *
 * Music ducking + swell still drive off track[0] only since that's
 * where the narrative VO usually lives — keeps the algorithm simple
 * and avoids overlapping ducking ranges from competing tracks.
 */
const MultiTrackRender: React.FC<
  Omit<CompositionProps, "scenes" | "tracks"> & {
    rawScenes: Scene[];
    tracks: Track[];
  }
> = ({
  rawScenes,
  tracks,
  fps,
  characters,
  sfx,
  music,
  captionStyle,
  cuts,
  width: _w,
  height: _h,
  filmGrain = true,
  audioMix,
  sfxClips,
}) => {
  void _w;
  void _h;
  const sceneById = new Map<string, Scene>(rawScenes.map((s) => [s.id, s]));
  const mixVoice = Math.max(0, Math.min(2, audioMix?.voice ?? 1));
  const mixSfx = Math.max(0, Math.min(2, audioMix?.sfx ?? 1));
  const mixMusic = Math.max(0, Math.min(2, audioMix?.music ?? 1));

  // Resolve each track to its scene list (skip muted tracks + scenes).
  const resolved = tracks.map((t) => {
    if (t.muted) return { track: t, scenes: [] as Scene[], frames: 0, startFrame: 0 };
    const scenes = t.sceneIds
      .map((id) => sceneById.get(id))
      .filter((s): s is Scene => !!s && !s.muted);
    const frames = scenes.reduce((sum, s) => sum + sceneDurationFrames(s, fps), 0);
    const startFrame = Math.round((t.startOffsetSec ?? 0) * fps);
    return { track: t, scenes, frames, startFrame };
  });
  const totalFrames = resolved.reduce(
    (m, r) => Math.max(m, r.startFrame + r.frames),
    1,
  );

  // Driver track for ducking: the first non-empty video track.
  const driver = resolved.find((r) => r.track.kind === "video" && r.scenes.length > 0);
  const duckRanges = music && driver ? buildDuckingRanges(driver.scenes, fps, cuts) : [];
  const swellFrames = music && driver ? buildSwellFrames(driver.scenes, fps) : [];

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {resolved.map((r) => {
        if (r.scenes.length === 0) return null;
        const isAudioOnly = r.track.kind === "audio";
        const isOverlay = r.track.kind === "overlay";
        const opacity = Math.max(0, Math.min(1, r.track.opacity ?? 1));
        const blend = r.track.blendMode ?? "normal";

        // Per-track visual TransitionSeries.
        const seriesChildren: React.ReactNode[] = [];
        if (!isAudioOnly) {
          const cutByPair = new Map<string, Cut>();
          for (const c of cuts ?? []) cutByPair.set(`${c.fromSceneId}->${c.toSceneId}`, c);
          for (let i = 0; i < r.scenes.length; i++) {
            const scene = r.scenes[i];
            const dur = sceneDurationFrames(scene, fps);
            seriesChildren.push(
              <TransitionSeries.Sequence
                key={`seq-${r.track.id}-${scene.id}`}
                durationInFrames={dur}
              >
                <SceneRenderer
                  scene={scene}
                  characters={characters}
                  sfx={sfx}
                  captionStyle={captionStyle}
                  renderAudio={false}
                />
              </TransitionSeries.Sequence>,
            );
            const next = r.scenes[i + 1];
            if (next) {
              const cut = cutByPair.get(`${scene.id}->${next.id}`);
              const cutDur = cut?.durationFrames ?? 0;
              if (cutDur > 0) {
                seriesChildren.push(
                  <TransitionSeries.Transition
                    key={`trans-${r.track.id}-${scene.id}-${next.id}`}
                    presentation={presentationFor(cut!.kind, {
                      width: _w,
                      height: _h,
                      color: cut?.color,
                    })}
                    timing={timingFor(cut!, cutDur)}
                  />,
                );
              }
            }
          }
        }

        // Per-track audio rails.
        const audioRails: React.ReactNode[] = [];
        let acc = 0;
        for (const scene of r.scenes) {
          const sceneDur = sceneDurationFrames(scene, fps);
          const audioStart = acc;
          if (scene.voiceover?.audioUrl) {
            const gain = Math.max(0, Math.min(2, scene.audioGain ?? 1));
            const clipGain = Math.max(0, Math.min(2, scene.voiceover.gain ?? 1));
            const speed = Math.max(0.25, Math.min(4, scene.speedFactor ?? 1));
            const voDur = scene.voiceover.audioDurationSec
              ? Math.round(scene.voiceover.audioDurationSec * fps)
              : sceneDur;
            const startFromFrames = Math.max(
              0,
              Math.round((scene.voiceover.trimStartSec ?? 0) * fps),
            );
            const endAtFrames = scene.voiceover.trimEndSec
              ? Math.max(startFromFrames + 1, Math.round(scene.voiceover.trimEndSec * fps))
              : undefined;
            const fadeInF = Math.max(0, Math.round((scene.voiceover.fadeInSec ?? 0) * fps));
            const fadeOutF = Math.max(0, Math.round((scene.voiceover.fadeOutSec ?? 0) * fps));
            audioRails.push(
              <Sequence
                key={`vo-${r.track.id}-${scene.id}`}
                from={audioStart}
                durationInFrames={Math.max(1, sceneDur)}
              >
                <Audio
                  src={scene.voiceover.audioUrl}
                  startFrom={startFromFrames}
                  endAt={endAtFrames}
                  playbackRate={speed}
                  volume={(f) => {
                    const minEdge = 3;
                    const fIn = Math.max(minEdge, fadeInF);
                    const fOut = Math.max(minEdge, fadeOutF);
                    let env = 1;
                    if (f < fIn) env = f / fIn;
                    else if (f > voDur - fOut)
                      env = Math.max(0, (voDur - f) / fOut);
                    return env * gain * clipGain * mixVoice;
                  }}
                />
              </Sequence>,
            );
          }
          const sfxSrc = scene.sceneSfxUrl ?? (scene.sfxId ? sfx[scene.sfxId] : null);
          if (sfxSrc) {
            const gain = Math.max(0, Math.min(2, scene.audioGain ?? 1));
            const speed = Math.max(0.25, Math.min(4, scene.speedFactor ?? 1));
            audioRails.push(
              <Sequence
                key={`sfx-${r.track.id}-${scene.id}`}
                from={audioStart}
                durationInFrames={Math.max(1, sceneDur)}
              >
                <Audio
                  src={sfxSrc}
                  startFrom={0}
                  playbackRate={speed}
                  volume={0.7 * gain * mixSfx}
                />
              </Sequence>,
            );
          }
          acc += sceneDur;
        }

        return (
          <Sequence
            key={`track-${r.track.id}`}
            from={r.startFrame}
            durationInFrames={Math.max(1, r.frames)}
          >
            {!isAudioOnly && (
              <AbsoluteFill
                style={{
                  opacity,
                  mixBlendMode: isOverlay ? blend : "normal",
                }}
              >
                <TransitionSeries>{seriesChildren}</TransitionSeries>
              </AbsoluteFill>
            )}
            {audioRails}
          </Sequence>
        );
      })}

      {(sfxClips ?? []).map((clip) => (
        <FreeSfxClipRail key={`sfx-clip-${clip.id}`} clip={clip} fps={fps} mixSfx={mixSfx} />
      ))}

      {music?.url && totalFrames > 0 && (
        <Audio
          src={music.url}
          startFrom={Math.max(0, Math.round((music.trimStartSec ?? 0) * fps))}
          endAt={
            music.trimEndSec
              ? Math.max(
                  Math.round((music.trimStartSec ?? 0) * fps) + 1,
                  Math.round(music.trimEndSec * fps),
                )
              : undefined
          }
          loop
          volume={(frame) => {
            const lead = 6;
            const tail = 10;
            const baseVol = music.volume ?? 0.55;
            const duckVol = music.duckedVolume ?? 0.18;
            let target = baseVol;
            for (const r of duckRanges) {
              const start = r.from - lead;
              const end = r.from + r.duration + tail;
              if (frame >= start && frame < end) {
                if (frame < r.from) {
                  const t = (frame - start) / lead;
                  target = baseVol + (duckVol - baseVol) * t;
                } else if (frame >= r.from + r.duration) {
                  const t = (frame - (r.from + r.duration)) / tail;
                  target = duckVol + (baseVol - duckVol) * t;
                } else {
                  target = duckVol;
                }
                break;
              }
            }
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
            const defaultFade = Math.min(Math.round(fps * 0.6), Math.floor(totalFrames / 4));
            const fadeInF = music.fadeInSec
              ? Math.max(1, Math.round(music.fadeInSec * fps))
              : defaultFade;
            const fadeOutF = music.fadeOutSec
              ? Math.max(1, Math.round(music.fadeOutSec * fps))
              : defaultFade;
            let envelope = 1;
            if (frame < fadeInF) envelope = frame / fadeInF;
            else if (frame > totalFrames - fadeOutF)
              envelope = Math.max(0, (totalFrames - frame) / fadeOutF);
            return target * envelope * mixMusic;
          }}
        />
      )}

      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.25) 100%)",
          pointerEvents: "none",
        }}
      />
      {filmGrain && <FilmGrain />}
    </AbsoluteFill>
  );
};
