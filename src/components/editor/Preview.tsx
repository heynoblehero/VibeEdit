"use client";

import { Player, type PlayerRef } from "@remotion/player";
import { ArrowRight, MessageCircle, Pause, Play, Sparkles } from "lucide-react";
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
        currentFrame={globalCurrentFrame}
        isFullPreview={isFullPreview}
      />
    </div>
  );
}

/**
 * Shown when the project has no scenes yet. Instructs the user to chat
 * with the agent. Three example prompts pre-fill + auto-submit the
 * chat. Cmd+K shortcut hint is prominent. Surprise-me is demoted to a
 * tiny secondary link at the bottom.
 */
function EmptyProjectInstruction() {
  const sendToChat = async (text: string, autoSubmit: boolean) => {
    // Open the chat sidebar (the page-level Cmd+K handler is the
    // canonical way to open + focus). We dispatch a synthesized
    // keyboard event so we don't have to wire a new prop through the
    // editor layout.
    const evt = new KeyboardEvent("keydown", {
      key: "k",
      metaKey: true,
      ctrlKey: false,
      bubbles: true,
    });
    window.dispatchEvent(evt);
    // Wait for the sidebar to mount + focus, then either pre-fill the
    // textarea (so the user sees the prompt and can edit) or
    // addUserMessage + submit for one-click suggestions.
    setTimeout(async () => {
      if (autoSubmit) {
        const { useChatStore } = await import("@/store/chat-store");
        useChatStore.getState().addUserMessage(text);
        document.querySelector<HTMLFormElement>("aside form")?.requestSubmit();
      } else {
        const ta = document.querySelector<HTMLTextAreaElement>("aside textarea");
        if (ta) {
          ta.value = text;
          ta.dispatchEvent(new Event("input", { bubbles: true }));
          ta.focus();
        }
      }
    }, 80);
  };

  const PROMPTS = [
    {
      label: "60-second short about morning routines",
      text: "Make a 9:16 short about a productive morning routine — 8 scenes, punchy hook, 5 specific tips, CTA at the end.",
    },
    {
      label: "Product reveal video",
      text: "Make a 30-second product reveal — tease scene, hero close-up, three feature highlights, dramatic reveal, CTA.",
    },
    {
      label: "Educational explainer",
      text: "Make a 45-second explainer answering 'why does X happen?' — question hook, setup, core explanation, two examples, takeaway.",
    },
  ];

  return (
    <div className="flex flex-col items-center justify-center h-full bg-black/50 rounded-lg border border-neutral-800 p-8 gap-6">
      <div className="flex items-center gap-2 text-emerald-400">
        <MessageCircle className="h-6 w-6" />
        <ArrowRight className="h-4 w-4 animate-pulse" />
        <Sparkles className="h-6 w-6" />
      </div>
      <div className="text-center max-w-md">
        <h2 className="text-base font-semibold text-white mb-1">
          Tell the AI what to make
        </h2>
        <p className="text-xs text-neutral-400 leading-relaxed">
          Open the chat (
          <kbd className="px-1.5 py-0.5 rounded bg-neutral-800 border border-neutral-700 text-emerald-400 text-[10px]">
            Cmd
          </kbd>{" "}
          +{" "}
          <kbd className="px-1.5 py-0.5 rounded bg-neutral-800 border border-neutral-700 text-emerald-400 text-[10px]">
            K
          </kbd>
          ) and describe the video you want. The agent will plan it,
          generate visuals + narration + music, and render it for you.
        </p>
      </div>
      <div className="flex flex-col gap-2 w-full max-w-md">
        <span className="text-[10px] uppercase tracking-wider text-neutral-500 text-center">
          Or pick a starter prompt
        </span>
        {PROMPTS.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => sendToChat(p.text, true)}
            className="group flex items-center gap-2 w-full text-left px-3 py-2 rounded-md bg-neutral-900 border border-neutral-800 hover:border-emerald-500/60 hover:bg-emerald-500/5 transition-colors"
          >
            <Sparkles className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
            <span className="text-xs text-neutral-300 group-hover:text-white flex-1">
              {p.label}
            </span>
            <ArrowRight className="h-3 w-3 text-neutral-600 group-hover:text-emerald-400" />
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={() => {
          const evt = new KeyboardEvent("keydown", {
            key: "k",
            metaKey: true,
            bubbles: true,
          });
          window.dispatchEvent(evt);
        }}
        className="flex items-center gap-2 px-5 py-2.5 rounded-md bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-sm transition-colors"
      >
        <MessageCircle className="h-4 w-4" />
        Open the AI chat
      </button>
      <button
        type="button"
        onClick={() =>
          sendToChat(
            "Surprise me. Pick a fun workflow and make a fully-narrated 60s demo video.",
            true,
          )
        }
        className="text-[10px] text-neutral-600 hover:text-neutral-400 underline decoration-dotted underline-offset-2"
      >
        or surprise me with a random demo
      </button>
    </div>
  );
}
