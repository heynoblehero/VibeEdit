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

/** Tailwind class lookup keyed by TimelineItem.color. Each block uses
 *  a gradient bg + soft inset shadow for depth without overpowering. */
const COLOR_BG: Record<TimelineItem["color"], string> = {
  neutral: "bg-gradient-to-b from-neutral-600 to-neutral-700 hover:from-neutral-500 hover:to-neutral-600",
  sky: "bg-gradient-to-b from-sky-400 to-sky-600 hover:from-sky-300 hover:to-sky-500",
  emerald: "bg-gradient-to-b from-emerald-400 to-emerald-600 hover:from-emerald-300 hover:to-emerald-500",
  amber: "bg-gradient-to-b from-amber-400 to-amber-600 hover:from-amber-300 hover:to-amber-500",
  purple: "bg-gradient-to-b from-purple-400 to-purple-600 hover:from-purple-300 hover:to-purple-500",
  cyan: "bg-gradient-to-b from-cyan-400 to-cyan-600 hover:from-cyan-300 hover:to-cyan-500",
  pink: "bg-gradient-to-b from-pink-400 to-pink-600 hover:from-pink-300 hover:to-pink-500",
};

const COLOR_TEXT: Record<TimelineItem["color"], string> = {
  neutral: "text-neutral-50",
  sky: "text-sky-50",
  emerald: "text-emerald-50",
  amber: "text-amber-50",
  purple: "text-purple-50",
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

      {/* Layer rows. Each row is a single horizontal strip; blocks
          inside are positioned absolutely via left%/width%. We share
          the same `total` denominator + timelineZoom multiplier as
          the main Timeline so vertical alignment matches. */}
      <div className="border-t border-neutral-800/60 pt-2 mt-1.5">
        <div className="text-[9px] uppercase tracking-[0.18em] text-neutral-600 font-medium px-1 mb-1.5">
          Layers
        </div>
        <div
          className="overflow-x-auto overflow-y-hidden"
          style={{ scrollbarWidth: "thin" }}
        >
          <div
            style={{ width: `${timelineZoom * 100}%`, minWidth: "100%" }}
            className="relative"
          >
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
                  onToggle={() => toggleExpandedLayer(kind)}
                  onClickItem={handleItemClick}
                />
              );
            })}
            {/* Playhead — spans every layer row so the user sees
                cross-row alignment. */}
            <div
              className="absolute top-0 bottom-0 w-[2px] bg-emerald-400 pointer-events-none"
              style={{ left: `${playheadPct}%` }}
            />
          </div>
        </div>
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
  onToggle,
  onClickItem,
}: {
  kind: LayerKind;
  items: TimelineItem[];
  total: number;
  isExpanded: boolean;
  selectedItemId: string | null;
  onToggle: () => void;
  onClickItem: (item: TimelineItem) => void;
}) {
  return (
    <div className="flex items-stretch gap-1 mb-0.5">
      <button
        onClick={onToggle}
        className="w-14 shrink-0 flex items-center gap-1 px-1.5 rounded-md bg-neutral-900/80 border border-neutral-800 hover:border-neutral-600 hover:bg-neutral-800/80 text-[9px] font-medium text-neutral-400 hover:text-white transition-colors"
        title={`${LAYER_LABEL[kind]} · ${items.length} item${items.length === 1 ? "" : "s"} · click to ${isExpanded ? "collapse" : "expand"}`}
      >
        <span className="text-neutral-600">{isExpanded ? "▾" : "▸"}</span>
        <span className="truncate uppercase tracking-wider">{LAYER_LABEL[kind]}</span>
        <span className="ml-auto text-[8.5px] text-neutral-700 tabular-nums">
          {items.length}
        </span>
      </button>
      <div
        className={`relative flex-1 rounded-md border border-neutral-800/40 bg-neutral-900/20 ${
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
                } ${COLOR_TEXT[item.color]} rounded-sm shadow-sm ring-1 ${
                  isSelected
                    ? "ring-white shadow-md scale-y-105"
                    : "ring-black/40 hover:ring-white/50 hover:shadow-md"
                } px-1.5 text-[9px] font-medium truncate text-left transition-all`}
              >
                {item.label}
              </button>
            );
          })}
      </div>
    </div>
  );
}
