"use client";

import { useEffect, useState } from "react";

type Snapshot = {
  id: string;
  renderJobId: string | null;
  label: string | null;
  createdAt: string | number;
};

export function HistoryPanel({
  projectId,
  reloadKey,
  onRestored,
}: {
  projectId: string;
  reloadKey: number;
  onRestored: () => void;
}) {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [restoredId, setRestoredId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/projects/${projectId}/snapshots?limit=30`)
      .then((r) => (r.ok ? r.json() : { snapshots: [] }))
      .then((data) => {
        if (!cancelled) {
          setSnapshots((data as { snapshots: Snapshot[] }).snapshots ?? []);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, reloadKey]);

  async function restore(snapshotId: string) {
    if (restoring) return;
    setError(null);
    setRestoring(snapshotId);
    try {
      const res = await fetch(`/api/projects/${projectId}/snapshots`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ snapshotId }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Restore failed");
      }
      setRestoredId(snapshotId);
      // Flash the restored state then clear
      setTimeout(() => setRestoredId(null), 3000);
      // Reload preview — fires the file-change event which the editor listens to
      window.dispatchEvent(new Event("vibeedit:history-restored"));
      onRestored();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRestoring(null);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-2 p-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-14 animate-shimmer rounded-xl bg-[var(--color-bg-2)]" />
        ))}
      </div>
    );
  }

  if (snapshots.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 px-4 py-14 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-[var(--color-fg-muted)]"
            aria-hidden="true"
          >
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
            <path d="M12 7v5l4 2" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-semibold text-[var(--color-fg)]">No snapshots yet</p>
          <p className="mt-1 text-xs leading-snug text-[var(--color-fg-muted)]">
            Snapshots are saved automatically each time you render. Hit{" "}
            <kbd className="rounded bg-[var(--color-bg-2)] px-1 py-0.5 font-mono text-[10px]">
              ⌘R
            </kbd>{" "}
            to create your first one.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="border-b border-[var(--color-border)] px-4 py-3">
        <div className="flex items-center justify-between">
          <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--color-fg-subtle)]">
            Version history
          </span>
          <span className="text-[10px] text-[var(--color-fg-subtle)]">
            {snapshots.length} snapshot{snapshots.length === 1 ? "" : "s"}
          </span>
        </div>
        <p className="mt-1 text-[10px] leading-snug text-[var(--color-fg-subtle)]">
          Restoring overwrites index.html. The current state becomes recoverable from a new render.
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="mx-3 mt-3 rounded-lg border border-[var(--color-danger)]/30 bg-[var(--color-danger)]/8 px-3 py-2 text-xs text-[var(--color-danger)]">
          {error}
        </div>
      )}

      {/* Snapshot list */}
      <ul className="divide-y divide-[var(--color-border)]">
        {snapshots.map((snap, index) => {
          const isRestoring = restoring === snap.id;
          const isRestored = restoredId === snap.id;
          const isLatest = index === 0;
          const ts = new Date(
            typeof snap.createdAt === "number" ? snap.createdAt * 1000 : snap.createdAt,
          );

          return (
            <li
              key={snap.id}
              className={`group flex items-start gap-3 px-4 py-3 transition-colors ${
                isRestored ? "bg-[var(--color-success)]/5" : "hover:bg-[var(--color-surface)]/50"
              }`}
            >
              {/* Timeline dot */}
              <div className="relative mt-1 flex flex-col items-center">
                <div
                  className={`h-2.5 w-2.5 rounded-full border-2 ${
                    isLatest
                      ? "border-[var(--color-accent)] bg-[var(--color-accent)]"
                      : isRestored
                        ? "border-[var(--color-success)] bg-[var(--color-success)]"
                        : "border-[var(--color-border-2)] bg-[var(--color-bg-2)]"
                  }`}
                />
                {/* Connector line */}
                {index < snapshots.length - 1 && (
                  <div
                    className="mt-1 h-full w-px bg-[var(--color-border)]"
                    style={{ minHeight: "24px" }}
                  />
                )}
              </div>

              {/* Content */}
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-[var(--color-fg)]">
                      {snap.label ?? "Snapshot"}
                      {isLatest && (
                        <span className="ml-1.5 rounded-full bg-[var(--color-accent)]/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-[var(--color-accent)]">
                          latest
                        </span>
                      )}
                    </p>
                    <p
                      className="mt-0.5 text-[10px] text-[var(--color-fg-subtle)]"
                      title={ts.toLocaleString()}
                    >
                      {relativeTime(ts)}
                    </p>
                  </div>
                  {/* Restore button — visible on hover or when restoring/restored */}
                  {isLatest ? (
                    <span className="shrink-0 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-[10px] text-[var(--color-fg-subtle)]">
                      current
                    </span>
                  ) : isRestored ? (
                    <span className="flex shrink-0 items-center gap-1 text-[10px] font-medium text-[var(--color-success)]">
                      <svg
                        width="10"
                        height="10"
                        viewBox="0 0 10 10"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        aria-hidden="true"
                      >
                        <path d="M1.5 5.5l2.5 2.5L8.5 2" />
                      </svg>
                      Restored
                    </span>
                  ) : (
                    <button
                      onClick={() => restore(snap.id)}
                      disabled={!!restoring}
                      className="shrink-0 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-[10px] font-medium text-[var(--color-fg-muted)] opacity-0 transition-all hover:border-[var(--color-accent)]/50 hover:text-[var(--color-fg)] disabled:opacity-30 group-hover:opacity-100"
                    >
                      {isRestoring ? (
                        <span className="flex items-center gap-1">
                          <span className="inline-block h-2.5 w-2.5 animate-spin rounded-full border border-[var(--color-border)] border-t-[var(--color-accent)]" />
                          Restoring…
                        </span>
                      ) : (
                        "Restore"
                      )}
                    </button>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {/* Footer hint */}
      <div className="px-4 py-3 text-[9px] text-[var(--color-fg-subtle)]">
        Snapshots are auto-saved on render. Max 30 shown.
      </div>
    </div>
  );
}

function relativeTime(date: Date): string {
  const s = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
