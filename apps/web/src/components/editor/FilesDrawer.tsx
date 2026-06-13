"use client";

import { useEffect, useState } from "react";
import { VariablesPanel } from "./VariablesPanel";

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|svg)$/i;
const VIDEO_EXT = /\.(mp4|webm|mov)$/i;
const AUDIO_EXT = /\.(mp3|wav|ogg|aac|m4a)$/i;

type AssetFilter = "all" | "image" | "video" | "audio";

export function FilesDrawer({ projectId, reloadKey }: { projectId: string; reloadKey: number }) {
  const [files, setFiles] = useState<string[]>([]);
  const [bgRemoving, setBgRemoving] = useState<string | null>(null);
  const [bgError, setBgError] = useState<string | null>(null);
  const [bgTarget, setBgTarget] = useState<string | null>(null);
  const [assetFilter, setAssetFilter] = useState<AssetFilter>("all");
  const [assetSearch, setAssetSearch] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/projects/${projectId}`)
      .then((r) => (r.ok ? r.json() : { files: [] }))
      .then((j) => {
        if (!cancelled) setFiles(j.files || []);
      })
      .catch(() => {
        if (!cancelled) setFiles([]);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, reloadKey]);

  async function upload(event: React.ChangeEvent<HTMLInputElement>) {
    const fileList = event.target.files;
    if (!fileList || fileList.length === 0) return;
    setUploadError(null);
    setUploading(true);
    const form = new FormData();
    for (const f of Array.from(fileList)) form.append("file", f);
    try {
      const res = await fetch(`/api/projects/${projectId}/upload`, {
        method: "POST",
        body: form,
      });
      if (!res.ok) {
        // 413 is the common one on mobile: phone video/audio exceeds the
        // server (or reverse-proxy) body limit. Surface it instead of failing
        // silently, which previously made uploads look like a no-op.
        throw new Error(
          res.status === 413
            ? "File too large to upload. Try a shorter or compressed clip."
            : `Upload failed (${res.status}). Please try again.`,
        );
      }
      // Refresh the asset list so newly uploaded files appear immediately —
      // the parent's reloadKey only bumps on agent edits, not uploads.
      const refresh = await fetch(`/api/projects/${projectId}`);
      if (refresh.ok) {
        const j = await refresh.json();
        setFiles(j.files || []);
      }
    } catch (err) {
      setUploadError((err as Error).message.slice(0, 200));
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  }

  function editInChat(path: string) {
    // Hand the path off to Chat.tsx. The chat listener pre-fills the input
    // with an instruction referencing this asset, then focuses the textarea.
    window.dispatchEvent(new CustomEvent("vibeedit:edit-asset", { detail: { path } }));
  }

  function playAsset(path: string) {
    // Open the raw asset in a new tab — browsers handle image/video/audio
    // natively, so this is the simplest "play" without a custom lightbox.
    const url = `/api/projects/${projectId}/files/${path}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  async function removeBackground(path: string) {
    if (bgRemoving) return;
    setBgError(null);
    setBgRemoving(path);
    try {
      const sourceUrl = `/api/projects/${projectId}/files/${path}`;
      const sourceResponse = await fetch(sourceUrl);
      if (!sourceResponse.ok) throw new Error("could not read source image");
      const sourceBlob = await sourceResponse.blob();
      const { removeBackground: run } = await import("@imgly/background-removal");
      const resultBlob = await run(sourceBlob);
      const baseName =
        path
          .split("/")
          .pop()
          ?.replace(/\.[^.]+$/, "") || "image";
      const outName = `${baseName}-nobg.png`;
      const form = new FormData();
      form.append("file", new File([resultBlob], outName, { type: "image/png" }));
      const upResponse = await fetch(`/api/projects/${projectId}/upload`, {
        method: "POST",
        body: form,
      });
      if (!upResponse.ok) throw new Error("upload failed");
      const nextResponse = await fetch(`/api/projects/${projectId}`);
      if (!nextResponse.ok) throw new Error("refresh failed");
      const next = await nextResponse.json();
      setFiles(next.files || []);
    } catch (error) {
      setBgError((error as Error).message.slice(0, 200));
    } finally {
      setBgRemoving(null);
      setBgTarget(null);
    }
  }

  const allAssets = files.filter((p) => p.startsWith("assets/"));

  const filteredAssets = allAssets.filter((p) => {
    if (assetSearch) {
      const name = p.split("/").pop() ?? "";
      if (!name.toLowerCase().includes(assetSearch.toLowerCase())) return false;
    }
    if (assetFilter === "image") return IMAGE_EXT.test(p);
    if (assetFilter === "video") return VIDEO_EXT.test(p);
    if (assetFilter === "audio") return AUDIO_EXT.test(p);
    return true;
  });

  const FILTER_LABELS: Array<{ id: AssetFilter; label: string }> = [
    { id: "all", label: "All" },
    { id: "image", label: "Images" },
    { id: "video", label: "Video" },
    { id: "audio", label: "Audio" },
  ];

  return (
    <div className="flex h-full flex-col">
      <VariablesPanel projectId={projectId} reloadKey={reloadKey} />

      <div className="border-b border-[var(--color-border)] p-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--color-fg-subtle)]">
            Assets
          </span>
          <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1 text-[10px] font-medium text-[var(--color-fg-muted)] transition-colors hover:border-[var(--color-accent)]/50 hover:text-[var(--color-fg)]">
            {uploading && (
              <span className="inline-block h-2.5 w-2.5 animate-spin rounded-full border border-[var(--color-fg-subtle)] border-t-[var(--color-fg)]" />
            )}
            {uploading ? "Uploading…" : "+ Upload"}
            <input
              type="file"
              multiple
              accept="image/*,video/*,audio/*"
              disabled={uploading}
              className="hidden"
              onChange={upload}
            />
          </label>
        </div>

        {uploadError && (
          <p className="mb-2 text-[10px] text-[var(--color-danger)]">{uploadError}</p>
        )}

        {allAssets.length > 0 && (
          <>
            <div className="mb-2 flex gap-1">
              {FILTER_LABELS.map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => setAssetFilter(id)}
                  className={`rounded-md px-2 py-1 text-[10px] font-medium transition-colors ${
                    assetFilter === id
                      ? "bg-[var(--color-accent)] text-black"
                      : "bg-[var(--color-surface)] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <input
              type="text"
              value={assetSearch}
              onChange={(e) => setAssetSearch(e.target.value)}
              placeholder="Search assets…"
              className="mb-3 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-2)] px-2.5 py-1.5 text-[11px] outline-none placeholder:text-[var(--color-fg-subtle)] focus:border-[var(--color-accent)]"
            />
          </>
        )}

        {allAssets.length === 0 ? (
          <label className="block cursor-pointer rounded-xl border border-dashed border-[var(--color-border)] px-3 py-8 text-center transition-colors hover:border-[var(--color-accent)]/30 hover:bg-[var(--color-surface)]">
            <div className="mb-2 flex justify-center text-[var(--color-fg-subtle)]">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </div>
            <p className="text-[11px] text-[var(--color-fg-muted)]">
              {uploading ? "Uploading…" : "Tap to add image, video, or audio"}
            </p>
            <input
              type="file"
              multiple
              accept="image/*,video/*,audio/*"
              disabled={uploading}
              className="hidden"
              onChange={upload}
            />
          </label>
        ) : filteredAssets.length === 0 ? (
          <p className="py-4 text-center text-[11px] text-[var(--color-fg-muted)]">
            No assets match this filter.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {filteredAssets.map((path) => (
              <AssetTile
                key={path}
                path={path}
                projectId={projectId}
                onPlay={() => playAsset(path)}
                onEdit={() => editInChat(path)}
                onCopyUrl={() => {
                  navigator.clipboard
                    .writeText(`assets/${path.replace(/^assets\//, "")}`)
                    .catch(() => {});
                }}
                onRemoveBg={() => {
                  setBgTarget(path);
                  removeBackground(path);
                }}
                removingBg={bgRemoving === path}
              />
            ))}
          </div>
        )}
        {bgError && <p className="mt-2 text-[10px] text-[var(--color-danger)]">{bgError}</p>}
        {bgTarget && bgRemoving && (
          <p className="mt-2 text-[10px] text-[var(--color-fg-muted)]">
            Removing background… (first run ~30MB download)
          </p>
        )}
      </div>

      {/* Quick composition edit shortcut */}
      <div className="border-b border-[var(--color-border)] p-4">
        <button
          onClick={() =>
            window.dispatchEvent(
              new CustomEvent("vibeedit:edit-asset", { detail: { path: "the composition" } }),
            )
          }
          className="flex w-full items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5 text-left text-xs transition-colors hover:border-[var(--color-accent)]/40 hover:bg-[var(--color-surface-2)]"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-[var(--color-accent)] shrink-0"
            aria-hidden="true"
          >
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
          <span className="font-medium text-[var(--color-fg)]">Edit the composition</span>
          <span className="text-[var(--color-fg-subtle)]">→ chat</span>
        </button>
      </div>

      <div className="flex-1" />
    </div>
  );
}

