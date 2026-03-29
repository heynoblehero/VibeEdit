"use client";

import { useState, useRef, useCallback } from "react";
import { useClipperStore } from "@/stores/clipper-store";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import type { ClipMoment } from "@/types/clipper";
import { PLATFORM_SPECS } from "@/types/clipper";
import { cn } from "@/utils/ui";
import {
  Play,
  Pause,
  TrendingUp,
  Clock,
  Hash,
  X,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Score badge                                                        */
/* ------------------------------------------------------------------ */

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 80
      ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
      : score >= 60
        ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
        : "bg-zinc-500/15 text-zinc-400 border-zinc-500/30";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
        color,
      )}
    >
      <TrendingUp className="h-2.5 w-2.5" />
      {score}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Platform badge                                                     */
/* ------------------------------------------------------------------ */

function PlatformBadge({ platform }: { platform: string }) {
  const spec =
    PLATFORM_SPECS[platform as keyof typeof PLATFORM_SPECS];
  if (!spec) return null;
  return (
    <span className="inline-flex items-center rounded bg-muted/60 px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground">
      {spec.label}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Duration formatter                                                 */
/* ------------------------------------------------------------------ */

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  if (m > 0) return `${m}m${s.toString().padStart(2, "0")}s`;
  return `${s}s`;
}

/* ------------------------------------------------------------------ */
/*  Mini video player modal                                            */
/* ------------------------------------------------------------------ */

function MiniPlayer({
  moment,
  onClose,
}: {
  moment: ClipMoment;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md rounded-xl border border-border bg-card shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-semibold truncate">{moment.title}</h4>
            <p className="text-xs text-muted-foreground mt-0.5">
              {formatDuration(moment.endTime - moment.startTime)} &middot;
              Score: {moment.score}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Preview placeholder */}
        <div className="aspect-[9/16] max-h-[60vh] bg-black/90 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-muted-foreground/60">
            <Play className="h-12 w-12" />
            <span className="text-xs">
              Preview: {formatDuration(moment.startTime)} -{" "}
              {formatDuration(moment.endTime)}
            </span>
          </div>
        </div>

        {/* Details */}
        <div className="px-4 py-3 flex flex-col gap-2 border-t border-border/60">
          <p className="text-xs text-muted-foreground">{moment.reason}</p>
          {moment.hashtags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {moment.hashtags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-0.5 rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[10px] font-medium"
                >
                  <Hash className="h-2.5 w-2.5" />
                  {tag}
                </span>
              ))}
            </div>
          )}
          <p className="text-[10px] text-muted-foreground/70 italic line-clamp-3">
            &ldquo;{moment.transcript}&rdquo;
          </p>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Single clip card                                                   */
/* ------------------------------------------------------------------ */

function ClipCard({
  moment,
  isSelected,
  onToggle,
  onPreview,
  platforms,
}: {
  moment: ClipMoment;
  isSelected: boolean;
  onToggle: () => void;
  onPreview: () => void;
  platforms: string[];
}) {
  const [hovered, setHovered] = useState(false);
  const duration = moment.endTime - moment.startTime;

  return (
    <div
      className={cn(
        "group relative rounded-lg border overflow-hidden transition-all duration-150",
        isSelected
          ? "border-primary/50 bg-primary/5 shadow-sm"
          : "border-border/60 bg-card/60 hover:border-border",
      )}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Thumbnail / preview area */}
      <button
        type="button"
        onClick={onPreview}
        className="relative aspect-[9/16] w-full bg-black/80 flex items-center justify-center overflow-hidden cursor-pointer"
      >
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent z-10" />

        {/* Play icon on hover */}
        <div
          className={cn(
            "relative z-20 flex items-center justify-center h-10 w-10 rounded-full bg-white/20 backdrop-blur-sm text-white transition-all",
            hovered ? "opacity-100 scale-100" : "opacity-0 scale-90",
          )}
        >
          <Play className="h-5 w-5 fill-current" />
        </div>

        {/* Score badge - top right */}
        <div className="absolute top-2 right-2 z-20">
          <ScoreBadge score={moment.score} />
        </div>

        {/* Duration - bottom left */}
        <div className="absolute bottom-2 left-2 z-20 flex items-center gap-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white/90 tabular-nums">
          <Clock className="h-2.5 w-2.5" />
          {formatDuration(duration)}
        </div>
      </button>

      {/* Card body */}
      <div className="p-2.5 flex flex-col gap-1.5">
        {/* Title */}
        <h4 className="text-xs font-semibold leading-tight line-clamp-2 min-h-[2rem]">
          {moment.title}
        </h4>

        {/* Reason on hover */}
        {hovered && (
          <p className="text-[10px] text-muted-foreground line-clamp-2">
            {moment.reason}
          </p>
        )}

        {/* Platform badges */}
        <div className="flex flex-wrap gap-1">
          {platforms.map((p) => (
            <PlatformBadge key={p} platform={p} />
          ))}
        </div>

        {/* Hashtags */}
        {hovered && moment.hashtags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {moment.hashtags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-0.5 text-[9px] text-primary/80"
              >
                #{tag}
              </span>
            ))}
            {moment.hashtags.length > 3 && (
              <span className="text-[9px] text-muted-foreground">
                +{moment.hashtags.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Selection checkbox */}
        <div className="flex items-center gap-2 pt-1 border-t border-border/40">
          <Checkbox
            checked={isSelected}
            onCheckedChange={onToggle}
          />
          <span className="text-[10px] text-muted-foreground">
            {isSelected ? "Selected" : "Select"}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main grid component                                                */
/* ------------------------------------------------------------------ */

export function ClipPreviewGrid() {
  const moments = useClipperStore((s) => s.moments);
  const selectedMomentIds = useClipperStore((s) => s.selectedMomentIds);
  const toggleMoment = useClipperStore((s) => s.toggleMoment);
  const selectAll = useClipperStore((s) => s.selectAll);
  const deselectAll = useClipperStore((s) => s.deselectAll);
  const platforms = useClipperStore((s) => s.settings.platforms);

  const [previewMoment, setPreviewMoment] = useState<ClipMoment | null>(null);

  const selectedCount = selectedMomentIds.size;
  const totalCount = moments.length;

  return (
    <div className="flex flex-col gap-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={selectAll}
            className="text-xs"
          >
            Select All
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={deselectAll}
            className="text-xs"
          >
            Deselect All
          </Button>
          <span className="text-xs text-muted-foreground">
            {selectedCount} of {totalCount} selected
          </span>
        </div>
        <span className="text-xs text-muted-foreground">
          Sorted by virality score
        </span>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {moments.map((moment) => (
          <ClipCard
            key={moment.id}
            moment={moment}
            isSelected={selectedMomentIds.has(moment.id)}
            onToggle={() => toggleMoment(moment.id)}
            onPreview={() => setPreviewMoment(moment)}
            platforms={platforms}
          />
        ))}
      </div>

      {moments.length === 0 && (
        <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
          No clips found. Try adjusting your settings and running again.
        </div>
      )}

      {/* Mini player overlay */}
      {previewMoment && (
        <MiniPlayer
          moment={previewMoment}
          onClose={() => setPreviewMoment(null)}
        />
      )}
    </div>
  );
}
