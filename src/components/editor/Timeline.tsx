"use client";

import { useCallback, useMemo, useRef } from "react";
import type { PlayerRef } from "@remotion/player";
import { sceneDurationFrames, totalDurationFrames } from "@/lib/scene-schema";
import { useProjectStore } from "@/store/project-store";

interface TimelineProps {
  playerRef: React.RefObject<PlayerRef | null>;
  currentFrame: number;
  isFullPreview: boolean;
}

export function Timeline({ playerRef, currentFrame, isFullPreview }: TimelineProps) {
  const project = useProjectStore((s) => s.project);
  const selectScene = useProjectStore((s) => s.selectScene);
  const updateScene = useProjectStore((s) => s.updateScene);

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
    seekTo(frame);
    const marker = markers.find((m) => frame >= m.start && frame < m.endExclusive);
    if (marker) selectScene(marker.id);
  };

  if (project.scenes.length === 0) return null;

  const playheadPct = isFullPreview
    ? Math.min(100, Math.max(0, (currentFrame / total) * 100))
    : null;

  const seconds = (total / project.fps).toFixed(1);

  return (
    <div className="flex flex-col gap-1 shrink-0 pt-2">
      <div className="flex items-center justify-between text-[10px] text-neutral-500 font-mono">
        <span>0.0s</span>
        <span>
          {isFullPreview
            ? `${(currentFrame / project.fps).toFixed(1)}s`
            : "per-scene"}
        </span>
        <span>{seconds}s</span>
      </div>
      <div
        ref={trackRef}
        onClick={handleClick}
        className="relative h-6 bg-neutral-900 rounded cursor-pointer border border-neutral-800 overflow-hidden"
        title="Click to jump"
      >
        {markers.map((m, i) => {
          const left = (m.start / total) * 100;
          const width = (m.frames / total) * 100;
          const scene = project.scenes[i];
          const selected = scene.id === m.id;
          return (
            <div
              key={m.id}
              style={{ left: `${left}%`, width: `${width}%` }}
              className={`absolute top-0 bottom-0 border-l border-neutral-800/70 ${
                selected ? "bg-emerald-500/25" : "hover:bg-neutral-800/60"
              }`}
              title={`Scene ${i + 1} · ${(m.frames / project.fps).toFixed(1)}s — drag right edge to resize`}
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
        {playheadPct !== null && (
          <div
            style={{ left: `${playheadPct}%` }}
            className="absolute top-0 bottom-0 w-[2px] bg-emerald-400 pointer-events-none"
          />
        )}
      </div>
    </div>
  );
}
