"use client";

import { useEffect, useState } from "react";

type Preview = {
  title: string;
  durationSec: number;
  uploader: string;
  license: string | null;
  hasCaptions: boolean;
  thumbnailUrl: string | null;
  overDurationLimit: boolean;
  maxDurationSec: number;
};

type Action = "save" | "reuse" | "recreate";

// mm:ss ⇄ seconds helpers for the manual in/out fields.
function fmt(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "";
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
function parse(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (trimmed.includes(":")) {
    const [m, s] = trimmed.split(":");
    const mm = Number(m);
    const ss = Number(s);
    if (Number.isFinite(mm) && Number.isFinite(ss)) return mm * 60 + ss;
    return undefined;
  }
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Import a clip from an external video URL into the current project (and/or the
 * personal library). Everything heavy happens server-side; this just gathers the
 * URL, an optional in/out window, and the intended use, then POSTs to the import
 * route. For "Recreate", it hands the imported asset off to the agent via the
 * existing vibeedit:send-prompt event.
 */
export function ImportUrlModal({
  projectId,
  onClose,
  onImported,
}: {
  projectId: string;
  onClose: () => void;
  onImported: () => void;
}) {
  const [url, setUrl] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [startText, setStartText] = useState("");
  const [endText, setEndText] = useState("");
  const [action, setAction] = useState<Action>("recreate");
  const [attested, setAttested] = useState(false);
  const [saveToLibrary, setSaveToLibrary] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [onClose]);

  async function fetchPreview() {
    const trimmed = url.trim();
    if (!trimmed) return;
    setLoadingPreview(true);
    setError(null);
    setPreview(null);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/import/preview?url=${encodeURIComponent(trimmed)}`,
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data?.message || "Couldn't read that link.");
        return;
      }
      setPreview(data as Preview);
    } catch {
      setError("Couldn't reach that link.");
    } finally {
      setLoadingPreview(false);
    }
  }

  async function submit() {
    const trimmed = url.trim();
    if (!trimmed) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/import`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          url: trimmed,
          startSeconds: parse(startText),
          endSeconds: parse(endText),
          action,
          attested,
          saveToLibrary,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.message || "Import failed.");
        return;
      }
      onImported();
      if (action === "recreate" && typeof data.asset === "string") {
        const handle =
          data.asset
            .split("/")
            .pop()
            ?.replace(/\.[^.]+$/, "") ?? "the clip";
        window.dispatchEvent(
          new CustomEvent("vibeedit:send-prompt", {
            detail: {
              text:
                `Recreate the style of the reference clip "${handle}" as an original ` +
                `composition — study its pacing, color grade, typography, and effects, then ` +
                `rebuild it as my own version.`,
            },
          }),
        );
      }
      onClose();
    } catch {
      setError("Import failed.");
    } finally {
      setSubmitting(false);
    }
  }

  const needsAttest = action !== "recreate";

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
    >
      <div
        onClick={(event) => event.stopPropagation()}
        className="animate-scale-in flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-3.5">
          <h2 className="font-semibold text-[var(--color-fg)]">Import from a video URL</h2>
          <button
            onClick={onClose}
            className="text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
            title="Close"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {/* URL row */}
          <div className="flex gap-2">
            <input
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && fetchPreview()}
              placeholder="Paste a YouTube (or other video) link…"
              className="min-w-0 flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-fg)] outline-none focus:border-[var(--color-accent)]"
            />
            <button
              onClick={fetchPreview}
              disabled={loadingPreview || !url.trim()}
              className="rounded-lg bg-[var(--color-accent)] px-3 py-2 text-xs font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {loadingPreview ? "Reading…" : "Preview"}
            </button>
          </div>

          {preview && (
            <div className="flex gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
              {preview.thumbnailUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={preview.thumbnailUrl}
                  alt=""
                  className="h-16 w-28 flex-shrink-0 rounded object-cover"
                />
              )}
              <div className="min-w-0 text-xs">
                <div className="truncate font-semibold text-[var(--color-fg)]">{preview.title}</div>
                <div className="mt-0.5 text-[var(--color-fg-muted)]">
                  {preview.uploader && `${preview.uploader} · `}
                  {fmt(preview.durationSec)}
                  {preview.license ? ` · ${preview.license}` : ""}
                </div>
                {preview.overDurationLimit && (
                  <div className="mt-1 text-[var(--color-danger,#e5484d)]">
                    Over the {Math.round(preview.maxDurationSec / 60)} min limit — set an in/out
                    window below to import a segment.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Manual in/out */}
          <div>
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-fg-subtle)]">
              Trim (optional) — mm:ss
            </div>
            <div className="flex items-center gap-2 text-sm">
              <input
                value={startText}
                onChange={(event) => setStartText(event.target.value)}
                placeholder="start"
                className="w-24 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5 text-[var(--color-fg)] outline-none focus:border-[var(--color-accent)]"
              />
              <span className="text-[var(--color-fg-muted)]">→</span>
              <input
                value={endText}
                onChange={(event) => setEndText(event.target.value)}
                placeholder="end"
                className="w-24 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5 text-[var(--color-fg)] outline-none focus:border-[var(--color-accent)]"
              />
            </div>
          </div>

          {/* What to do */}
          <div>
            <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-fg-subtle)]">
              What do you want to do?
            </div>
            <div className="space-y-1.5">
              {(
                [
                  [
                    "recreate",
                    "Recreate the style",
                    "AI builds an original version — no source footage is re-hosted.",
                  ],
                  [
                    "reuse",
                    "Reuse the footage",
                    "Drop the actual clip into the render (needs rights).",
                  ],
                  ["save", "Just save the clip", "Keep it for later (needs rights)."],
                ] as Array<[Action, string, string]>
              ).map(([value, label, desc]) => (
                <label
                  key={value}
                  className={`flex cursor-pointer gap-2 rounded-lg border px-3 py-2 text-xs ${
                    action === value
                      ? "border-[var(--color-accent)] bg-[var(--color-accent)]/8"
                      : "border-[var(--color-border)]"
                  }`}
                >
                  <input
                    type="radio"
                    name="import-action"
                    checked={action === value}
                    onChange={() => setAction(value)}
                    className="mt-0.5"
                  />
                  <span>
                    <span className="font-semibold text-[var(--color-fg)]">{label}</span>
                    <span className="block text-[var(--color-fg-muted)]">{desc}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          {needsAttest && (
            <label className="flex items-start gap-2 rounded-lg border border-[var(--color-border)] px-3 py-2 text-xs text-[var(--color-fg-muted)]">
              <input
                type="checkbox"
                checked={attested}
                onChange={(event) => setAttested(event.target.checked)}
                className="mt-0.5"
              />
              I own this footage or it's licensed for reuse (e.g. Creative Commons). VibeEdit isn't
              responsible for copyright of imported content.
            </label>
          )}

          <label className="flex items-center gap-2 text-xs text-[var(--color-fg-muted)]">
            <input
              type="checkbox"
              checked={saveToLibrary}
              onChange={(event) => setSaveToLibrary(event.target.checked)}
            />
            Also save to my reference library
          </label>

          {error && <div className="text-xs text-[var(--color-danger,#e5484d)]">{error}</div>}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[var(--color-border)] px-5 py-3">
          <button
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={submitting || !url.trim() || (needsAttest && !attested)}
            className="rounded-lg bg-[var(--color-accent)] px-4 py-1.5 text-xs font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? "Importing…" : action === "recreate" ? "Import & recreate" : "Import"}
          </button>
        </div>
      </div>
    </div>
  );
}