function AssetTile({
  path,
  projectId,
  onPlay,
  onEdit,
  onCopyUrl,
  onRemoveBg,
  removingBg,
}: {
  path: string;
  projectId: string;
  onPlay: () => void;
  onEdit: () => void;
  onCopyUrl: () => void;
  onRemoveBg: () => void;
  removingBg: boolean;
}) {
  const url = `/api/projects/${projectId}/files/${path}`;
  const thumbUrl = `/api/projects/${projectId}/asset-thumb?path=${encodeURIComponent(path)}`;
  const isImage = IMAGE_EXT.test(path);
  const isVideo = VIDEO_EXT.test(path);
  const isAudio = AUDIO_EXT.test(path);
  const filename = path.split("/").pop() || path;

  return (
    <div
      title={filename}
      className="group relative aspect-square overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-2)] transition-all hover:border-[var(--color-border-2)]"
    >
      {isImage ? (
        <img src={url} alt={filename} className="h-full w-full object-cover" />
      ) : isVideo || isAudio ? (
        <img src={thumbUrl} alt={filename} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center font-mono text-xs text-[var(--color-fg-muted)]">
          .{path.split(".").pop()}
        </div>
      )}

      {(isVideo || isAudio) && (
        <span className="pointer-events-none absolute bottom-1.5 left-1.5 rounded-md bg-black/70 px-1.5 py-0.5 text-[9px] font-medium text-white backdrop-blur-sm">
          {isVideo ? "video" : "audio"}
        </span>
      )}

      <div className="pointer-events-none absolute inset-0 flex items-center justify-center gap-1.5 bg-black/60 opacity-0 backdrop-blur-[2px] transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
        <button
          onClick={onPlay}
          title="Open"
          className="pointer-events-auto flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-accent)] text-black shadow-lg transition-transform hover:scale-105"
        >
          <svg width="10" height="12" viewBox="0 0 10 12" fill="currentColor" aria-hidden="true">
            <polygon points="0,0 10,6 0,12" />
          </svg>
        </button>
        <button
          onClick={onEdit}
          title="Edit in chat"
          className="pointer-events-auto flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-black shadow-lg transition-transform hover:scale-105"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
        </button>
        <button
          onClick={onCopyUrl}
          title="Copy asset path"
          className="pointer-events-auto flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-white shadow-lg backdrop-blur-sm transition-transform hover:scale-105"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
        </button>
        {isImage && (
          <button
            onClick={onRemoveBg}
            disabled={removingBg}
            title="Remove background"
            className="pointer-events-auto flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-white shadow-lg backdrop-blur-sm transition-transform hover:scale-105 disabled:opacity-50"
          >
            {removingBg ? (
              <span className="inline-block h-3 w-3 animate-spin rounded-full border border-white/30 border-t-white" />
            ) : (
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <circle cx="6" cy="6" r="3" />
                <circle cx="6" cy="18" r="3" />
                <path d="M20 4L8.12 15.88M14.47 14.48L20 20M8.12 8.12L12 12" />
              </svg>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
