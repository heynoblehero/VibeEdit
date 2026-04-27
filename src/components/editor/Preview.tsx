"use client";

import { Player, type PlayerRef } from "@remotion/player";
import { ArrowRight, MessageCircle, Pause, Play, Plus, Sparkles, Upload } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AbsoluteFill } from "remotion";
import { sceneDurationFrames, totalDurationFrames } from "@/lib/scene-schema";
import { SceneRenderer } from "@/remotion/SceneRenderer";
import { VideoComposition } from "@/remotion/Composition";
import { useAssetStore } from "@/store/asset-store";
import { useEditorStore, type EditTarget } from "@/store/editor-store";
import { useProjectStore } from "@/store/project-store";
import { Timeline } from "./Timeline";

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
  const { isPaused, setPaused, setEditTarget, setPlayingSceneId } = useEditorStore();
  const playerRef = useRef<PlayerRef>(null);

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

  const totalFrames = useMemo(
    () => Math.max(1, totalDurationFrames(project.scenes, project.fps)),
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

  const handleOverlayClick = useCallback((target: EditTarget) => {
    setEditTarget(target);
  }, [setEditTarget]);

  if (project.scenes.length === 0) {
    return <EmptyProjectInstruction />;
  }

  const hasChar = selectedScene?.characterId;
  const hasText = selectedScene?.text || selectedScene?.emphasisText;
  const hasNumber = selectedScene?.type === "big_number";

  return (
    <div className="flex flex-col h-full gap-2">
      {/* Controls */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={isPaused ? handlePlay : handlePause}
          className="flex items-center gap-1.5 text-xs px-3 py-1 rounded-md bg-neutral-800 text-neutral-300 hover:text-white transition-colors"
        >
          {isPaused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
          {isPaused ? "Play" : "Pause"}
        </button>
        {selectedScene ? (
          <span className="text-[10px] text-neutral-500">
            {selectedScene.duration}s &middot; Click elements to edit
          </span>
        ) : (
          <span className="text-[10px] text-neutral-500">
            Full preview &middot; Click timeline to jump to scene
          </span>
        )}
      </div>

      {/* Player + clickable overlay */}
      <div className="flex-1 min-h-0 relative bg-black rounded-lg overflow-hidden border border-neutral-800">
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
            inputProps={{
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
            }}
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

        {/* Clickable element overlay */}
        {selectedScene && isPaused && (
          <div className="absolute inset-0 z-20">
            {/* Background (full area, lowest priority) */}
            <div
              className="absolute inset-0 cursor-pointer"
              onClick={() => handleOverlayClick("background")}
            />

            {/* Text hotspot */}
            {hasText && (
              <div
                className="absolute cursor-pointer hover:outline hover:outline-2 hover:outline-blue-400/60 hover:bg-blue-400/5 rounded-lg transition-all"
                style={{
                  left: "10%",
                  right: "10%",
                  top: `${((selectedScene.textY ?? 300) / 1080) * 100}%`,
                  height: "22%",
                }}
                onClick={(e) => { e.stopPropagation(); handleOverlayClick("text"); }}
              >
                <div className="absolute -top-5 left-2 text-[9px] font-semibold text-blue-400 bg-black/70 px-1.5 py-0.5 rounded opacity-0 hover:opacity-100 transition-opacity pointer-events-none group-hover:opacity-100">
                  Text
                </div>
              </div>
            )}

            {/* Number hotspot */}
            {hasNumber && (
              <div
                className="absolute cursor-pointer hover:outline hover:outline-2 hover:outline-amber-400/60 hover:bg-amber-400/5 rounded-lg transition-all"
                style={{ left: "20%", right: "20%", top: "30%", height: "25%" }}
                onClick={(e) => { e.stopPropagation(); handleOverlayClick("counter"); }}
              />
            )}

            {/* Character hotspot */}
            {hasChar && (
              <div
                className="absolute cursor-pointer hover:outline hover:outline-2 hover:outline-emerald-400/60 hover:bg-emerald-400/5 rounded-lg transition-all"
                style={{
                  left: `${((selectedScene.characterX ?? 960) / 1920) * 100 - 12}%`,
                  top: `${((selectedScene.characterY ?? 950) / 1080) * 100 - 50}%`,
                  width: "24%",
                  height: "55%",
                }}
                onClick={(e) => { e.stopPropagation(); handleOverlayClick("character"); }}
              >
                <div className="absolute -top-5 left-2 text-[9px] font-semibold text-emerald-400 bg-black/70 px-1.5 py-0.5 rounded">
                  Character
                </div>
              </div>
            )}

            {/* Hover hints */}
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-2 pointer-events-none">
              {hasChar && (
                <span className="text-[9px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/30">
                  Character
                </span>
              )}
              {hasText && (
                <span className="text-[9px] bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full border border-blue-500/30">
                  Text
                </span>
              )}
              <span className="text-[9px] bg-neutral-500/20 text-neutral-300 px-2 py-0.5 rounded-full border border-neutral-500/30">
                Background
              </span>
            </div>
          </div>
        )}
      </div>
      <Timeline
        playerRef={playerRef}
        currentFrame={globalCurrentFrame}
        isFullPreview={isFullPreview}
      />
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
  if (!showThirds && !showSafeArea) return null;
  return (
    <div className="absolute inset-0 pointer-events-none z-25">
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
  const { showThirds, setShowThirds, showSafeArea, setShowSafeArea } =
    useEditorStore();
  return (
    <div className="absolute bottom-2 right-2 z-30 flex items-center gap-1 px-1.5 py-1 rounded bg-neutral-900/80 backdrop-blur-sm border border-neutral-800 text-[10px]">
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

/**
 * Shown when the project has no scenes yet. Editor-first: leads with
 * "+ Add scene" and "drop files in Uploads" so the user starts editing
 * manually by default. AI build remains available as a secondary
 * affordance below.
 */
function EmptyProjectInstruction() {
  const openChat = (prefab?: string) => {
    const evt = new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true });
    window.dispatchEvent(evt);
    if (prefab) {
      setTimeout(async () => {
        const { useChatStore } = await import("@/store/chat-store");
        useChatStore.getState().addUserMessage(prefab);
        document.querySelector<HTMLFormElement>("aside form")?.requestSubmit();
      }, 80);
    }
  };

  const addBlankScene = async () => {
    const { useProjectStore: store } = await import("@/store/project-store");
    const { createId, DEFAULT_BG } = await import("@/lib/scene-schema");
    const project = store.getState().project;
    const portrait = project.height > project.width;
    store.getState().addScene({
      id: createId(),
      type: "text_only",
      duration: 2,
      emphasisText: "edit me",
      emphasisSize: portrait ? 96 : 72,
      emphasisColor: "#ffffff",
      textY: portrait ? 500 : 380,
      transition: "beat_flash",
      background: { ...DEFAULT_BG },
    });
  };

  const PROMPTS = [
    "Make a 9:16 short about a productive morning routine — 8 scenes, punchy hook, 5 tips, CTA.",
    "Make a 30-second product reveal — tease, hero close-up, 3 features, dramatic reveal, CTA.",
    "Make a 45-second explainer for 'why does X happen?' — hook, setup, core, two examples, takeaway.",
  ];

  return (
    <div className="flex flex-col items-center justify-center h-full bg-black/50 rounded-lg border border-neutral-800 p-8 gap-5">
      {/* Primary editor-first CTA */}
      <div className="flex flex-col items-center gap-3 max-w-md">
        <div className="text-center">
          <h2 className="text-base font-semibold text-white mb-0.5">
            Add your first scene
          </h2>
          <p className="text-[11px] text-neutral-500">
            Build the video by hand, or hand the brief to the AI below.
          </p>
        </div>
        <div className="flex flex-col items-stretch gap-2 w-full">
          <button
            type="button"
            onClick={addBlankScene}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-md bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-sm transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add a blank scene
          </button>
          <button
            type="button"
            onClick={() => {
              const evt = new KeyboardEvent("keydown", {
                key: "u",
                ctrlKey: true,
                bubbles: true,
              });
              window.dispatchEvent(evt);
            }}
            className="flex items-center justify-center gap-2 px-3 py-1.5 rounded-md text-xs text-neutral-400 hover:text-white border border-neutral-800 hover:border-neutral-700 transition-colors"
          >
            <Upload className="h-3.5 w-3.5" />
            Drop files in Uploads (header → Upload icon)
          </button>
        </div>
      </div>

      {/* Divider */}
      <div className="flex items-center gap-3 w-full max-w-md text-[10px] uppercase tracking-wider text-neutral-600">
        <div className="flex-1 h-px bg-neutral-800" />
        <span>or have AI build the whole thing</span>
        <div className="flex-1 h-px bg-neutral-800" />
      </div>

      {/* Secondary AI affordance */}
      <div className="flex flex-col gap-1.5 w-full max-w-md">
        {PROMPTS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => openChat(p)}
            className="group flex items-center gap-2 w-full text-left px-3 py-1.5 rounded bg-neutral-900 border border-neutral-800 hover:border-emerald-500/60 hover:bg-emerald-500/5 transition-colors"
          >
            <Sparkles className="h-3 w-3 text-emerald-400 shrink-0" />
            <span className="text-[11px] text-neutral-400 group-hover:text-white flex-1 truncate">
              {p}
            </span>
            <ArrowRight className="h-3 w-3 text-neutral-700 group-hover:text-emerald-400" />
          </button>
        ))}
        <button
          type="button"
          onClick={() => openChat()}
          className="flex items-center justify-center gap-1.5 mt-1 text-[11px] text-neutral-500 hover:text-emerald-300 transition-colors"
        >
          <MessageCircle className="h-3 w-3" />
          Open AI chat ({" "}
          <kbd className="px-1 py-0.5 rounded bg-neutral-900 border border-neutral-800 text-emerald-400 text-[9px]">
            Cmd
          </kbd>{" "}
          +{" "}
          <kbd className="px-1 py-0.5 rounded bg-neutral-900 border border-neutral-800 text-emerald-400 text-[9px]">
            K
          </kbd>
          )
        </button>
      </div>
    </div>
  );
}
