"use client";

import { Plus, Scissors } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import type { PlayerRef } from "@remotion/player";
import type { Cut } from "@/lib/scene-schema";
import { createId, DEFAULT_BG, sceneDurationFrames, totalDurationFrames } from "@/lib/scene-schema";
import { useEditorStore } from "@/store/editor-store";
import { useProjectStore } from "@/store/project-store";
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
  const [cutMode, setCutMode] = useState(false);
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
      const next = Math.max(
        0.5,
        Math.min(10, +(st.startDuration + dx / st.pxPerSec).toFixed(1)),
      );
      updateScene(st.sceneId, { duration: next });
    },
    [updateScene],
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
    const frame = Math.round(ratio * total);
    const marker = markers.find((m) => frame >= m.start && frame < m.endExclusive);
    if (cutMode) {
      // Cut at this frame inside the marker's scene.
      if (marker) {
        const within = frame - marker.start;
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
            onClick={() => setCutMode((v) => !v)}
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
        className={`group/timeline relative h-8 bg-neutral-900 rounded border border-neutral-800 ${
          cutMode ? "cursor-crosshair" : "cursor-pointer"
        }`}
        title={cutMode ? "Click to cut at this frame" : "Click to jump"}
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
                e.preventDefault();
                setHoverIndex(i);
                e.dataTransfer.dropEffect = "move";
              }}
              onDrop={(e) => {
                e.preventDefault();
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
              title={`Scene ${i + 1} · ${(m.frames / project.fps).toFixed(1)}s — drag body to reorder, drag right edge to resize`}
            >
              <span className="absolute left-1 top-0 text-[9px] font-mono text-neutral-500 pointer-events-none">
                {i + 1}
              </span>
              {/* Resize handle on the right edge — widens on hover for easier grab. */}
              <span
                onPointerDown={(e) => onResizeDown(e, m.id, scene.duration)}
                onPointerMove={onResizeMove}
                onPointerUp={onResizeUp}
                onClick={(e) => e.stopPropagation()}
                className="absolute right-0 top-0 bottom-0 w-1 hover:w-1.5 hover:bg-emerald-400/70 cursor-ew-resize"
                aria-label="Resize scene duration"
              />
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
