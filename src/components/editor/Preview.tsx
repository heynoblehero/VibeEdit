"use client";

import { Player, type PlayerRef } from "@remotion/player";
import { Pause, Play } from "lucide-react";
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

  useEffect(() => {
    if (isPaused && playerRef.current) {
      playerRef.current.pause();
      playerRef.current.seekTo(18);
    }
  }, [isPaused, selectedSceneId]);

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
    return (
      <div className="flex flex-col items-center justify-center h-full bg-black/50 text-neutral-500 text-sm rounded-lg gap-4 border border-neutral-800">
        <div className="text-4xl">🎬</div>
        <div className="text-center">
          Ask the agent to make a video.
          <br />
          <kbd className="text-emerald-400">Cmd+K</kbd> to start.
        </div>
        <button
          onClick={async () => {
            const { useChatStore } = await import("@/store/chat-store");
            useChatStore
              .getState()
              .addUserMessage(
                "Surprise me. Pick a fun workflow and make a fully-narrated 60s demo video.",
              );
            document
              .querySelector<HTMLFormElement>("aside form")
              ?.requestSubmit();
          }}
          className="flex items-center gap-2 px-4 py-2 rounded-md bg-gradient-to-r from-amber-500 to-pink-500 hover:from-amber-400 hover:to-pink-400 text-white text-xs font-semibold transition-colors"
        >
          🎲 Surprise me
        </button>
      </div>
    );
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
            initialFrame={18}
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
            }}
            durationInFrames={totalFrames}
            fps={project.fps}
            compositionWidth={project.width}
            compositionHeight={project.height}
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
        currentFrame={currentFrame}
        isFullPreview={isFullPreview}
      />
    </div>
  );
}
