"use client";

import { FileImage, FileVideo, Music, Plus, Trash2, Upload, X } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import type { ProjectUpload } from "@/lib/scene-schema";
import { createId, DEFAULT_BG } from "@/lib/scene-schema";
import { useProjectStore } from "@/store/project-store";

function formatBytes(n: number | undefined): string {
  if (n === undefined || !Number.isFinite(n) || n <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v.toFixed(v >= 100 || i === 0 ? 0 : 1)} ${units[i]}`;
}

/**
 * Per-project upload bin. Drag/drop or click to upload any file (image
 * / video / audio). Files persist server-side via /api/assets/upload
 * and the URL gets tracked on project.uploads so the bin survives page
 * reloads. Tiles are draggable onto the Timeline (handled in Timeline.tsx
 * via dataTransfer "vibeedit/upload-url"); double-click attaches as
 * background of the currently-selected scene.
 */
interface Props {
  /** Legacy fixed-drawer mode (sprint 9). When `inline` is true the
   *  panel renders without the drawer chrome (no fixed positioning, no
   *  header X) so it can mount inside LeftSidebar's tab content. */
  open?: boolean;
  onClose?: () => void;
  inline?: boolean;
}

export function UploadsPanel({ open = true, onClose, inline = false }: Props) {
  const project = useProjectStore((s) => s.project);
  const addUpload = useProjectStore((s) => s.addUpload);
  const removeUpload = useProjectStore((s) => s.removeUpload);
  const updateScene = useProjectStore((s) => s.updateScene);
  const addScene = useProjectStore((s) => s.addScene);
  const selectedSceneId = useProjectStore((s) => s.selectedSceneId);
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDropping, setIsDropping] = useState(false);
  const [uploading, setUploading] = useState(false);

  const uploads = project.uploads ?? [];

  const upload = useCallback(
    async (files: FileList | File[]) => {
      setUploading(true);
      try {
        for (const file of Array.from(files)) {
          if (file.size > 200 * 1024 * 1024) {
            toast.error(`${file.name} too big (>200 MB) — skipped`);
            continue;
          }
          const form = new FormData();
          form.append("file", file);
          const res = await fetch("/api/assets/upload", {
            method: "POST",
            body: form,
          });
          const data = await res.json();
          if (!res.ok) {
            toast.error(`upload failed: ${data.error ?? res.status}`);
            continue;
          }
          const u: ProjectUpload = {
            id: `up-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            name: data.name ?? file.name,
            url: data.url,
            type: data.type ?? file.type,
            bytes: data.bytes ?? file.size,
            uploadedAt: Date.now(),
          };
          addUpload(u);
        }
      } finally {
        setUploading(false);
      }
    },
    [addUpload],
  );

  const onPickFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) upload(e.target.files);
    e.target.value = "";
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDropping(false);
    if (e.dataTransfer.files.length > 0) upload(e.dataTransfer.files);
  };

  const attachToSelected = (u: ProjectUpload) => {
    if (!selectedSceneId) {
      toast("Select a scene first", { description: "Click a scene in the list, then double-click an upload to attach." });
      return;
    }
    if (u.type?.startsWith("video/")) {
      updateScene(selectedSceneId, {
        background: { ...(project.scenes.find((s) => s.id === selectedSceneId)?.background ?? { color: "#000" }), videoUrl: u.url },
      });
    } else {
      updateScene(selectedSceneId, {
        background: { ...(project.scenes.find((s) => s.id === selectedSceneId)?.background ?? { color: "#000" }), imageUrl: u.url, kenBurns: true },
      });
    }
    toast(`Attached to scene · ${u.name.slice(0, 40)}`);
  };

  const insertAsScene = (u: ProjectUpload) => {
    const portrait = project.height > project.width;
    const isVideo = u.type?.startsWith("video/");
    const scene = isVideo
      ? {
          id: createId(),
          type: "text_only" as const,
          duration: 3,
          background: { ...DEFAULT_BG, videoUrl: u.url },
          transition: "beat_flash" as const,
        }
      : {
          id: createId(),
          type: "text_only" as const,
          duration: 3,
          background: { ...DEFAULT_BG, imageUrl: u.url, kenBurns: true },
          emphasisText: "edit me",
          emphasisSize: portrait ? 96 : 72,
          emphasisColor: "#ffffff",
          textY: portrait ? 500 : 380,
          transition: "beat_flash" as const,
        };
    addScene(scene);
    toast(`Inserted scene · ${u.name.slice(0, 40)}`);
  };

  if (!open) return null;

  const wrapperClass = inline
    ? "h-full w-full bg-neutral-950 flex flex-col"
    : "fixed top-0 right-0 bottom-0 w-80 bg-neutral-950 border-l border-neutral-800 z-40 flex flex-col shadow-2xl";

  return (
    <div className={wrapperClass}>
      {!inline && (
        <div className="flex items-center justify-between px-3 py-2 border-b border-neutral-800">
          <div className="flex items-center gap-2">
            <Upload className="h-4 w-4 text-emerald-400" />
            <h2 className="text-sm font-semibold text-white">Uploads</h2>
            <span className="text-[10px] text-neutral-500">{uploads.length}</span>
          </div>
          <button onClick={onClose} className="text-neutral-500 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDropping(true);
        }}
        onDragLeave={() => setIsDropping(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`m-3 flex flex-col items-center justify-center gap-2 h-28 border-2 border-dashed rounded cursor-pointer transition-colors ${
          isDropping
            ? "border-emerald-400 bg-emerald-500/10"
            : "border-neutral-800 hover:border-emerald-500/60 hover:bg-emerald-500/5"
        }`}
      >
        <Upload className="h-5 w-5 text-neutral-500" />
        <div className="text-center">
          <div className="text-xs text-neutral-300">Drop files or click</div>
          <div className="text-[10px] text-neutral-600">images / video / audio · 200 MB max</div>
        </div>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={onPickFiles}
        />
      </div>
      {uploading && (
        <div className="px-3 py-1 text-[10px] text-emerald-400">uploading…</div>
      )}

      <div className="flex-1 overflow-y-auto px-3 pb-3">
        {uploads.length === 0 ? (
          <div className="text-center text-[11px] text-neutral-600 py-6">
            No uploads yet. Drop something above.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {uploads
              .slice()
              .reverse()
              .map((u) => {
                const isImage = (u.type ?? "").startsWith("image/");
                const isVideo = (u.type ?? "").startsWith("video/");
                const isAudio = (u.type ?? "").startsWith("audio/");
                return (
                  <div
                    key={u.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("vibeedit/upload-url", u.url);
                      e.dataTransfer.setData("vibeedit/upload-type", u.type ?? "");
                      e.dataTransfer.setData("text/plain", u.url);
                      e.dataTransfer.effectAllowed = "copy";
                    }}
                    onDoubleClick={() => attachToSelected(u)}
                    title={`${u.name}\n${formatBytes(u.bytes)} · ${u.type ?? "?"}\nUploaded ${new Date(u.uploadedAt).toLocaleString()}\n\nClick + → insert as new scene\nDouble-click → attach to selected scene\nDrag onto timeline → insert as a new scene`}
                    className="group relative rounded border border-neutral-800 bg-neutral-900 overflow-hidden hover:border-emerald-500/60 cursor-grab active:cursor-grabbing"
                  >
                    {isImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={u.url}
                        alt={u.name}
                        className="w-full h-20 object-cover"
                        draggable={false}
                      />
                    ) : (
                      <div className="w-full h-20 flex items-center justify-center bg-neutral-800">
                        {isVideo ? (
                          <FileVideo className="h-6 w-6 text-neutral-400" />
                        ) : isAudio ? (
                          <Music className="h-6 w-6 text-neutral-400" />
                        ) : (
                          <FileImage className="h-6 w-6 text-neutral-400" />
                        )}
                      </div>
                    )}
                    <div className="px-1.5 py-1 text-[10px] text-neutral-300 truncate">
                      {u.name}
                    </div>
                    <div className="px-1.5 pb-1 text-[9px] text-neutral-500 font-mono">
                      {formatBytes(u.bytes)}
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        insertAsScene(u);
                      }}
                      title="Insert as a new scene at the end of the timeline"
                      className="absolute top-1 left-1 p-1 rounded bg-emerald-500 text-black opacity-0 group-hover:opacity-100 hover:bg-emerald-400 transition-opacity"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeUpload(u.id);
                      }}
                      title="Remove from bin (file stays on disk)"
                      className="absolute top-1 right-1 p-1 rounded bg-neutral-950/80 text-neutral-500 opacity-0 group-hover:opacity-100 hover:text-red-400 transition-opacity"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                );
              })}
          </div>
        )}
      </div>
    </div>
  );
}
