"use client";

import { useEffect, useState } from "react";
import { isNoiseAsset, type AssetSource } from "@/lib/asset-actions";
import { AssetEditMenu, SourceBadge } from "./AssetEditMenu";

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|svg)$/i;
const VIDEO_EXT = /\.(mp4|webm|mov|m4v)$/i;
const AUDIO_EXT = /\.(mp3|wav|ogg|aac|m4a)$/i;

type AssetFilter = "all" | "image" | "video" | "audio";
type SourceFilter = "all" | "upload" | "ai";

const FILTER_LABELS: Array<{ id: AssetFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "image", label: "Images" },
  { id: "video", label: "Video" },
  { id: "audio", label: "Audio" },
];

const SOURCE_LABELS: Array<{ id: SourceFilter; label: string }> = [
  { id: "all", label: "Any" },
  { id: "upload", label: "Uploads" },
  { id: "ai", label: "AI" },
];

type Character = {
  name: string;
  description: string;
  hasBase: boolean;
};

// A composer-side file browser: see every uploaded asset, attach an existing
// one to the current message, upload new ones, or delete files you no longer
// need. Deleting an asset still referenced by the composition asks for an
// explicit confirm so a video isn't silently broken.
export function AssetPickerModal({
  projectId,
  attached,
  onToggleAttach,
  onDetach,
  onClose,
}: {
  projectId: string;
  attached: string[];
  onToggleAttach: (path: string) => void;
  onDetach: (path: string) => void;
  onClose: () => void;
}) {
  const [files, setFiles] = useState<string[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [assetMeta, setAssetMeta] = useState<Record<string, AssetSource>>({});
  const [referenced, setReferenced] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<AssetFilter>("all");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [search, setSearch] = useState("");
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const res = await fetch(`/api/projects/${projectId}`);
      const data = res.ok ? await res.json() : { files: [] };
      const list: string[] = Array.isArray(data?.files) ? data.files : [];
      setFiles(list.filter((p) => p.startsWith("assets/") && !isNoiseAsset(p)));
      setAssetMeta(data?.assetMeta || {});
    } catch {
      setFiles([]);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // Characters are account-level — reusable across projects — so load once.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/characters")
      .then((r) => (r.ok ? r.json() : { characters: [] }))
      .then((j) => {
        if (!cancelled) setCharacters(Array.isArray(j.characters) ? j.characters : []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  function useCharacter(name: string) {
    window.dispatchEvent(
      new CustomEvent("vibeedit:send-prompt", {
        detail: { text: `Use my character "${name}" in this video.` },
      }),
    );
    onClose();
  }

  // Work out which assets the current composition references, so we can warn
  // before deleting one. Best-effort: recomputed whenever the file list changes.
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/projects/${projectId}/file?path=index.html`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        const content: string = data.content ?? "";
        const refs = new Set<string>();
        for (const p of files) {
          const name = p.split("/").pop() ?? "";
          if (content.includes(p) || (name && content.includes(name))) refs.add(p);
        }
        setReferenced(refs);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [files, projectId]);

  useEffect(() => {
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [onClose]);

  async function upload(event: React.ChangeEvent<HTMLInputElement>) {
    const fileList = event.target.files;
    if (!fileList || fileList.length === 0) return;
    setError(null);
    setUploading(true);
    const form = new FormData();
    for (const f of Array.from(fileList)) form.append("file", f);
    try {
      const res = await fetch(`/api/projects/${projectId}/upload`, { method: "POST", body: form });
      if (!res.ok) {
        throw new Error(
          res.status === 413
            ? "File too large to upload. Try a shorter or compressed clip."
            : `Upload failed (${res.status}).`,
        );
      }
      const data = (await res.json()) as { uploaded?: string[] };
      // Auto-attach freshly uploaded assets so they're ready to send.
      for (const p of data.uploaded || []) {
        if (p.startsWith("assets/") && !attached.includes(p)) onToggleAttach(p);
      }
      await load();
    } catch (err) {
      setError((err as Error).message.slice(0, 200));
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  }

  async function remove(path: string) {
    if (deleting) return;
    const name = path.replace(/^assets\//, "");
    const isReferenced = referenced.has(path);
    const message = isReferenced
      ? `"${name}" is still used by your composition. Deleting it will break the video until you remove or replace that reference. Delete anyway?`
      : `Delete "${name}"? This can't be undone.`;
    if (!window.confirm(message)) return;
    setError(null);
    setDeleting(path);
    try {
      const res = await fetch(`/api/projects/${projectId}/file?path=${encodeURIComponent(path)}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(`Delete failed (${res.status}).`);
      if (attached.includes(path)) onDetach(path);
      await load();
    } catch (err) {
      setError((err as Error).message.slice(0, 200));
    } finally {
      setDeleting(null);
    }
  }

  const filtered = files.filter((p) => {
    if (search) {
      const name = p.split("/").pop() ?? "";
      if (!name.toLowerCase().includes(search.toLowerCase())) return false;
    }
    if (sourceFilter !== "all" && (assetMeta[p] ?? "upload") !== sourceFilter) return false;
    if (filter === "image") return IMAGE_EXT.test(p);
    if (filter === "video") return VIDEO_EXT.test(p);
    if (filter === "audio") return AUDIO_EXT.test(p);
    return true;
  });

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="animate-scale-in flex max-h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-3.5">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-[var(--color-fg)]">Your files</h2>
            <span className="text-xs text-[var(--color-fg-muted)]">
              {files.length} asset{files.length === 1 ? "" : "s"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <label className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-[var(--color-accent)] px-3 py-1.5 text-xs font-semibold text-black transition-opacity hover:opacity-90">
              {uploading && (
                <span className="inline-block h-3 w-3 animate-spin rounded-full border border-black/30 border-t-black" />
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
            <button
              onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--color-fg-muted)] hover:bg-[var(--color-bg-2)] hover:text-[var(--color-fg)]"
              aria-label="Close"
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 12 12"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M1 1l10 10M11 1L1 11" />
              </svg>
            </button>
          </div>
        </div>

        {/* Filters */}
        {files.length > 0 && (
          <div className="flex items-center gap-2 border-b border-[var(--color-border)] px-5 py-2.5">
            <div className="flex flex-wrap items-center gap-1">
              {FILTER_LABELS.map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => setFilter(id)}
                  className={`rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
                    filter === id
                      ? "bg-[var(--color-accent)] text-black"
                      : "bg-[var(--color-bg-2)] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
                  }`}
                >
                  {label}
                </button>
              ))}
              <span className="mx-0.5 h-4 w-px bg-[var(--color-border)]" />
              {SOURCE_LABELS.map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => setSourceFilter(id)}
                  className={`rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
                    sourceFilter === id
                      ? "bg-[var(--color-accent)] text-black"
                      : "bg-[var(--color-bg-2)] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search…"
              className="ml-auto w-40 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-2)] px-2.5 py-1.5 text-[11px] outline-none placeholder:text-[var(--color-fg-subtle)] focus:border-[var(--color-accent)]"
            />
          </div>
        )}

        {error && <p className="px-5 pt-3 text-xs text-[var(--color-danger)]">{error}</p>}

        {/* Characters — account-level reusable character, click to have the AI use it */}
        <div className="border-b border-[var(--color-border)] px-5 py-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--color-fg-subtle)]">
            Characters
          </p>
          {characters.length === 0 ? (
            <p className="text-[11px] text-[var(--color-fg-muted)]">
              No character yet — ask the AI to generate one.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {characters.map((c) => (
                <button
                  key={c.name}
                  onClick={() => useCharacter(c.name)}
                  title={`Use "${c.name}" in this video`}
                  className="group flex items-center gap-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-2)] p-2 pr-3 text-left transition-colors hover:border-[var(--color-accent)]/50"
                >
                  <span className="relative h-9 w-9 shrink-0 overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
                    {c.hasBase ? (
                      <img
                        src="/api/characters/image?file=base.png"
                        alt={c.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-[var(--color-fg-subtle)]">
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <circle cx="12" cy="8" r="4" />
                          <path d="M4 21v-1a7 7 0 0 1 14 0v1" />
                        </svg>
                      </span>
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="block max-w-[160px] truncate text-xs font-medium text-[var(--color-fg)]">
                      {c.name}
                    </span>
                    {c.description && (
                      <span className="block max-w-[160px] truncate text-[10px] text-[var(--color-fg-muted)]">
                        {c.description}
                      </span>
                    )}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Grid */}
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {files.length === 0 ? (
            <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-[var(--color-border)] py-16 text-center transition-colors hover:border-[var(--color-accent)]/40 hover:bg-[var(--color-bg-2)]">
              <p className="text-sm text-[var(--color-fg-muted)]">
                {uploading ? "Uploading…" : "No files yet — upload an image, video, or audio clip"}
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
          ) : filtered.length === 0 ? (
            <p className="py-12 text-center text-sm text-[var(--color-fg-muted)]">
              No files match this filter.
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
              {filtered.map((path) => (
                <AssetCard
                  key={path}
                  path={path}
                  projectId={projectId}
                  source={assetMeta[path] ?? "upload"}
                  selected={attached.includes(path)}
                  referenced={referenced.has(path)}
                  deleting={deleting === path}
                  onToggle={() => onToggleAttach(path)}
                  onDelete={() => remove(path)}
                  onClose={onClose}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-[var(--color-border)] px-5 py-3">
          <span className="text-xs text-[var(--color-fg-muted)]">
            {attached.length > 0
              ? `${attached.length} attached to your message`
              : "Click a file to attach it to your message"}
          </span>
          <button
            onClick={onClose}
            className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-xs font-semibold text-black transition-opacity hover:opacity-90"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

function AssetCard({
  path,
  projectId,
  source,
  selected,
  referenced,
  deleting,
  onToggle,
  onDelete,
  onClose,
}: {
  path: string;
  projectId: string;
  source: AssetSource;
  selected: boolean;
  referenced: boolean;
  deleting: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const isImage = IMAGE_EXT.test(path);
  const isVideo = VIDEO_EXT.test(path);
  const isAudio = AUDIO_EXT.test(path);
  const url = `/api/projects/${projectId}/files/${path}`;
  const thumbUrl = `/api/projects/${projectId}/asset-thumb?path=${encodeURIComponent(path)}`;
  const filename = path.split("/").pop() || path;

  return (
    <div className="group flex flex-col gap-1">
      <button
        onClick={onToggle}
        title={selected ? "Click to detach" : "Click to attach to your message"}
        className={`relative aspect-square overflow-hidden rounded-xl border-2 bg-[var(--color-bg-2)] transition-all ${
          selected
            ? "border-[var(--color-accent)] ring-2 ring-[var(--color-accent)]/40"
            : "border-[var(--color-border)] hover:border-[var(--color-border-2)]"
        }`}
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

        <span className="pointer-events-none absolute bottom-1 left-1 flex items-center gap-1">
          <SourceBadge source={source} />
          {(isVideo || isAudio) && (
            <span className="rounded bg-black/70 px-1.5 py-0.5 text-[9px] font-medium text-white">
              {isVideo ? "video" : "audio"}
            </span>
          )}
        </span>

        {selected && (
          <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-accent)] text-black shadow">
            <svg
              width="11"
              height="11"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </span>
        )}

        {referenced && !selected && (
          <span
            title="Used by your composition"
            className="absolute left-1 top-1 rounded bg-black/70 px-1 py-0.5 text-[8px] font-semibold uppercase tracking-wide text-[var(--color-accent)]"
          >
            in use
          </span>
        )}
      </button>

      <div className="flex items-center gap-1">
        <span
          className="min-w-0 flex-1 truncate text-[10px] text-[var(--color-fg-muted)]"
          title={filename}
        >
          {filename}
        </span>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          title="Open"
          className="shrink-0 text-[var(--color-fg-subtle)] transition-colors hover:text-[var(--color-fg)]"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polygon points="5 3 19 12 5 21" />
          </svg>
        </a>
        <AssetEditMenu path={path} onFired={onClose} />
        <button
          onClick={onDelete}
          disabled={deleting}
          title="Delete file"
          className="shrink-0 text-[var(--color-fg-subtle)] transition-colors hover:text-[var(--color-danger)] disabled:opacity-50"
        >
          {deleting ? (
            <span className="inline-block h-3 w-3 animate-spin rounded-full border border-[var(--color-border)] border-t-[var(--color-danger)]" />
          ) : (
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}
