"use client";

import {
  EyeOff,
  Eye,
  Layers,
  Lock,
  LockOpen,
  Music,
  Plus,
  Trash2,
  Video,
} from "lucide-react";
import { toast } from "sonner";
import {
  type Track,
  type TrackKind,
  createId,
  resolveTracks,
  sceneDurationFrames,
} from "@/lib/scene-schema";
import { useProjectStore } from "@/store/project-store";

const KIND_ICON: Record<TrackKind, typeof Video> = {
  video: Video,
  overlay: Layers,
  audio: Music,
};

const BLEND_OPTIONS: NonNullable<Track["blendMode"]>[] = [
  "normal",
  "multiply",
  "screen",
  "overlay",
  "difference",
  "lighten",
  "darken",
];

/**
 * TracksPanel renders the project's track list with mute / lock /
 * opacity / blend controls per track + 'Add track' actions. Doubles
 * as a drop target for M4 — drag any scene from the timeline onto a
 * row to move it to that track.
 */
export function TracksPanel() {
  const project = useProjectStore((s) => s.project);
  const addTrack = useProjectStore((s) => s.addTrack);
  const removeTrack = useProjectStore((s) => s.removeTrack);
  const updateTrack = useProjectStore((s) => s.updateTrack);
  const moveSceneToTrack = useProjectStore((s) => s.moveSceneToTrack);

  // Resolve to handle the legacy implicit-V1 case.
  const tracks = resolveTracks(project);
  const isImplicit = !project.tracks || project.tracks.length === 0;

  const newTrack = (kind: TrackKind) => {
    const count = tracks.filter((t) => t.kind === kind).length;
    const name =
      kind === "video"
        ? `V${count + 1}`
        : kind === "overlay"
          ? `Overlay ${count + 1}`
          : `A${count + 1}`;
    addTrack({
      id: `track-${createId().slice(-8)}`,
      kind,
      name,
      sceneIds: [],
      ...(kind === "overlay" ? { opacity: 1, blendMode: "normal" } : {}),
    });
    toast(`Added ${name}`, { duration: 700 });
  };

  return (
    <div className="h-full flex flex-col">
      <div className="px-3 py-2 border-b border-neutral-800 flex items-center gap-2">
        <Layers className="h-3.5 w-3.5 text-emerald-400" />
        <h2 className="text-xs font-semibold text-white">Tracks</h2>
        <span className="text-[10px] text-neutral-500 ml-auto">
          {tracks.length}
        </span>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {tracks.map((t) => (
          <TrackRow
            key={t.id}
            track={t}
            scenes={project.scenes}
            isImplicit={isImplicit && t === tracks[0]}
            onUpdate={(patch) => updateTrack(t.id, patch)}
            onRemove={() => removeTrack(t.id)}
            onMoveSceneIn={(sceneId, idx) =>
              moveSceneToTrack(sceneId, t.id, idx)
            }
          />
        ))}
        <div className="pt-2 grid grid-cols-3 gap-1">
          <button
            onClick={() => newTrack("video")}
            className="text-[10px] px-1.5 py-1.5 rounded border border-neutral-800 hover:border-emerald-500 text-neutral-300 hover:text-emerald-300 flex items-center justify-center gap-1"
            title="Add a stacked video track"
          >
            <Plus className="h-3 w-3" />
            Video
          </button>
          <button
            onClick={() => newTrack("overlay")}
            className="text-[10px] px-1.5 py-1.5 rounded border border-neutral-800 hover:border-emerald-500 text-neutral-300 hover:text-emerald-300 flex items-center justify-center gap-1"
            title="Add an overlay track (opacity / blend)"
          >
            <Plus className="h-3 w-3" />
            Overlay
          </button>
          <button
            onClick={() => newTrack("audio")}
            className="text-[10px] px-1.5 py-1.5 rounded border border-neutral-800 hover:border-emerald-500 text-neutral-300 hover:text-emerald-300 flex items-center justify-center gap-1"
            title="Add an audio-only track"
          >
            <Plus className="h-3 w-3" />
            Audio
          </button>
        </div>
        <p className="text-[10px] text-neutral-500 px-1 pt-2">
          Drag a scene from the timeline onto any row above to move it.
        </p>
      </div>
    </div>
  );
}

