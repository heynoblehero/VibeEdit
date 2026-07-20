"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useToast } from "@/components/Toast";
import type { AssetKind, AssetSource } from "@/lib/asset-actions";
import { useSession } from "@/lib/auth-client";

type StorageFile = {
  path: string;
  name: string;
  bytes: number;
  mtimeMs: number;
  source: AssetSource;
  kind: AssetKind;
};

type StorageProject = {
  id: string;
  name: string;
  updatedAt: number;
  bytes: number;
  files: StorageFile[];
};

type StorageFilesResponse = {
  projects: StorageProject[];
  usedBytes: number;
  limitBytes: number;
  fraction: number;
};

type SourceFilter = "all" | "upload" | "ai";

function formatSize(bytes: number): string {
  if (bytes <= 0) return "0 MB";
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) return `${gb.toFixed(2)} GB`;
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(0)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}

export default function StoragePage() {
  const router = useRouter();
  const toast = useToast();
  const { data: session, isPending } = useSession();
  const [data, setData] = useState<StorageFilesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [deleting, setDeleting] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!isPending && !session) router.replace("/app/login");
  }, [isPending, session, router]);

  useEffect(() => {
    if (!session) return;
    fetch("/api/storage/files")
      .then((response) => (response.ok ? response.json() : null))
      .then((value) => value && setData(value as StorageFilesResponse))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [session]);

  const unlimited = !data || data.limitBytes < 0;
  const pct = data && data.limitBytes > 0 ? Math.round(data.fraction * 100) : 0;
  const near = pct >= 80;

  const filtered = useMemo(() => {
    if (!data) return [];
    const term = search.trim().toLowerCase();
    return data.projects
      .map((project) => {
        const files = project.files.filter((file) => {
          if (sourceFilter !== "all" && file.source !== sourceFilter) return false;
          if (term && !file.name.toLowerCase().includes(term)) return false;
          return true;
        });
        return { ...project, files };
      })
      .filter((project) => project.files.length > 0);
  }, [data, sourceFilter, search]);

  async function remove(projectId: string, file: StorageFile) {
    if (
      !window.confirm(
        `Delete "${file.name}"? This frees ${formatSize(file.bytes)} but a project that still uses this file may break.`,
      )
    ) {
      return;
    }
    const key = `${projectId}/${file.path}`;
    setDeleting((prev) => new Set(prev).add(key));
    try {
      const response = await fetch(
        `/api/projects/${projectId}/file?path=${encodeURIComponent(file.path)}`,
        { method: "DELETE" },
      );
      if (!response.ok) throw new Error(await response.text());
      // Optimistically drop the row and adjust totals so the header stays honest.
      setData((prev) => {
        if (!prev) return prev;
        const projects = prev.projects
          .map((project) =>
            project.id === projectId
              ? {
                  ...project,
                  bytes: project.bytes - file.bytes,
                  files: project.files.filter((f) => f.path !== file.path),
                }
              : project,
          )
          .filter((project) => project.files.length > 0);
        const usedBytes = Math.max(0, prev.usedBytes - file.bytes);
        const fraction =
          prev.limitBytes > 0 ? Math.min(1, usedBytes / prev.limitBytes) : prev.fraction;
        return { ...prev, projects, usedBytes, fraction };
      });
      toast.success(`Freed ${formatSize(file.bytes)}`);
    } catch {
      toast.error("Couldn't delete that file");
    } finally {
      setDeleting((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  }

  if (isPending || !session) {
    return (
      <main className="flex min-h-screen items-center justify-center text-[var(--color-fg-muted)]">
        Loading…
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl p-4 sm:p-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--color-fg)]">Storage</h1>
        <p className="mt-1 text-sm text-[var(--color-fg-muted)]">
          Browse the files stored across your projects and delete ones you no longer need to free up
          space.
        </p>
      </header>

      {/* Usage meter */}
      <section className="mb-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-2)] p-4">
        {!data ? (
          <p className="text-sm text-[var(--color-fg-muted)]">
            {loading ? "Loading…" : "Couldn't load storage."}
          </p>
        ) : (
          <>
            <div className="mb-1 flex items-baseline justify-between text-sm">
              <span className="font-medium">
                {formatSize(data.usedBytes)}{" "}
                <span className="text-[var(--color-fg-muted)]">
                  of {unlimited ? "unlimited" : formatSize(data.limitBytes)}
                </span>
              </span>
              {!unlimited && (
                <span
                  className={`text-xs ${near ? "text-[var(--color-danger)]" : "text-[var(--color-fg-muted)]"}`}
                >
                  {pct}% used
                </span>
              )}
            </div>
            {!unlimited && (
              <div className="h-2 overflow-hidden rounded-full bg-[var(--color-bg)]">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.min(100, pct)}%`,
                    backgroundColor: near ? "var(--color-danger)" : "var(--color-accent)",
                  }}
                />
              </div>
            )}
          </>
        )}
      </section>

      {/* Filters */}
      {data && data.projects.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-[var(--color-border)] p-0.5 text-xs">
            {(["all", "upload", "ai"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setSourceFilter(value)}
                className={`rounded-md px-3 py-1.5 font-medium capitalize transition-colors ${
                  sourceFilter === value
                    ? "bg-[var(--color-accent)] text-black"
                    : "text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
                }`}
              >
                {value === "ai" ? "AI" : value}
              </button>
            ))}
          </div>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search filenames…"
            className="min-w-0 flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-2)] px-3 py-1.5 text-sm text-[var(--color-fg)] placeholder:text-[var(--color-fg-subtle)] focus:border-[var(--color-accent)] focus:outline-none"
          />
        </div>
      )}

      {/* File list, grouped by project */}
      {!data || data.projects.length === 0 ? (
        !loading && (
          <p className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-2)] p-8 text-center text-sm text-[var(--color-fg-muted)]">
            No stored assets yet.
          </p>
        )
      ) : filtered.length === 0 ? (
        <p className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-2)] p-8 text-center text-sm text-[var(--color-fg-muted)]">
          No files match this filter.
        </p>
      ) : (
        <div className="space-y-4">
          {filtered.map((project) => {
            const isCollapsed = collapsed[project.id];
            return (
              <section
                key={project.id}
                className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-2)]"
              >
                <div className="flex items-center justify-between gap-3 px-4 py-3">
                  <button
                    type="button"
                    onClick={() =>
                      setCollapsed((prev) => ({
                        ...prev,
                        [project.id]: !prev[project.id],
                      }))
                    }
                    className="flex min-w-0 items-center gap-2 text-left"
                  >
                    <span
                      className={`text-[var(--color-fg-muted)] transition-transform ${isCollapsed ? "" : "rotate-90"}`}
                      aria-hidden="true"
                    >
                      ▶
                    </span>
                    <span className="truncate text-sm font-semibold text-[var(--color-fg)]">
                      {project.name || "Untitled"}
                    </span>
                    <span className="shrink-0 text-xs text-[var(--color-fg-muted)]">
                      {formatSize(project.bytes)}
                    </span>
                  </button>
                  <Link
                    href={`/app/projects/${project.id}/edit`}
                    className="shrink-0 text-xs text-[var(--color-accent)] hover:underline"
                  >
                    Open →
                  </Link>
                </div>

                {!isCollapsed && (
                  <ul className="divide-y divide-[var(--color-border)] border-t border-[var(--color-border)]">
                    {project.files.map((file) => {
                      const key = `${project.id}/${file.path}`;
                      const busy = deleting.has(key);
                      const showThumb = file.kind === "image" || file.kind === "video";
                      return (
                        <li key={file.path} className="flex items-center gap-3 px-4 py-2.5">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[var(--color-bg)] text-[var(--color-fg-subtle)]">
                            {showThumb ? (
                              // Reuses the existing per-asset thumbnail endpoint.
                              <img
                                src={`/api/projects/${project.id}/asset-thumb?path=${encodeURIComponent(file.path)}`}
                                alt={file.name}
                                className="h-full w-full object-cover"
                                loading="lazy"
                              />
                            ) : (
                              <span className="text-[10px] font-medium uppercase">
                                {file.kind === "audio" ? "♪" : file.name.split(".").pop() || "?"}
                              </span>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm text-[var(--color-fg)]">
                              {file.name}
                            </div>
                            <div className="mt-0.5 flex items-center gap-2 text-[10px] text-[var(--color-fg-muted)]">
                              <span
                                className={`rounded px-1.5 py-0.5 font-medium uppercase ${
                                  file.source === "ai"
                                    ? "bg-[var(--color-accent)]/12 text-[var(--color-accent)]"
                                    : "bg-[var(--color-surface)]"
                                }`}
                              >
                                {file.source === "ai" ? "AI" : "Upload"}
                              </span>
                              <span>{formatSize(file.bytes)}</span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => remove(project.id, file)}
                            disabled={busy}
                            title={`Delete ${file.name}`}
                            className="shrink-0 rounded-lg border border-[var(--color-border)] px-2.5 py-1.5 text-xs text-[var(--color-fg-muted)] transition-colors hover:border-[var(--color-danger)] hover:text-[var(--color-danger)] disabled:opacity-50"
                          >
                            {busy ? "…" : "Delete"}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}
    </main>
  );
}
