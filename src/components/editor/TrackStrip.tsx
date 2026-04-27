"use client";

import { Layers, Music, Video } from "lucide-react";
import { toast } from "sonner";
import {
  type Track,
  type TrackKind,
  projectTotalFrames,
  resolveTracks,
  sceneDurationFrames,
} from "@/lib/scene-schema";
import { useEditorStore } from "@/store/editor-store";
import { useProjectStore } from "@/store/project-store";

const KIND_ICON: Record<TrackKind, typeof Video> = {
  video: Video,
  overlay: Layers,
  audio: Music,
};

const TRACK_BG: Record<TrackKind, string> = {
  video: "bg-emerald-500/15 border-emerald-500/40",
  overlay: "bg-cyan-500/15 border-cyan-500/40",
  audio: "bg-amber-500/15 border-amber-500/40",
};

/**
 * Compact horizontal strip showing every track as a one-line row at
 * its actual global-timeline position. Drop a Timeline scene-id onto
 * any row to move it (M4); each row mirrors the timeline zoom so the
 * scene blocks line up vertically with the main track. Hidden when
 * the project has only one (implicit) track.
 */
export function TrackStrip() {
  const project = useProjectStore((s) => s.project);
  const moveSceneToTrack = useProjectStore((s) => s.moveSceneToTrack);
  const updateTrack = useProjectStore((s) => s.updateTrack);
  const timelineZoom = useEditorStore((s) => s.timelineZoom);

  // Skip rendering if the project hasn't materialised tracks yet —
  // saves vertical space for single-track projects.
  if (!project.tracks || project.tracks.length === 0) return null;
  const tracks = resolveTracks(project);
  const total = Math.max(1, projectTotalFrames(project));
  const fps = project.fps;

  return (
    <div className="border-t border-neutral-800 pt-2 mt-1 space-y-0.5">
      <div className="text-[10px] uppercase tracking-wide text-neutral-600 px-1">
        All tracks
      </div>
      <div
        className="overflow-x-auto overflow-y-hidden"
        style={{ scrollbarWidth: "thin" }}
      >
        <div style={{ width: `${timelineZoom * 100}%`, minWidth: "100%" }}>
          {tracks.map((t) => (
            <TrackRow
              key={t.id}
              track={t}
              total={total}
              fps={fps}
              scenes={project.scenes}
              onDrop={(sceneId) => {
                if (t.locked) return;
                moveSceneToTrack(sceneId, t.id, t.sceneIds.length);
                toast(`Moved to ${t.name}`, { duration: 600 });
              }}
              onToggleMute={() => updateTrack(t.id, { muted: !t.muted })}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function TrackRow({
  track,
  total,
  fps,
  scenes,
  onDrop,
  onToggleMute,
}: {
  track: Track;
  total: number;
  fps: number;
  scenes: Array<import("@/lib/scene-schema").Scene>;
  onDrop: (sceneId: string) => void;
  onToggleMute: () => void;
}) {
  const Icon = KIND_ICON[track.kind];
  const startFrame = Math.round((track.startOffsetSec ?? 0) * fps);
  // Compute each scene's left/width % on the global timeline.
  let acc = startFrame;
  const blocks = track.sceneIds
    .map((id) => scenes.find((sc) => sc.id === id))
    .filter((s): s is NonNullable<typeof s> => !!s)
    .map((sc) => {
      const f = sceneDurationFrames(sc, fps);
      const start = acc;
      acc += f;
      return { sc, start, frames: f };
    });

  return (
    <div className="flex items-stretch gap-1 mb-0.5">
      <button
        onClick={onToggleMute}
        title={`${track.name} · ${track.kind}${track.muted ? " · muted" : ""}`}
        className={`w-12 shrink-0 text-[9px] flex items-center gap-1 px-1 rounded bg-neutral-900 border border-neutral-800 hover:border-neutral-600 ${
          track.muted ? "opacity-40" : ""
        }`}
      >
        <Icon className="h-2.5 w-2.5 text-neutral-400" />
        <span className="truncate text-neutral-300">{track.name}</span>
      </button>
      <div
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes("vibeedit/scene-id") && !track.locked) {
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
          }
        }}
        onDrop={(e) => {
          const sid = e.dataTransfer.getData("vibeedit/scene-id");
          if (!sid) return;
          e.preventDefault();
          onDrop(sid);
        }}
        className={`relative flex-1 h-4 rounded border ${TRACK_BG[track.kind]} ${
          track.muted ? "opacity-40" : ""
        }`}
      >
        {blocks.map(({ sc, start, frames }) => {
          const left = (start / total) * 100;
          const width = (frames / total) * 100;
          return (
            <div
              key={sc.id}
              style={{ left: `${left}%`, width: `${width}%` }}
              title={`${sc.label ?? sc.type} · ${(frames / fps).toFixed(2)}s`}
              className="absolute top-0 bottom-0 bg-neutral-200/80 border border-neutral-900 rounded-sm"
            />
          );
        })}
      </div>
    </div>
  );
}
