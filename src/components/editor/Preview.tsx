"use client";

import { Player, type PlayerRef } from "@remotion/player";
import { Pause, Play, Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AbsoluteFill } from "remotion";
import { sceneDurationFrames, projectTotalFrames } from "@/lib/scene-schema";
import { SceneRenderer } from "@/remotion/SceneRenderer";
import { VideoComposition } from "@/remotion/Composition";
import { useAssetStore } from "@/store/asset-store";
import { useEditorStore } from "@/store/editor-store";
import { useProjectStore } from "@/store/project-store";
import { CanvasOverlay } from "./CanvasOverlay";
import { ProjectChooser } from "./ProjectChooser";

function SingleSceneWrapper({ scene, characters, sfx, captionStyle }: any) {
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <SceneRenderer
        scene={scene}
        characters={characters}
        sfx={sfx}
        captionStyle={captionStyle}
      />
    </AbsoluteFill>
  );
}

export function Preview() {
  const { project, selectedSceneId } = useProjectStore();
  const { characters, sfx } = useAssetStore();
  const { isPaused, setPaused, setPlayingSceneId } = useEditorStore();
  const playerRef = useRef<PlayerRef>(null);
  // Wrapper ref CanvasOverlay reads to convert screen-px pointer deltas
  // into canvas-px against the displayed (letterboxed) frame.
  const playerWrapperRef = useRef<HTMLDivElement>(null);

  const charMap = useMemo(() => {
    const m: Record<string, string> = {};
    for (const c of characters) m[c.id] = c.src;
    return m;
  }, [characters]);

  const sfxMap = useMemo(() => {
    const m: Record<string, string> = {};
    for (const s of sfx) m[s.id] = s.src;
    return m;
  }, [sfx]);

  const selectedScene = project.scenes.find((s) => s.id === selectedSceneId);

  // Player is sensitive to identity churn on inputProps — memoize so
  // render-engine cache survives unrelated state changes.
  const fullPlayerInputProps = useMemo(
    () => ({
      scenes: project.scenes,
      fps: project.fps,
      characters: charMap,
      sfx: sfxMap,
      music: project.music,
      captionStyle: project.captionStyle,
      cuts: project.cuts,
      width: project.width,
      height: project.height,
      audioMix: project.audioMix,
      sfxClips: project.sfxClips,
      tracks: project.tracks,
    }),
    [
      project.scenes,
      project.fps,
      charMap,
      sfxMap,
      project.music,
      project.captionStyle,
      project.cuts,
      project.width,
      project.height,
      project.audioMix,
      project.sfxClips,
      project.tracks,
    ],
  );

  const totalFrames = useMemo(
    () => Math.max(1, projectTotalFrames(project)),
    [project.scenes, project.fps],
  );

  const sceneDur = selectedScene
    ? sceneDurationFrames(selectedScene, project.fps)
    : 1;

  const [currentFrame, setCurrentFrame] = useState(0);
  const [previewSpeed, setPreviewSpeed] = useState(1);
  const isFullPreview = !selectedScene;

  // Compute scene boundaries once so the frameupdate handler can do an
  // O(N) linear scan to find the active scene.
  const sceneBounds = useMemo(() => {
    let acc = 0;
    return project.scenes.map((s) => {
      const start = acc;
      const frames = sceneDurationFrames(s, project.fps);
      acc += frames;
      return { id: s.id, start, end: acc };
    });
  }, [project.scenes, project.fps]);

  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    const onFrame = (e: { detail: { frame: number } }) => {
      const f = e.detail.frame;
      setCurrentFrame(f);
      if (isFullPreview) {
        // Find which scene is in frame and broadcast it.
        const hit = sceneBounds.find((b) => f >= b.start && f < b.end);
        setPlayingSceneId(hit?.id ?? null);
      } else {
        setPlayingSceneId(selectedSceneId);
      }
    };
    player.addEventListener("frameupdate", onFrame);
    return () => {
      player.removeEventListener("frameupdate", onFrame);
      setPlayingSceneId(null);
    };
  }, [isFullPreview, selectedSceneId, sceneBounds, setPlayingSceneId]);

  // Map the player's current frame to a GLOBAL timeline frame so the
  // Timeline strip's playhead is correct in both modes:
  //   - Full preview: player frame already global.
  //   - Single-scene preview: add the selected scene's start offset so
  //     the playhead lands inside that scene block on the timeline.
  const globalCurrentFrame = useMemo(() => {
    if (isFullPreview) return currentFrame;
    const bound = sceneBounds.find((b) => b.id === selectedSceneId);
    return (bound?.start ?? 0) + currentFrame;
  }, [isFullPreview, currentFrame, sceneBounds, selectedSceneId]);

  // Posed-preview frame: the static frame we seek to when paused so the
  // editor shows a meaningful thumbnail rather than frame 0. Clamped to
  // the scene's playable range — short scenes (e.g. after a cut at
  // frame 6) would otherwise blow up the Remotion Player with
  // "initialFrame must be ≤ durationInFrames - 1".
  const posedFrame = useMemo(
    () => Math.max(0, Math.min(18, sceneDur - 1)),
    [sceneDur],
  );

  useEffect(() => {
    if (isPaused && playerRef.current) {
      playerRef.current.pause();
      playerRef.current.seekTo(posedFrame);
    }
  }, [isPaused, selectedSceneId, posedFrame]);

  // ←/→ frame-step (and Shift+←/→ for 10-frame jumps) dispatched from
  // KeyboardShortcuts. We pause first so the seek lands cleanly.
  useEffect(() => {
    const onSeekBy = (e: Event) => {
      const detail = (e as CustomEvent<number>).detail ?? 0;
      const p = playerRef.current;
      if (!p) return;
      p.pause();
      const cur = p.getCurrentFrame?.() ?? 0;
      p.seekTo(Math.max(0, cur + detail));
    };
    const onSeekTo = (e: Event) => {
      const detail = (e as CustomEvent<number>).detail ?? 0;
      const p = playerRef.current;
      if (!p) return;
      p.pause();
      p.seekTo(Math.max(0, detail));
    };
    window.addEventListener("vibeedit:seek-by", onSeekBy as EventListener);
    window.addEventListener("vibeedit:seek-to", onSeekTo as EventListener);
    return () => {
      window.removeEventListener("vibeedit:seek-by", onSeekBy as EventListener);
      window.removeEventListener("vibeedit:seek-to", onSeekTo as EventListener);
    };
  }, []);

  // Auto-pause when the tab loses focus — keeps the user from
  // tab-switching to chat / docs and coming back to a finished
  // playback they didn't watch. Also stops audio bleeding into
  // background tabs.
  useEffect(() => {
    const onVis = () => {
      if (document.hidden) {
        playerRef.current?.pause();
        setPaused(true);
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [setPaused]);

  // Loop range wrap-around. When the playhead crosses loopRange.end we
  // seek back to loopRange.start so the user can preview a tight clip
  // on repeat. Only active in full-project mode.
  const loopRange = useEditorStore((s) => s.loopRange);
  useEffect(() => {
    if (!loopRange || selectedScene) return;
    const id = setInterval(() => {
      const p = playerRef.current;
      if (!p) return;
      const cur = p.getCurrentFrame?.() ?? 0;
      if (cur >= loopRange.end) p.seekTo(loopRange.start);
      else if (cur < loopRange.start - 1) p.seekTo(loopRange.start);
    }, 50);
    return () => clearInterval(id);
  }, [loopRange, selectedScene]);

  // When a scene with a voiceover is selected, auto-play so the creator
  // hears the narration without clicking Play.
  useEffect(() => {
    if (!selectedScene?.voiceover?.audioUrl) return;
    const id = requestAnimationFrame(() => {
      if (!playerRef.current) return;
      playerRef.current.seekTo(0);
      playerRef.current.play();
      setPaused(false);
    });
    return () => cancelAnimationFrame(id);
  }, [selectedSceneId, selectedScene?.voiceover?.audioUrl, setPaused]);

  const handlePlay = useCallback(() => {
    setPaused(false);
    playerRef.current?.play();
  }, [setPaused]);

  const handlePause = useCallback(() => {
    setPaused(true);
    playerRef.current?.pause();
  }, [setPaused]);

  // Space toggles play/pause when focus is not in an input/textarea.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== " " && e.code !== "Space") return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) {
        return;
      }
      const player = playerRef.current;
      if (!player) return;
      e.preventDefault();
      if (player.isPlaying()) {
        handlePause();
      } else {
        handlePlay();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handlePlay, handlePause]);


  if (project.scenes.length === 0) {
    return <ProjectChooser />;
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header: clearly separates the preview column from the side
          panels. Title + scene info + play/pause inline. */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-neutral-800 bg-neutral-900 shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-[11px] uppercase tracking-wider text-emerald-300 font-semibold">
            Preview
          </span>
          {selectedScene ? (
            <span className="text-[10px] text-neutral-400">
              Scene {project.scenes.findIndex((s) => s.id === selectedScene.id) + 1}
              {selectedScene.label ? ` · ${selectedScene.label}` : ""} · {selectedScene.duration}s
            </span>
          ) : (
            <span className="text-[10px] text-neutral-400">Full timeline · {project.scenes.length} scene{project.scenes.length === 1 ? "" : "s"}</span>
          )}
        </div>
        <button
          onClick={isPaused ? handlePlay : handlePause}
          title={selectedScene ? "Play this scene (Space)" : "Play all scenes (Space)"}
          className="flex items-center gap-2 text-[12px] font-bold px-4 py-2 rounded-md bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-black transition-colors shadow-lg shadow-emerald-500/20 ring-1 ring-emerald-300/50"
        >
          {isPaused ? <Play className="h-4 w-4 fill-black" /> : <Pause className="h-4 w-4 fill-black" />}
          {isPaused ? (selectedScene ? "Play scene" : "Play all") : "Pause"}
        </button>
      </div>

      {/* Player frame — distinct dark stage with a clear border so the
          canvas area reads as separate from the surrounding chrome.
          The inner box sizes itself to the project's aspect ratio
          using container-query units so the preview scales up to fill
          the available space without letterboxing. */}
      <div
        className="flex-1 min-h-0 p-6 bg-neutral-925 dark:bg-neutral-950 flex items-center justify-center"
        style={{ containerType: "size" }}
      >
      <div
        ref={playerWrapperRef}
        className="relative bg-black rounded-xl overflow-hidden border-2 border-emerald-500/60 hover:border-emerald-500/80 shadow-2xl shadow-emerald-500/20 transition-colors"
        style={{
          width: `min(100cqw, 100cqh * ${project.width} / ${project.height})`,
          height: `min(100cqh, 100cqw * ${project.height} / ${project.width})`,
        }}
      >
        {selectedScene && (
          <div className="absolute top-2 left-2 z-30 px-1.5 py-1 rounded bg-neutral-900/70 backdrop-blur-sm border border-neutral-800 text-[10px] text-neutral-300 font-mono pointer-events-none">
            Scene {project.scenes.findIndex((s) => s.id === selectedScene.id) + 1}
            {selectedScene.label && (
              <span className="text-neutral-500"> · {selectedScene.label}</span>
            )}
          </div>
        )}
        {!selectedScene && (
          <div className="absolute top-2 right-2 z-30 flex items-center gap-1 px-1.5 py-1 rounded bg-neutral-900/80 backdrop-blur-sm border border-neutral-800 text-[10px] text-neutral-400">
            <span className="text-neutral-500">×</span>
            {[0.5, 1, 1.5, 2].map((r) => (
              <button
                key={r}
                onClick={() => setPreviewSpeed(r)}
                className={`px-1 rounded ${
                  previewSpeed === r
                    ? "text-emerald-300 bg-emerald-500/15"
                    : "hover:text-white"
                }`}
                title={`Preview at ${r}× — render speed unchanged`}
              >
                {r}
              </button>
            ))}
          </div>
        )}
        <PreviewOverlays />
        <PreviewGuidesToggle />
        {selectedScene ? (
          <Player
            ref={playerRef}
            key={`scene-${selectedScene.id}`}
            component={SingleSceneWrapper}
            inputProps={{
              scene: selectedScene,
              characters: charMap,
              sfx: sfxMap,
              captionStyle: project.captionStyle,
            }}
            durationInFrames={Math.max(1, sceneDur)}
            fps={project.fps}
            compositionWidth={project.width}
            compositionHeight={project.height}
            style={{ width: "100%", height: "100%" }}
            controls={false}
            loop
            autoPlay={false}
            initialFrame={posedFrame}
          />
        ) : (
          <Player
            key="full"
            component={VideoComposition}
            inputProps={fullPlayerInputProps}
            durationInFrames={totalFrames}
            fps={project.fps}
            compositionWidth={project.width}
            compositionHeight={project.height}
            playbackRate={previewSpeed}
            style={{ width: "100%", height: "100%" }}
            controls
            loop
            autoPlay={false}
          />
        )}

        {/* Unified canvas overlay — selection, drag-to-move, corner
            resize, snap guides, live readout. Owns every manipulable
            layer (bg image/video, character, broll, shape, text). */}
        {selectedScene && isPaused && (
          <CanvasOverlay
            scene={selectedScene}
            frameW={project.width}
            frameH={project.height}
            containerRef={playerWrapperRef}
          />
        )}
      </div>
      </div>
    </div>
  );
}