function TrackRow({
  track,
  scenes,
  isImplicit,
  onUpdate,
  onRemove,
  onMoveSceneIn,
}: {
  track: Track;
  scenes: Array<import("@/lib/scene-schema").Scene>;
  isImplicit: boolean;
  onUpdate: (p: Partial<Track>) => void;
  onRemove: () => void;
  onMoveSceneIn: (sceneId: string, idx: number) => void;
}) {
  const Icon = KIND_ICON[track.kind];
  const sceneCount = track.sceneIds.length;
  const totalFrames = track.sceneIds.reduce((s, id) => {
    const sc = scenes.find((sc) => sc.id === id);
    return s + (sc ? sceneDurationFrames(sc, 30) : 0);
  }, 0);
  const sec = totalFrames / 30;

  return (
    <div
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("vibeedit/scene-id")) {
          if (track.locked) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
        }
      }}
      onDrop={(e) => {
        const sid = e.dataTransfer.getData("vibeedit/scene-id");
        if (!sid) return;
        e.preventDefault();
        onMoveSceneIn(sid, track.sceneIds.length);
        toast(`Moved to ${track.name}`, { duration: 600 });
      }}
      className={`rounded border ${
        track.muted ? "opacity-50" : ""
      } ${
        track.locked
          ? "border-amber-700/50 bg-amber-500/5"
          : "border-neutral-800 bg-neutral-900/40"
      } p-2 space-y-1.5`}
    >
      <div className="flex items-center gap-2">
        <Icon className="h-3 w-3 text-neutral-400 shrink-0" />
        <input
          value={track.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          className="bg-transparent text-xs text-neutral-200 font-medium w-20 focus:outline-none focus:text-white"
        />
        <span className="text-[10px] text-neutral-500 font-mono">
          {sceneCount} · {sec.toFixed(1)}s
        </span>
        <div className="ml-auto flex items-center gap-0.5">
          <button
            onClick={() => onUpdate({ muted: !track.muted })}
            title={track.muted ? "Unmute" : "Mute (skip on render)"}
            className="p-1 rounded text-neutral-500 hover:text-white hover:bg-neutral-800"
          >
            {track.muted ? (
              <EyeOff className="h-3 w-3 text-amber-400" />
            ) : (
              <Eye className="h-3 w-3" />
            )}
          </button>
          <button
            onClick={() => onUpdate({ locked: !track.locked })}
            title={track.locked ? "Unlock" : "Lock"}
            className="p-1 rounded text-neutral-500 hover:text-white hover:bg-neutral-800"
          >
            {track.locked ? (
              <Lock className="h-3 w-3 text-amber-400" />
            ) : (
              <LockOpen className="h-3 w-3" />
            )}
          </button>
          {!isImplicit && (
            <button
              onClick={onRemove}
              title="Remove track"
              className="p-1 rounded text-neutral-500 hover:text-red-400 hover:bg-red-500/10"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>
      {track.kind === "overlay" && (
        <div className="grid grid-cols-2 gap-1.5">
          <label className="flex items-baseline gap-1 text-[10px] text-neutral-400">
            <span>opacity</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={track.opacity ?? 1}
              onChange={(e) => onUpdate({ opacity: Number(e.target.value) })}
              className="flex-1 accent-emerald-500"
              title="Track opacity"
            />
            <span className="tabular-nums">
              {Math.round((track.opacity ?? 1) * 100)}%
            </span>
          </label>
          <label className="flex items-baseline gap-1 text-[10px] text-neutral-400">
            <span>blend</span>
            <select
              value={track.blendMode ?? "normal"}
              onChange={(e) =>
                onUpdate({ blendMode: e.target.value as Track["blendMode"] })
              }
              className="flex-1 bg-neutral-900 border border-neutral-800 rounded text-[10px] text-neutral-200 px-1 py-0.5"
            >
              {BLEND_OPTIONS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
      {(track.kind === "overlay" || track.kind === "audio") && (
        <label className="flex items-baseline gap-1 text-[10px] text-neutral-400">
          <span>start</span>
          <input
            type="number"
            min={0}
            max={600}
            step={0.1}
            value={track.startOffsetSec ?? 0}
            onChange={(e) =>
              onUpdate({ startOffsetSec: Number(e.target.value) })
            }
            className="flex-1 bg-neutral-900 border border-neutral-800 rounded text-[10px] text-neutral-200 px-1 py-0.5"
          />
          <span className="text-neutral-600">s</span>
        </label>
      )}
    </div>
  );
}
