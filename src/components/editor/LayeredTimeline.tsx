"use client";

/**
 * LayeredTimeline (sprint 19) — Premiere-style item-based timeline.
 *
 * Mounts the existing scene-block <Timeline> as the top "Scenes" row
 * (preserves cuts, transitions, drag-drop ecosystem, audio waveforms,
 * markers, loop range) and decorates it with per-layer rows below
 * showing every Scene's constituent items as draggable-style blocks.
 *
 * Sprint 19 is read-only on items (drag/resize lands in sprint 20).
 * Click an item block → selectScene + setEditTarget → editor sidebar
 * jumps to that layer's panel.
 */

import type { PlayerRef } from "@remotion/player";
import { useMemo } from "react";
import {
  type LayerKind,
  type TimelineItem,
  LAYER_LABEL,
  LAYER_ROW_ORDER,
  deriveItemsFromScene,
  kindToEditTarget,
} from "@/lib/timeline-items";
import {
  projectTotalFrames,
  resolveTracks,
  sceneDurationFrames,
} from "@/lib/scene-schema";
import { useEditorStore } from "@/store/editor-store";
import { useProjectStore } from "@/store/project-store";
import { Timeline } from "./Timeline";

interface Props {
  playerRef: React.RefObject<PlayerRef | null>;
  currentFrame: number;
  isFullPreview: boolean;
}

/** Solid-fill block colour — keeps the timeline calm. The previous
 *  vertical gradient + ring + scale was too loud across many rows. */
const COLOR_BG: Record<TimelineItem["color"], string> = {
  neutral: "bg-neutral-600/85 hover:bg-neutral-500",
  sky: "bg-sky-600/85 hover:bg-sky-500",
  emerald: "bg-emerald-600/85 hover:bg-emerald-500",
  amber: "bg-amber-600/85 hover:bg-amber-500",
  purple: "bg-purple-600/85 hover:bg-purple-500",
  cyan: "bg-cyan-600/85 hover:bg-cyan-500",
  pink: "bg-pink-600/85 hover:bg-pink-500",
};

/** Faint accent rail painted on the left rail of each row — matches
 *  the block color so the eye groups them. */
const COLOR_RAIL: Record<TimelineItem["color"], string> = {
  neutral: "bg-neutral-500/40",
  sky: "bg-sky-500/40",
  emerald: "bg-emerald-500/40",
  amber: "bg-amber-500/40",
  purple: "bg-purple-500/40",
  cyan: "bg-cyan-500/40",
  pink: "bg-pink-500/40",
};

const COLOR_TEXT: Record<TimelineItem["color"], string> = {
  neutral: "text-neutral-50",
  sky: "text-white",
  emerald: "text-white",
  amber: "text-amber-50",
  purple: "text-white",
  cyan: "text-cyan-50",
  pink: "text-pink-50",
};

export function LayeredTimeline({ playerRef, currentFrame, isFullPreview }: Props) {
  const project = useProjectStore((s) => s.project);
  const selectScene = useProjectStore((s) => s.selectScene);
  const setEditTarget = useEditorStore((s) => s.setEditTarget);
  const setSelectedItemId = useEditorStore((s) => s.setSelectedItemId);
  const selectedItemId = useEditorStore((s) => s.selectedItemId);
  const expandedLayers = useEditorStore((s) => s.expandedLayers);
  const toggleExpandedLayer = useEditorStore((s) => s.toggleExpandedLayer);
  const timelineZoom = useEditorStore((s) => s.timelineZoom);

  const total = Math.max(1, projectTotalFrames(project));

  // Build the full TimelineItem[] across every track + every scene at
  // its global frame position. We honour Track.startOffsetSec so
  // overlay tracks line up where the renderer actually places them.
  const itemsByLayer = useMemo(() => {
    const tracks = resolveTracks(project);
    const sceneById = new Map(project.scenes.map((s) => [s.id, s]));
    const grouped = new Map<LayerKind, TimelineItem[]>();
    for (const t of tracks) {
      let acc = Math.round((t.startOffsetSec ?? 0) * project.fps);
      for (const id of t.sceneIds) {
        const sc = sceneById.get(id);
        if (!sc) continue;
        const items = deriveItemsFromScene(sc, acc, project.fps);
        for (const item of items) {
          const arr = grouped.get(item.kind) ?? [];
          arr.push(item);
          grouped.set(item.kind, arr);
        }
        acc += sceneDurationFrames(sc, project.fps);
      }
    }
    return grouped;
  }, [project]);

  if (project.scenes.length === 0) {
    return (
      <Timeline
        playerRef={playerRef}
        currentFrame={currentFrame}
        isFullPreview={isFullPreview}
      />
    );
  }

  const handleItemClick = (item: TimelineItem) => {
    selectScene(item.sceneId);
    const target = kindToEditTarget(item.kind);
    if (target !== null) setEditTarget(target);
    setSelectedItemId(item.id);
  };

  const playheadPct = Math.min(100, Math.max(0, (currentFrame / total) * 100));

  return (
    <div className="flex flex-col gap-1 shrink-0">
      <Timeline
        playerRef={playerRef}
        currentFrame={currentFrame}
        isFullPreview={isFullPreview}
      />

      {/* Per-layer rows. Each row mirrors the scene-row's 56px
          left rail (above) so all rows share a clean vertical
          column. Playhead spans every row. */}
      <div className="space-y-0.5">
        {LAYER_ROW_ORDER.map((kind) => {
          const items = itemsByLayer.get(kind);
          if (!items || items.length === 0) return null;
          const isExpanded = expandedLayers[kind] ?? true;
          return (
            <LayerRow
              key={kind}
              kind={kind}
              items={items}
              total={total}
              isExpanded={isExpanded}
              selectedItemId={selectedItemId}
              timelineZoom={timelineZoom}
              playheadPct={playheadPct}
              onToggle={() => toggleExpandedLayer(kind)}
              onClickItem={handleItemClick}
            />
          );
        })}
      </div>
    </div>
  );
}