/**
 * Composition guide overlays — rule-of-thirds and broadcast-safe area.
 * Both are pointer-events: none so they don't block click hotspots.
 */
function PreviewOverlays() {
  const showThirds = useEditorStore((s) => s.showThirds);
  const showSafeArea = useEditorStore((s) => s.showSafeArea);
  const showLetterbox = useEditorStore((s) => s.showLetterbox);
  if (!showThirds && !showSafeArea && !showLetterbox) return null;
  return (
    <div className="absolute inset-0 pointer-events-none z-25">
      {showLetterbox && (
        // 2.39:1 cinemascope. Bars are sized as the difference between
        // the canvas's actual aspect and 2.39, rounded to the nearest
        // integer % so they don't shimmer at fractional values.
        <>
          <div
            className="absolute left-0 right-0 top-0 bg-black"
            style={{ height: "12%" }}
          />
          <div
            className="absolute left-0 right-0 bottom-0 bg-black"
            style={{ height: "12%" }}
          />
        </>
      )}
      {showThirds && (
        <>
          <div className="absolute left-1/3 top-0 bottom-0 w-px bg-white/30" />
          <div className="absolute left-2/3 top-0 bottom-0 w-px bg-white/30" />
          <div className="absolute top-1/3 left-0 right-0 h-px bg-white/30" />
          <div className="absolute top-2/3 left-0 right-0 h-px bg-white/30" />
        </>
      )}
      {showSafeArea && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-[90%] h-[90%] border border-amber-300/50" />
          <div className="absolute w-[80%] h-[80%] border border-amber-300/70 border-dashed" />
        </div>
      )}
    </div>
  );
}

