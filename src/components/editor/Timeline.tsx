"use client";

import { Plus, Scissors } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import type { PlayerRef } from "@remotion/player";
import type { Cut, Scene } from "@/lib/scene-schema";
import { createId, DEFAULT_BG, sceneDurationFrames, totalDurationFrames } from "@/lib/scene-schema";
import { useEditorStore } from "@/store/editor-store";
import { useProjectStore } from "@/store/project-store";
import { AudioWaveform } from "./AudioWaveform";
import { CutMarker } from "./CutMarker";

interface TimelineProps {
  playerRef: React.RefObject<PlayerRef | null>;
  currentFrame: number;
  isFullPreview: boolean;
}

export function Timeline({ playerRef, currentFrame, isFullPreview }: TimelineProps) {
  const project = useProjectStore((s) => s.project);
  const selectScene = useProjectStore((s) => s.selectScene);
  const updateScene = useProjectStore((s) => s.updateScene);
  const moveScene = useProjectStore((s) => s.moveScene);
  const splitScene = useProjectStore((s) => s.splitScene);
  const insertSceneAt = useProjectStore((s) => s.insertSceneAt);
  const playingSceneId = useEditorStore((s) => s.playingSceneId);
  // cutMode now lives on the store so the C/V keyboard shortcuts can
  // toggle it from anywhere (KeyboardShortcuts.tsx). Preserve the
  // setCutMode local alias so the rest of this component reads cleanly.
  const cutMode = useEditorStore((s) => s.cutMode);
  const setCutMode = useEditorStore((s) => s.setCutMode);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const total = useMemo(
    () => Math.max(1, totalDurationFrames(project.scenes, project.fps)),
    [project.scenes, project.fps],
  );

  // Drag-to-resize state. When set, pointermove adjusts the scene's duration.
  const resizeRef = useRef<{
    sceneId: string;
    startX: number;
    startDuration: number;
    pxPerSec: number;
  } | null>(null);

  /**
   * Snap a duration in seconds to the nearest grid step. Steps:
   * - 0.25s ("quarter") — default; fine enough for hooks, coarse enough
   *   to not feel sticky.
   * Hold Alt during the drag to bypass and free-snap to the original
   * sub-frame precision.
   */
  const snapSec = useCallback((sec: number, alt: boolean) => {
    if (alt) return Number(sec.toFixed(2));
    const step = 0.25;
    return Number((Math.round(sec / step) * step).toFixed(2));
  }, []);

  const onResizeDown = useCallback(
    (e: React.PointerEvent, sceneId: string, startDuration: number) => {
      e.stopPropagation();
      e.preventDefault();
      const trackWidth = trackRef.current?.clientWidth ?? 0;
      const totalSec = total / project.fps;
      resizeRef.current = {
        sceneId,
        startX: e.clientX,
        startDuration,
        pxPerSec: trackWidth / Math.max(1, totalSec),
      };
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    },
    [total, project.fps],
  );
  const onResizeMove = useCallback(
    (e: React.PointerEvent) => {
      const st = resizeRef.current;
      if (!st) return;
      const dx = e.clientX - st.startX;
      const raw = st.startDuration + dx / st.pxPerSec;
      const snapped = snapSec(raw, e.altKey);
      const next = Math.max(0.5, Math.min(20, snapped));
      updateScene(st.sceneId, { duration: next });
    },
    [updateScene, snapSec],
  );
  const onResizeUp = useCallback((e: React.PointerEvent) => {
    resizeRef.current = null;
    (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
  }, []);

  // Precompute scene boundaries in frames for tick positions and click lookup.
  const markers = useMemo(() => {
    let acc = 0;
    return project.scenes.map((s) => {
      const start = acc;
      const frames = sceneDurationFrames(s, project.fps);
      acc += frames;
      return { id: s.id, start, frames, endExclusive: acc };
    });
  }, [project.scenes, project.fps]);

  const trackRef = useRef<HTMLDivElement>(null);

  const seekTo = useCallback(
    (frame: number) => {
      if (!playerRef.current) return;
      playerRef.current.seekTo(Math.max(0, Math.min(total - 1, frame)));
    },
    [playerRef, total],
  );

  const handleClick = (e: React.MouseEvent) => {
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    let frame = Math.round(ratio * total);
    const marker = markers.find((m) => frame >= m.start && frame < m.endExclusive);
    if (cutMode) {
      // Cut at this frame inside the marker's scene. Snap the cut to
      // the nearest 0.25s relative to the scene's start so cuts land on
      // a clean grid; Alt bypasses for free placement.
      if (marker) {
        let within = frame - marker.start;
        if (!e.altKey) {
          const snappedSec = snapSec(within / project.fps, false);
          within = Math.round(snappedSec * project.fps);
          // Don't allow snap to land at exact 0 or end (splitScene rejects).
          within = Math.max(2, Math.min(marker.frames - 2, within));
          frame = marker.start + within;
        }
        const newId = splitScene(marker.id, within);
        if (newId) selectScene(newId);
      }
      // Stay in cut mode until the user toggles off.
      return;
    }
    seekTo(frame);
    if (marker) selectScene(marker.id);
  };

  if (project.scenes.length === 0) return null;

  // Always show the playhead. Preview computes a global currentFrame
  // (single-scene mode adds the selected scene's start offset) so the
  // line lands correctly even when the user is editing one scene.
  const playheadPct = Math.min(100, Math.max(0, (currentFrame / total) * 100));
  void isFullPreview;

  const seconds = (total / project.fps).toFixed(1);

  return (
    <div className="flex flex-col gap-1 shrink-0 pt-2">
      <div className="flex items-center justify-between text-[10px] text-neutral-500 font-mono">
        <span className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCutMode(!cutMode)}
            title={cutMode ? "Cut mode active — click on a scene to split" : "Cut tool — click to enable, then click on a scene at the frame to split"}
            className={
              cutMode
                ? "flex items-center gap-1 px-1.5 py-0.5 rounded border border-amber-400 bg-amber-500/20 text-amber-300"
                : "flex items-center gap-1 px-1.5 py-0.5 rounded border border-neutral-800 hover:border-amber-400 hover:text-amber-300"
            }
          >
            <Scissors className="h-3 w-3" />
            <span className="text-[10px]">cut</span>
          </button>
          <span className="text-neutral-600">0.0s</span>
        </span>
        <span>
          {`${(currentFrame / project.fps).toFixed(1)}s`}
          {cutMode && (
            <span className="ml-2 text-amber-300">click on a scene block to split</span>
          )}
        </span>
        <span>{seconds}s</span>
      </div>
      <div
        ref={trackRef}
        onClick={handleClick}
        onDragOver={(e) => {
          // Accept any of the four "insert new scene" payloads. Drop
          // targets that mutate an existing scene (effect / ai-action /
          // transition) are handled by per-block onDrop below — those
          // calls stopPropagation so they never reach this outer handler.
          const types = e.dataTransfer.types;
          if (
            types.includes("vibeedit/upload-url") ||
            types.includes("vibeedit/scene-type") ||
            types.includes("vibeedit/title")
          ) {
            e.preventDefault();
            e.dataTransfer.dropEffect = "copy";
          }
        }}
        onDrop={(e) => {
          if (!trackRef.current) return;
          const rect = trackRef.current.getBoundingClientRect();
          const ratio = (e.clientX - rect.left) / rect.width;
          const frame = Math.round(ratio * total);
          let insertIndex = markers.length;
          for (let i = 0; i < markers.length; i++) {
            const m = markers[i];
            if (frame >= m.start && frame < m.endExclusive) {
              const within = (frame - m.start) / m.frames;
              insertIndex = within > 0.5 ? i + 1 : i;
              break;
            }
          }
          const portrait = project.height > project.width;
          // 1) Upload URL → media-backed scene.
          const url = e.dataTransfer.getData("vibeedit/upload-url");
          if (url) {
            e.preventDefault();
            const type = e.dataTransfer.getData("vibeedit/upload-type");
            const scene = type.startsWith("video/")
              ? {
                  id: createId(),
                  type: "text_only" as const,
                  duration: 3,
                  background: { ...DEFAULT_BG, videoUrl: url },
                  transition: "beat_flash" as const,
                }
              : {
                  id: createId(),
                  type: "text_only" as const,
                  duration: 3,
                  background: { ...DEFAULT_BG, imageUrl: url, kenBurns: true },
                  emphasisText: "edit me",
                  emphasisSize: portrait ? 96 : 72,
                  emphasisColor: "#ffffff",
                  textY: portrait ? 500 : 380,
                  transition: "beat_flash" as const,
                };
            insertSceneAt(insertIndex, scene);
            return;
          }
          // 1.5) Title template → new scene with the template's full
          //      bundle of fields. Distinct from scene-type because
          //      titles include effects[], motion presets, transition,
          //      pre-filled text content. Just a deeper bundle.
          const titlePayload = e.dataTransfer.getData("vibeedit/title");
          if (titlePayload) {
            e.preventDefault();
            try {
              const { params } = JSON.parse(titlePayload) as {
                params?: Record<string, unknown>;
              };
              if (params) {
                // Merge over a base scene shape so id + minimal defaults
                // are present even when the template omits them.
                const base = {
                  id: createId(),
                  type: "text_only" as const,
                  duration: 3,
                  background: { ...DEFAULT_BG },
                };
                const merged = {
                  ...base,
                  ...(params as Record<string, unknown>),
                  id: base.id,
                  background: {
                    ...base.background,
                    ...((params as { background?: Record<string, unknown> }).background ??
                      {}),
                  },
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                } as any;
                insertSceneAt(insertIndex, merged);
              }
            } catch {}
            return;
          }
          // 2) Scene-type card → blank scene with that type pre-set.
          const sceneTypePayload = e.dataTransfer.getData("vibeedit/scene-type");
          if (sceneTypePayload) {
            e.preventDefault();
            try {
              const { value } = JSON.parse(sceneTypePayload) as { value: string };
              const baseScene = {
                id: createId(),
                type: value as "text_only",
                duration: 3,
                background: { ...DEFAULT_BG },
                transition: "beat_flash" as const,
              };
              // Per-type sensible defaults so the dropped scene isn't
              // a blank rectangle the user has to configure from zero.
              type SceneShape = typeof baseScene & {
                emphasisText?: string;
                emphasisSize?: number;
                emphasisColor?: string;
                textY?: number;
                statValue?: string;
                statLabel?: string;
                quoteText?: string;
                quoteAttribution?: string;
                bulletItems?: string[];
                montageUrls?: string[];
                chartBars?: Array<{ label: string; value: number }>;
                splitLeftUrl?: string;
                splitRightUrl?: string;
              };
              const scene: SceneShape = baseScene;
              if (value === "text_only") {
                scene.emphasisText = "edit me";
                scene.emphasisSize = portrait ? 96 : 72;
                scene.emphasisColor = "#ffffff";
                scene.textY = portrait ? 500 : 380;
              } else if (value === "stat") {
                scene.statValue = "100%";
                scene.statLabel = "edit this label";
              } else if (value === "quote") {
                scene.quoteText = "Edit this quote";
                scene.quoteAttribution = "Author";
              } else if (value === "bullet_list") {
                scene.bulletItems = ["Point one", "Point two", "Point three"];
              } else if (value === "bar_chart") {
                scene.chartBars = [
                  { label: "A", value: 30 },
                  { label: "B", value: 60 },
                  { label: "C", value: 45 },
                ];
              }
              insertSceneAt(insertIndex, scene);
            } catch {
              // bad payload — silently ignore
            }
            return;
          }
        }}
        className={`group/timeline relative h-8 bg-neutral-900 rounded border border-neutral-800 ${
          cutMode ? "cursor-crosshair" : "cursor-pointer"
        }`}
        title={cutMode ? "Click to cut at this frame" : "Click to jump · drop an upload to insert a scene"}
      >
        {markers.map((m, i) => {
          const left = (m.start / total) * 100;
          const width = (m.frames / total) * 100;
          const scene = project.scenes[i];
          const selected = scene.id === m.id;
          const isHoverTarget = hoverIndex === i && dragIndex !== null && dragIndex !== i;
          return (
            <div
              key={m.id}
              style={{ left: `${left}%`, width: `${width}%` }}
              draggable
              onDragStart={(e) => {
                setDragIndex(i);
                e.dataTransfer.effectAllowed = "move";
              }}
              onDragOver={(e) => {
                // Accept the existing reorder drag AND new vibeedit/* card
                // drops so users can drop effects / transitions / ai-
                // actions onto a specific scene.
                const types = e.dataTransfer.types;
                if (
                  dragIndex !== null ||
                  types.includes("vibeedit/effect") ||
                  types.includes("vibeedit/transition") ||
                  types.includes("vibeedit/ai-action") ||
                  types.includes("vibeedit/look")
                ) {
                  e.preventDefault();
                  e.stopPropagation();
                  setHoverIndex(i);
                  e.dataTransfer.dropEffect =
                    types.includes("vibeedit/effect") ||
                    types.includes("vibeedit/transition") ||
                    types.includes("vibeedit/ai-action") ||
                    types.includes("vibeedit/look")
                      ? "copy"
                      : "move";
                }
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                // 1) Effect card → push onto scene.effects.
                const effectPayload = e.dataTransfer.getData("vibeedit/effect");
                if (effectPayload) {
                  try {
                    const { value, params } = JSON.parse(effectPayload) as { value: string; params?: Record<string, unknown> };
                    const updated: Scene["effects"] = [
                      ...((scene.effects ?? []) as NonNullable<Scene["effects"]>),
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      { kind: value as any, startFrame: 0, ...(params ?? {}) },
                    ];
                    updateScene(scene.id, { effects: updated });
                  } catch {}
                  setDragIndex(null);
                  setHoverIndex(null);
                  return;
                }
                // 2) Transition card → set the cut going INTO this scene
                //    from its predecessor. End-of-track scene 0 has no
                //    predecessor; we silently no-op.
                const transPayload = e.dataTransfer.getData("vibeedit/transition");
                if (transPayload) {
                  try {
                    const { value, params } = JSON.parse(transPayload) as {
                      value: string;
                      params?: { durationFrames?: number; color?: string };
                    };
                    const prev = project.scenes[i - 1];
                    if (prev) {
                      const existing = (project.cuts ?? []).filter(
                        (c) => !(c.fromSceneId === prev.id && c.toSceneId === scene.id),
                      );
                      const newCut: Cut = {
                        id: createId(),
                        fromSceneId: prev.id,
                        toSceneId: scene.id,
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        kind: value as any,
                        durationFrames: params?.durationFrames ?? 12,
                        color: params?.color,
                      };
                      // No public store action for raw "set cuts list" so
                      // fall through the upsertCut helper which already
                      // dedupes by from/to pair. We re-import inline.
                      void existing;
                      useProjectStore.getState().upsertCut(newCut);
                    }
                  } catch {}
                  setDragIndex(null);
                  setHoverIndex(null);
                  return;
                }
                // 3a) Look → merge bundled background fields onto the scene.
                const lookPayload = e.dataTransfer.getData("vibeedit/look");
                if (lookPayload) {
                  try {
                    const { params } = JSON.parse(lookPayload) as {
                      params?: Record<string, unknown>;
                    };
                    if (params) {
                      // Reset the keys we're setting to the new bundle so a
                      // second look fully replaces the first (vs additive).
                      const cleanedBg = { ...scene.background };
                      for (const k of [
                        "colorGrade",
                        "brightness",
                        "contrast",
                        "saturation",
                        "temperature",
                        "blur",
                      ] as const) {
                        delete (cleanedBg as Record<string, unknown>)[k];
                      }
                      updateScene(scene.id, {
                        background: { ...cleanedBg, ...(params as Record<string, unknown>) } as Scene["background"],
                      });
                    }
                  } catch {}
                  setDragIndex(null);
                  setHoverIndex(null);
                  return;
                }
                // 3) AI action → focus this scene + run prefab prompt.
                const aiPayload = e.dataTransfer.getData("vibeedit/ai-action");
                if (aiPayload) {
                  try {
                    const { prompt } = JSON.parse(aiPayload) as { prompt: string };
                    void import("@/store/editor-store").then(({ useEditorStore }) => {
                      useEditorStore.getState().setFocusedSceneId(scene.id);
                    });
                    const evt = new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true });
                    window.dispatchEvent(evt);
                    setTimeout(async () => {
                      const { useChatStore } = await import("@/store/chat-store");
                      useChatStore.getState().addUserMessage(prompt);
                      document.querySelector<HTMLFormElement>("aside form")?.requestSubmit();
                    }, 80);
                  } catch {}
                  setDragIndex(null);
                  setHoverIndex(null);
                  return;
                }
                // 4) Existing reorder behavior.
                if (dragIndex !== null && dragIndex !== i) {
                  moveScene(dragIndex, i);
                }
                setDragIndex(null);
                setHoverIndex(null);
              }}
              onDragEnd={() => {
                setDragIndex(null);
                setHoverIndex(null);
              }}
              className={`absolute top-0 bottom-0 border-l border-neutral-800/70 cursor-grab active:cursor-grabbing transition-colors ${
                playingSceneId === m.id
                  ? "bg-sky-500/40 ring-1 ring-sky-400 ring-inset"
                  : selected
                    ? "bg-emerald-500/25"
                    : "hover:bg-neutral-800/60"
              } ${isHoverTarget ? "ring-2 ring-sky-400 ring-inset" : ""} ${
                dragIndex === i ? "opacity-50" : ""
              }`}
              title={`Scene ${i + 1} · ${(m.frames / project.fps).toFixed(1)}s\nDrag body to reorder · drag right edge to trim · click to seek · right-click for menu`}
            >
              <span className="absolute left-2 top-0 text-[9px] font-mono text-neutral-500 pointer-events-none z-10">
                {i + 1}
              </span>
              {scene.voiceover?.audioUrl && (
                <AudioWaveform src={scene.voiceover.audioUrl} height={32} />
              )}
              {/* Right-edge handle reveals on hover so the trim affordance
                  is visible without sniffing the cursor. The wider hit-area
                  span sits behind a thinner visible bar. */}
              <span
                onPointerDown={(e) => onResizeDown(e, m.id, scene.duration)}
                onPointerMove={onResizeMove}
                onPointerUp={onResizeUp}
                onClick={(e) => e.stopPropagation()}
                className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize group"
                aria-label="Trim end of scene"
              >
                <span className="block absolute right-0 top-0 bottom-0 w-1 bg-emerald-400/0 group-hover:bg-emerald-400/70 transition-colors" />
              </span>
            </div>
          );
        })}
        {(
          <div
            style={{ left: `${playheadPct}%` }}
            className="absolute top-0 bottom-0 w-[2px] bg-emerald-400 pointer-events-none"
          />
        )}
        {/* Insert (+) buttons at every boundary AND at the very start and
            end. Hover-revealed; click → blank scene at that index pushed
            via insertSceneAt. */}
        {(() => {
          const portrait = project.height > project.width;
          const blankScene = () => ({
            id: createId(),
            type: "text_only" as const,
            duration: 2,
            emphasisText: "edit me",
            emphasisSize: portrait ? 96 : 72,
            emphasisColor: "#ffffff",
            textY: portrait ? 500 : 380,
            transition: "beat_flash" as const,
            background: { ...DEFAULT_BG },
          });
          const buttons: React.ReactNode[] = [];
          for (let i = 0; i <= markers.length; i++) {
            const m = markers[i];
            const prevEnd = i === 0 ? 0 : markers[i - 1].endExclusive;
            const leftPct = ((i === 0 ? 0 : i === markers.length ? markers[markers.length - 1].endExclusive : m.start) / total) * 100;
            void prevEnd;
            buttons.push(
              <button
                key={`ins-${i}`}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  insertSceneAt(i, blankScene());
                }}
                title={`Insert blank scene at position ${i + 1}`}
                style={{ left: `${leftPct}%` }}
                className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 opacity-0 hover:opacity-100 group-hover/timeline:opacity-100 transition-opacity h-4 w-4 rounded-full bg-emerald-500 text-black flex items-center justify-center hover:scale-110"
              >
                <Plus className="h-3 w-3" />
              </button>,
            );
          }
          return buttons;
        })()}
        {/* Cut markers between consecutive scenes. We mount them at the
            track level (above the scene blocks' z-index) so the popover
            anchors correctly without getting clipped by the block's
            overflow-hidden parent. */}
        {markers.slice(0, -1).map((m, i) => {
          const fromScene = project.scenes[i];
          const toScene = project.scenes[i + 1];
          if (!fromScene || !toScene) return null;
          const cut: Cut = (project.cuts ?? []).find(
            (c) =>
              c.fromSceneId === fromScene.id && c.toSceneId === toScene.id,
          ) ?? {
            id: `auto-${fromScene.id}-${toScene.id}`,
            fromSceneId: fromScene.id,
            toSceneId: toScene.id,
            kind: "hard",
            durationFrames: 0,
          };
          const leftPct = (m.endExclusive / total) * 100;
          return (
            <div
              key={`cut-${fromScene.id}-${toScene.id}`}
              style={{ left: `${leftPct}%`, position: "absolute", top: 0, bottom: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <CutMarker
                cut={cut}
                fromScene={fromScene}
                toScene={toScene}
                orientation="horizontal"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