function LayerRow({
  kind,
  items,
  total,
  isExpanded,
  selectedItemId,
  timelineZoom,
  playheadPct,
  onToggle,
  onClickItem,
}: {
  kind: LayerKind;
  items: TimelineItem[];
  total: number;
  isExpanded: boolean;
  selectedItemId: string | null;
  timelineZoom: number;
  playheadPct: number;
  onToggle: () => void;
  onClickItem: (item: TimelineItem) => void;
}) {
  // Use the first item's color as the row's accent — most rows have
  // a single LayerKind whose items share a color anyway.
  const accent = items[0]?.color ?? "neutral";
  return (
    <div className="flex items-stretch gap-1">
      <button
        onClick={onToggle}
        className={`w-14 shrink-0 relative flex items-center gap-1 px-1.5 rounded-md bg-neutral-900/80 border border-neutral-800 hover:border-neutral-600 hover:bg-neutral-800/80 text-[9px] font-medium text-neutral-400 hover:text-white transition-colors overflow-hidden`}
        title={`${LAYER_LABEL[kind]} · ${items.length} item${items.length === 1 ? "" : "s"} · click to ${isExpanded ? "collapse" : "expand"}`}
      >
        <span
          className={`absolute left-0 top-0 bottom-0 w-0.5 ${COLOR_RAIL[accent]}`}
        />
        <span className="text-neutral-600 ml-1">{isExpanded ? "▾" : "▸"}</span>
        <span className="truncate uppercase tracking-wider">{LAYER_LABEL[kind]}</span>
        <span className="ml-auto text-[8.5px] text-neutral-700 tabular-nums">
          {items.length}
        </span>
      </button>
      <div
        className="flex-1 overflow-x-auto overflow-y-hidden"
        style={{ scrollbarWidth: "none" }}
      >
        <div
          style={{ width: `${timelineZoom * 100}%`, minWidth: "100%" }}
          className={`relative rounded-md border border-neutral-800/40 bg-neutral-900/20 ${
            isExpanded ? "h-6" : "h-1.5"
          } transition-[height] duration-150`}
        >
          {isExpanded &&
            items.map((item) => {
              const left = (item.startFrame / total) * 100;
              const width = Math.max(0.2, (item.durationFrames / total) * 100);
              const isSelected = selectedItemId === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onClickItem(item)}
                  style={{ left: `${left}%`, width: `${width}%` }}
                  title={`${item.label} · ${(item.durationFrames / 30).toFixed(1)}s`}
                  className={`absolute top-0.5 bottom-0.5 ${
                    COLOR_BG[item.color]
                  } ${COLOR_TEXT[item.color]} rounded-sm ${
                    isSelected
                      ? "ring-2 ring-white shadow-md shadow-black/40"
                      : "hover:ring-1 hover:ring-white/40"
                  } px-1.5 text-[9px] font-medium truncate text-left transition-all`}
                >
                  {item.label}
                </button>
              );
            })}
          {/* Per-row playhead — pure visual continuity across rows. */}
          <div
            className="absolute top-0 bottom-0 w-[1.5px] bg-emerald-400/80 pointer-events-none"
            style={{ left: `${playheadPct}%` }}
          />
        </div>
      </div>
    </div>
  );
}