function PreviewGuidesToggle() {
  const {
    showThirds,
    setShowThirds,
    showSafeArea,
    setShowSafeArea,
    showLetterbox,
    setShowLetterbox,
  } = useEditorStore();
  return (
    <div className="absolute bottom-2 right-2 z-30 flex items-center gap-1 px-1.5 py-1 rounded bg-neutral-900/80 backdrop-blur-sm border border-neutral-800 text-[10px]">
      <button
        onClick={() => setShowLetterbox(!showLetterbox)}
        className={`px-1.5 py-0.5 rounded ${
          showLetterbox
            ? "bg-cyan-500/20 text-cyan-300"
            : "text-neutral-400 hover:text-white"
        }`}
        title="Cinemascope (2.39:1) letterbox bars"
      >
        ▭
      </button>
      <button
        onClick={() => setShowThirds(!showThirds)}
        className={`px-1.5 py-0.5 rounded ${
          showThirds
            ? "bg-emerald-500/20 text-emerald-300"
            : "text-neutral-400 hover:text-white"
        }`}
        title="Rule-of-thirds grid"
      >
        ⌗
      </button>
      <button
        onClick={() => setShowSafeArea(!showSafeArea)}
        className={`px-1.5 py-0.5 rounded ${
          showSafeArea
            ? "bg-amber-500/20 text-amber-300"
            : "text-neutral-400 hover:text-white"
        }`}
        title="Broadcast-safe / title-safe area"
      >
        ▣
      </button>
    </div>
  );
}

/* EmptyProjectInstruction was replaced by ProjectChooser — kept the
 * comment as a breadcrumb for anyone hunting the old empty state. */
