"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getMe, type PlanId } from "@/lib/billing/me-client";
import {
  renderOnClient,
  supportsWebCodecs,
  type ClientRenderProgress,
} from "@/lib/render/client-renderer";

type Review = {
  id: string;
  renderJobId: string;
  userId: string;
  timestampSeconds: number;
  text: string;
  resolved: boolean;
  createdAt: string;
};

type Job = {
  id: string;
  status: "queued" | "running" | "done" | "failed";
  progress: number;
  outputPath: string | null;
  error: string | null;
  createdAt: string;
  startedAt?: string | null;
};

type Preset = {
  label: string;
  sublabel: string;
  fps: number;
  quality: "draft" | "standard" | "high";
  requiresPlan?: "creator" | "studio";
};

// Ordered so the most common pick (YouTube 1080p) is the default.
const PRESETS: Preset[] = [
  {
    label: "YouTube",
    sublabel: "1080p · 30fps · MP4",
    fps: 30,
    quality: "standard",
  },
  {
    label: "Shorts / TikTok / Reels",
    sublabel: "1080×1920 · 30fps",
    fps: 30,
    quality: "standard",
  },
  {
    label: "Draft",
    sublabel: "fast, low quality",
    fps: 24,
    quality: "draft",
  },
  {
    label: "High quality",
    sublabel: "60fps",
    fps: 60,
    quality: "high",
  },
  {
    label: "4K",
    sublabel: "30fps — Studio plan",
    fps: 30,
    quality: "high",
    requiresPlan: "studio",
  },
];

export function RenderPanel({ projectId }: { projectId: string }) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [presetIndex, setPresetIndex] = useState(0);
  const [planId, setPlanId] = useState<PlanId>("free");
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Client-side render state
  const [clientProgress, setClientProgress] = useState<ClientRenderProgress | null>(null);
  const [clientBlob, setClientBlob] = useState<Blob | null>(null);
  // null = not yet determined, "webcodecs" = device render, "server" = server fallback
  const [lastMethod, setLastMethod] = useState<"webcodecs" | "server" | null>(null);

  useEffect(() => {
    let cancelled = false;
    getMe().then((data) => {
      if (cancelled || !data) return;
      setPlanId(data.plan.id);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const refresh = useCallback(async () => {
    const r = await fetch(`/api/render?projectId=${projectId}`);
    if (!r.ok) return;
    const j = (await r.json()) as { jobs: Job[] };
    setJobs(j.jobs);
  }, [projectId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const activeJobId = jobs.find((j) => j.status === "queued" || j.status === "running")?.id;

  useEffect(() => {
    if (!activeJobId) return;
    const source = new EventSource(`/api/render/${activeJobId}/stream`);
    source.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as Partial<Job>;
        setJobs((prev) => prev.map((j) => (j.id === activeJobId ? { ...j, ...data } : j)));
        if (data.status === "done" || data.status === "failed") {
          source.close();
          refresh();
        }
      } catch {
        /* */
      }
    };
    source.onerror = () => source.close();
    return () => source.close();
  }, [activeJobId, refresh]);

  // Close the dropdown on outside click / ESC.
  useEffect(() => {
    if (!menuOpen) return;
    function onPointer(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }
    window.addEventListener("mousedown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  // Surface render outcomes (errors / blocks) to the user via the editor's
  // toast. Without this, a missing composition or a billing block fails
  // silently and the button just spins back to idle.
  function notify(kind: "ok" | "error", text: string) {
    window.dispatchEvent(new CustomEvent("vibeedit:notify", { detail: { kind, text } }));
  }

  async function startRender(index = presetIndex) {
    const preset = PRESETS[index];
    setSubmitting(true);
    setClientBlob(null);
    setClientProgress(null);
    setMenuOpen(false);

    // ── Guard: nothing to render until a composition (index.html) exists ──
    const meta = await fetch(`/api/projects/${projectId}`)
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);
    const files: string[] = Array.isArray(meta?.files) ? meta.files : [];
    if (!files.includes("index.html")) {
      notify("error", "Nothing to render yet — ask the agent to build the video first.");
      setSubmitting(false);
      return;
    }

    // ── Try client-side render first ──────────────────────────────────────
    if (supportsWebCodecs()) {
      setLastMethod("webcodecs");
      const blob = await renderOnClient({
        projectId,
        fps: preset.fps,
        quality: preset.quality,
        onProgress: (p) => setClientProgress(p),
      });
      if (blob) {
        setClientBlob(blob);
        setClientProgress((prev) => (prev ? { ...prev, phase: "done" } : null));
        setSubmitting(false);
        return; // Done — no server call needed.
      }
      // Client render failed; fall through to server.
    }

    // ── Fall back to server ───────────────────────────────────────────────
    setLastMethod("server");
    setClientProgress(null);
    const res = await fetch("/api/render", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        projectId,
        fps: preset.fps,
        quality: preset.quality,
      }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { message?: string } | null;
      notify("error", data?.message || `Render failed (${res.status}). Please try again.`);
      return;
    }
    refresh();
  }

  // Cmd+R global shortcut — blocked while any job is active.
  useEffect(() => {
    function onRender() {
      if (!submitting && !activeJobId) startRender(presetIndex);
    }
    window.addEventListener("vibeedit:render", onRender);
    return () => window.removeEventListener("vibeedit:render", onRender);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submitting, activeJobId, presetIndex, projectId]);

  function planMeets(
    current: "free" | "creator" | "studio",
    required: "creator" | "studio",
  ): boolean {
    const order = { free: 0, creator: 1, studio: 2 } as const;
    return order[current] >= order[required];
  }

  const latest = jobs[0];
  const activePreset = PRESETS[presetIndex];
  const isRenderBusy = submitting || !!activeJobId;

  // Client render progress 0-1
  const clientPct =
    clientProgress && clientProgress.totalFrames > 0
      ? clientProgress.frame / clientProgress.totalFrames
      : null;

  return (
    <div className="flex items-center gap-2 text-sm">
      {/* Method badge */}
      {lastMethod && <RenderMethodBadge method={lastMethod} />}

      {/* Client-side render progress */}
      {submitting && lastMethod === "webcodecs" && clientProgress && (
        <div className="hidden items-center gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-2.5 py-1.5 sm:flex">
          <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--color-accent)]" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-fg-muted)]">
            {clientProgress.phase === "capturing"
              ? "capturing"
              : clientProgress.phase === "encoding"
                ? "encoding"
                : clientProgress.phase === "audio"
                  ? "audio"
                  : "muxing"}
          </span>
          {clientPct !== null && (
            <>
              <div
                className="relative h-1.5 w-28 overflow-hidden rounded-full bg-[var(--color-border)]"
                role="progressbar"
                aria-valuenow={Math.round(clientPct * 100)}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  className="h-full rounded-full bg-[var(--color-accent)] transition-[width] duration-150"
                  style={{ width: `${Math.max(2, Math.round(clientPct * 100))}%` }}
                />
              </div>
              <span className="font-mono text-[10px] tabular-nums text-[var(--color-fg-muted)]">
                {Math.round(clientPct * 100)}%
              </span>
              {clientProgress.phase === "capturing" && (
                <span className="hidden font-mono text-[10px] text-[var(--color-fg-subtle)] lg:inline">
                  {clientProgress.frame}/{clientProgress.totalFrames} fr
                </span>
              )}
            </>
          )}
        </div>
      )}

      {/* Client-side render download (blob URL) */}
      {clientBlob && <ClientDownloadButton blob={clientBlob} />}

      {/* Server render status */}
      {latest && latest.status === "running" && lastMethod !== "webcodecs" && (
        <div className="hidden items-center gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-2.5 py-1.5 sm:flex">
          <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--color-accent)]" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-fg-muted)]">
            rendering
          </span>
          <div
            className="relative h-1.5 w-28 overflow-hidden rounded-full bg-[var(--color-border)]"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(latest.progress * 100)}
          >
            <div
              className="h-full rounded-full bg-[var(--color-accent)] transition-[width] duration-300"
              style={{ width: `${Math.max(2, Math.round(latest.progress * 100))}%` }}
            />
          </div>
          <span className="font-mono text-[10px] tabular-nums text-[var(--color-fg-muted)]">
            {Math.round(latest.progress * 100)}%
          </span>
          <EtaInline job={latest} />
        </div>
      )}
      {latest && latest.status === "queued" && lastMethod !== "webcodecs" && (
        <span className="hidden text-[10px] uppercase tracking-wider text-[var(--color-fg-muted)] sm:inline">
          queued…
        </span>
      )}
      {latest && latest.status === "done" && latest.outputPath && !clientBlob && (
        <div className="flex items-center gap-1.5">
          <a
            href={`/api/render/${latest.id}/download`}
            className="rounded-md border border-[var(--color-success)] bg-[var(--color-success)]/10 px-2 py-1.5 text-xs font-semibold text-[var(--color-success)] hover:bg-[var(--color-success)]/20 sm:px-3"
          >
            <span className="sm:hidden">↓</span>
            <span className="hidden sm:inline">↓ Download .mp4</span>
          </a>
          <PublishButton renderJobId={latest.id} />
          <ReviewsButton renderJobId={latest.id} />
        </div>
      )}
      {latest && latest.status === "failed" && (
        <span
          className="max-w-[14ch] truncate text-xs text-[var(--color-danger)]"
          title={latest.error || ""}
        >
          ✕ {latest.error}
        </span>
      )}
      {/* Live job status. Sits BEFORE the render button so the progress bar
			    grows out of the action area. */}
      {latest && latest.status === "running" && (
        <div className="hidden items-center gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-2.5 py-1.5 sm:flex">
          <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--color-accent)]" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-fg-muted)]">
            rendering
          </span>
          <div
            className="relative h-1.5 w-28 overflow-hidden rounded-full bg-[var(--color-border)]"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(latest.progress * 100)}
          >
            <div
              className="h-full rounded-full bg-[var(--color-accent)] transition-[width] duration-300"
              style={{
                width: `${Math.max(2, Math.round(latest.progress * 100))}%`,
              }}
            />
          </div>
          <span className="font-mono text-[10px] tabular-nums text-[var(--color-fg-muted)]">
            {Math.round(latest.progress * 100)}%
          </span>
          <EtaInline job={latest} />
        </div>
      )}
      {latest && latest.status === "queued" && (
        <span className="hidden text-[10px] uppercase tracking-wider text-[var(--color-fg-muted)] sm:inline">
          queued…
        </span>
      )}
      {latest && latest.status === "done" && latest.outputPath && (
        <div className="flex items-center gap-1.5">
          <a
            href={`/api/render/${latest.id}/download`}
            className="rounded-md border border-[var(--color-success)] bg-[var(--color-success)]/10 px-2 py-1.5 text-xs font-semibold text-[var(--color-success)] hover:bg-[var(--color-success)]/20 sm:px-3"
          >
            <span className="sm:hidden">↓</span>
            <span className="hidden sm:inline">↓ Download .mp4</span>
          </a>
          <PublishButton renderJobId={latest.id} />
          <ReviewsButton renderJobId={latest.id} />
        </div>
      )}
      {latest && latest.status === "failed" && (
        <span
          className="max-w-[14ch] truncate text-xs text-[var(--color-danger)]"
          title={latest.error || ""}
        >
          ✕ {latest.error}
        </span>
      )}

      {/* Render button — split into "Render" + caret to show presets. */}
      <div ref={menuRef} className="relative inline-flex">
        <button
          onClick={() => startRender(presetIndex)}
          disabled={isRenderBusy}
          className={`flex items-center gap-1.5 rounded-l-md px-2.5 py-1.5 text-sm font-semibold transition-all sm:gap-2 sm:px-3 ${
            isRenderBusy
              ? "cursor-not-allowed bg-[var(--color-surface-2)] text-[var(--color-fg-muted)] opacity-60"
              : "bg-[var(--color-accent)] text-black hover:opacity-90"
          }`}
          title={
            isRenderBusy
              ? "Render in progress — wait for it to finish"
              : `Render with ${activePreset.label} (⌘R)`
          }
        >
          {submitting ? (
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 animate-spin rounded-full border border-current border-t-transparent" />
              <span className="hidden sm:inline">Queuing…</span>
            </span>
          ) : activeJobId ? (
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-[var(--color-accent)]" />
              <span className="hidden sm:inline">Rendering…</span>
            </span>
          ) : (
            <>
              ▶
              <span className="hidden sm:inline">
                Render
                <span className="ml-1 text-[10px] font-normal opacity-70">
                  · {activePreset.label}
                </span>
              </span>
              <span className="text-xs sm:hidden">Render</span>
            </>
          )}
        </button>
        <button
          onClick={() => setMenuOpen((v) => !v)}
          disabled={isRenderBusy}
          aria-label="Choose render preset"
          className={`rounded-r-md border-l px-1.5 py-1.5 text-sm font-semibold transition-all sm:px-2 ${
            isRenderBusy
              ? "cursor-not-allowed border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-fg-muted)] opacity-60"
              : "border-black/15 bg-[var(--color-accent)] text-black hover:opacity-90"
          }`}
        >
          ▾
        </button>
        {menuOpen && (
          <div className="absolute right-0 top-full z-40 mt-1 w-72 overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl">
            <div className="border-b border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-[10px] uppercase tracking-wider text-[var(--color-fg-muted)]">
              Render preset
            </div>
            <ul className="py-1">
              {PRESETS.map((preset, index) => {
                const locked = preset.requiresPlan && !planMeets(planId, preset.requiresPlan);
                const isActive = presetIndex === index;
                return (
                  <li key={preset.label}>
                    <button
                      onClick={() => {
                        if (locked) return;
                        setPresetIndex(index);
                        startRender(index);
                      }}
                      disabled={!!locked}
                      className={`flex w-full items-start justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-[var(--color-bg-2)] disabled:cursor-not-allowed disabled:opacity-50 ${
                        isActive ? "bg-[var(--color-bg-2)]" : ""
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 font-medium text-[var(--color-fg)]">
                          {isActive && <span className="text-[var(--color-accent)]">●</span>}
                          {preset.label}
                          {locked && (
                            <span className="rounded bg-[var(--color-border)] px-1.5 py-0.5 text-[9px] uppercase text-[var(--color-fg-muted)]">
                              Upgrade
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 text-[11px] text-[var(--color-fg-muted)]">
                          {preset.sublabel}
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

function PublishButton({ renderJobId }: { renderJobId: string }) {
  const [open, setOpen] = useState(false);
  const [publishing, setPublishing] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  async function publish(platform: "youtube" | "tiktok") {
    setPublishing(platform);
    setOpen(false);
    const res = await fetch("/api/publish", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ renderJobId, platform }),
    });
    const data = (await res.json()) as {
      ok?: boolean;
      url?: string;
      error?: string;
      message?: string;
    };
    if (data.ok && data.url) {
      setResult(data.url);
    } else if (data.error === "not_connected") {
      window.open("/app/settings/publishing", "_blank");
    } else {
      alert(data.message || data.error || "Publish failed");
    }
    setPublishing(null);
  }

  if (result) {
    return (
      <a
        href={result}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-md border border-[var(--color-accent)] px-2.5 py-1.5 text-xs font-semibold text-[var(--color-accent)] hover:opacity-80"
      >
        ↗ Published
      </a>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={!!publishing}
        className="rounded-md border border-[var(--color-border)] px-2.5 py-1.5 text-xs font-medium text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] disabled:opacity-50"
      >
        {publishing ? `Publishing to ${publishing}…` : "↑ Publish"}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-40 mt-1 w-44 overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-xl">
          <p className="border-b border-[var(--color-border)] px-3 py-2 text-[10px] uppercase tracking-wider text-[var(--color-fg-muted)]">
            Publish to
          </p>
          {(["youtube", "tiktok"] as const).map((p) => (
            <button
              key={p}
              onClick={() => publish(p)}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-[var(--color-bg-2)]"
            >
              {p === "youtube" ? "▶ YouTube" : "♪ TikTok"}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ReviewsButton({ renderJobId }: { renderJobId: string }) {
  const [open, setOpen] = useState(false);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [text, setText] = useState("");
  const [ts, setTs] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    fetch(`/api/render/${renderJobId}/reviews`)
      .then((r) => (r.ok ? r.json() : { reviews: [] }))
      .then((d) => setReviews((d as { reviews: Review[] }).reviews));
  }, [open, renderJobId]);

  useEffect(() => {
    if (!open) return;
    function onOutside(event: MouseEvent) {
      if (!panelRef.current?.contains(event.target as Node)) setOpen(false);
    }
    window.addEventListener("mousedown", onOutside);
    return () => window.removeEventListener("mousedown", onOutside);
  }, [open]);

  async function submit() {
    const seconds = parseFloat(ts);
    if (!text.trim() || isNaN(seconds)) return;
    setSubmitting(true);
    const r = await fetch(`/api/render/${renderJobId}/reviews`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ timestampSeconds: seconds, text: text.trim() }),
    });
    if (r.ok) {
      const d = (await r.json()) as { review: Review };
      setReviews((prev) =>
        [...prev, d.review].sort((a, b) => a.timestampSeconds - b.timestampSeconds),
      );
      setText("");
      setTs("");
    }
    setSubmitting(false);
  }

  async function resolve(reviewId: string, resolved: boolean) {
    await fetch(`/api/render/${renderJobId}/reviews`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reviewId, resolved }),
    });
    setReviews((prev) => prev.map((rv) => (rv.id === reviewId ? { ...rv, resolved } : rv)));
  }

  const open_count = reviews.filter((rv) => !rv.resolved).length;

  return (
    <div ref={panelRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-md border border-[var(--color-border)] px-2.5 py-1.5 text-xs font-medium text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
        title="Review comments"
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
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        Review
        {open_count > 0 && (
          <span className="rounded-full bg-[var(--color-accent)] px-1.5 py-0.5 text-[9px] font-bold text-black">
            {open_count}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-80 overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl">
          <div className="border-b border-[var(--color-border)] px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-fg-muted)]">
            Review comments
          </div>
          <div className="max-h-64 overflow-y-auto">
            {reviews.length === 0 ? (
              <p className="px-3 py-4 text-center text-xs text-[var(--color-fg-subtle)]">
                No comments yet
              </p>
            ) : (
              <ul className="divide-y divide-[var(--color-border)]">
                {reviews.map((rv) => (
                  <li key={rv.id} className={`px-3 py-2 ${rv.resolved ? "opacity-50" : ""}`}>
                    <div className="flex items-start justify-between gap-2">
                      <span className="shrink-0 rounded bg-[var(--color-bg-2)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--color-accent)]">
                        {rv.timestampSeconds.toFixed(1)}s
                      </span>
                      <p className="flex-1 text-xs text-[var(--color-fg)]">{rv.text}</p>
                      <button
                        onClick={() => resolve(rv.id, !rv.resolved)}
                        className="shrink-0 text-[10px] text-[var(--color-fg-subtle)] hover:text-[var(--color-success)]"
                        title={rv.resolved ? "Reopen" : "Mark resolved"}
                      >
                        {rv.resolved ? "↩" : "✓"}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="border-t border-[var(--color-border)] p-3">
            <div className="mb-2 flex gap-2">
              <input
                value={ts}
                onChange={(e) => setTs(e.target.value)}
                placeholder="0.0s"
                className="w-16 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-2)] px-2 py-1.5 text-xs outline-none placeholder:text-[var(--color-fg-subtle)] focus:border-[var(--color-accent)]"
              />
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submit()}
                placeholder="Add a comment…"
                className="flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-2)] px-2 py-1.5 text-xs outline-none placeholder:text-[var(--color-fg-subtle)] focus:border-[var(--color-accent)]"
              />
            </div>
            <button
              onClick={submit}
              disabled={submitting || !text.trim() || isNaN(parseFloat(ts))}
              className="w-full rounded-lg bg-[var(--color-accent)] py-1.5 text-xs font-semibold text-black disabled:opacity-40"
            >
              {submitting ? "Adding…" : "Add comment"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function RenderMethodBadge({ method }: { method: "webcodecs" | "server" }) {
  const isDevice = method === "webcodecs";
  return (
    <span
      title={
        isDevice
          ? "Rendered on your device using WebCodecs — no server compute used"
          : "Rendered on the VibeEdit server using Puppeteer + FFmpeg"
      }
      className={`hidden items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-semibold sm:inline-flex ${
        isDevice
          ? "border-[var(--color-accent)]/30 bg-[var(--color-accent)]/8 text-[var(--color-accent)]"
          : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-fg-muted)]"
      }`}
    >
      {isDevice ? (
        <>
          <svg
            width="9"
            height="9"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="2" y="3" width="20" height="14" rx="2" />
            <path d="M8 21h8M12 17v4" />
          </svg>
          Device
        </>
      ) : (
        <>
          <svg
            width="9"
            height="9"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
          </svg>
          Server
        </>
      )}
    </span>
  );
}

function ClientDownloadButton({ blob }: { blob: Blob }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    const objectUrl = URL.createObjectURL(blob);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [blob]);

  if (!url) return null;
  return (
    <a
      href={url}
      download="render.mp4"
      className="rounded-md border border-[var(--color-success)] bg-[var(--color-success)]/10 px-2 py-1.5 text-xs font-semibold text-[var(--color-success)] hover:bg-[var(--color-success)]/20 sm:px-3"
    >
      <span className="sm:hidden">↓</span>
      <span className="hidden sm:inline">↓ Download .mp4</span>
    </a>
  );
}

function EtaInline({ job }: { job: Job }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);
  if (job.progress <= 0.05) return null;
  const startMs = new Date(job.startedAt || job.createdAt).getTime();
  const elapsed = Math.max(0, Date.now() - startMs) / 1000;
  const remaining = (elapsed * (1 - job.progress)) / job.progress;
  if (!Number.isFinite(remaining) || remaining <= 0) return null;
  const label = remaining < 60 ? `~${Math.ceil(remaining)}s` : `~${Math.ceil(remaining / 60)}m`;
  return (
    <span
      className="font-mono text-[10px] text-[var(--color-fg-muted)]"
      title={`${(job.progress * 100).toFixed(0)}% · elapsed ${Math.round(elapsed)}s`}
    >
      {label}
    </span>
  );
}
