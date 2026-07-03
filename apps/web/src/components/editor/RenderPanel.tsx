"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getMe, type PlanId } from "@/lib/billing/me-client";
import { Paywall, isPaywall, type PaywallData } from "@/components/Paywall";
import {
  renderOnClient,
  supportsWebCodecs,
  type ClientRenderError,
  type ClientRenderProgress,
} from "@/lib/render/client-renderer";

type Job = {
  id: string;
  status: "queued" | "running" | "done" | "failed";
  progress: number;
  outputPath: string | null;
  error: string | null;
  createdAt: string;
  startedAt?: string | null;
  // Set by the queue when a transient attempt failed and a backoff retry is
  // scheduled. Lets the UI explain "retrying…" instead of an opaque re-queue.
  attempts?: number | null;
  retryReason?: string | null;
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
  const [modalOpen, setModalOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Client-side render state
  const [clientProgress, setClientProgress] = useState<ClientRenderProgress | null>(null);
  const [clientBlob, setClientBlob] = useState<Blob | null>(null);
  // null = not yet determined, "webcodecs" = device render, "server" = server fallback
  const [lastMethod, setLastMethod] = useState<"webcodecs" | "server" | null>(null);
  const [paywall, setPaywall] = useState<PaywallData | null>(null);

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
    setModalOpen(true); // open the progress modal for the whole render lifecycle

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
      let clientErr: ClientRenderError | null = null;
      const blob = await renderOnClient({
        projectId,
        fps: preset.fps,
        quality: preset.quality,
        onProgress: (p) => setClientProgress(p),
        onError: (e) => {
          clientErr = e;
        },
      });
      if (blob) {
        setClientBlob(blob);
        setClientProgress((prev) => (prev ? { ...prev, phase: "done" } : null));
        setSubmitting(false);
        // Persist the in-browser render to the project so it survives a tab
        // close and shows up in render history. The blob stays in memory for
        // an immediate download regardless of whether this upload succeeds.
        try {
          const fd = new FormData();
          fd.append("file", blob, "render.mp4");
          fd.append("projectId", projectId);
          fd.append("fps", String(preset.fps));
          fd.append("quality", preset.quality);
          const saveRes = await fetch("/api/render/client-save", { method: "POST", body: fd });
          if (saveRes.ok) refresh();
          else
            notify(
              "error",
              "Render finished but couldn't be saved to your project — download it now to keep it.",
            );
        } catch {
          notify(
            "error",
            "Render finished but couldn't be saved to your project — download it now to keep it.",
          );
        }
        return; // Done — no server call needed.
      }
      // Client render didn't produce a file. Tell the user what happened
      // instead of silently switching engines, then fall through to server.
      const err = clientErr as ClientRenderError | null;
      if (err && !err.recoverable) {
        notify(
          "error",
          `In-browser render failed (${err.phase}, frame ${err.frame}/${err.totalFrames}). Rendering on the server instead.`,
        );
      } else if (err) {
        notify("ok", "Rendering on the server for full quality — we'll email you when it's ready.");
      }
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
      if (res.status === 402 && isPaywall(data)) {
        setPaywall(data); // show the full upgrade moment instead of a bare error toast
        return;
      }
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

  function planMeets(current: PlanId, required: "creator" | "studio"): boolean {
    const order = { free: 0, creator: 1, pro: 2, studio: 3 } as const;
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
      {paywall && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md">
            <Paywall data={paywall} onDismiss={() => setPaywall(null)} />
          </div>
        </div>
      )}
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
        </div>
      )}
      {latest && latest.status === "failed" && (
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="flex max-w-[16ch] items-center gap-1 truncate text-xs text-[var(--color-danger)] hover:underline"
            title={latest.error || "Render failed"}
          >
            <span aria-hidden="true">✕</span>
            <span className="truncate">{latest.error || "Render failed"}</span>
          </button>
          <button
            type="button"
            onClick={() => startRender(presetIndex)}
            className="rounded-md border border-[var(--color-border)] px-2 py-1 text-[11px] font-semibold text-[var(--color-fg)] hover:bg-[var(--color-bg-2)]"
          >
            Retry
          </button>
        </div>
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
        </div>
      )}
      {latest && latest.status === "failed" && (
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="flex max-w-[16ch] items-center gap-1 truncate text-xs text-[var(--color-danger)] hover:underline"
            title={latest.error || "Render failed"}
          >
            <span aria-hidden="true">✕</span>
            <span className="truncate">{latest.error || "Render failed"}</span>
          </button>
          <button
            type="button"
            onClick={() => startRender(presetIndex)}
            className="rounded-md border border-[var(--color-border)] px-2 py-1 text-[11px] font-semibold text-[var(--color-fg)] hover:bg-[var(--color-bg-2)]"
          >
            Retry
          </button>
        </div>
      )}

      {/* Render button — split into "Render" + caret to show presets. */}
      <div ref={menuRef} className="relative inline-flex">
        <button
          onClick={() => (isRenderBusy ? setModalOpen(true) : startRender(presetIndex))}
          className={`flex items-center gap-1.5 rounded-l-md px-2.5 py-1.5 text-sm font-semibold transition-all sm:gap-2 sm:px-3 ${
            isRenderBusy
              ? "cursor-pointer bg-[var(--color-surface-2)] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
              : "bg-[var(--color-accent)] text-black hover:opacity-90"
          }`}
          title={isRenderBusy ? "Show render progress" : `Render with ${activePreset.label} (⌘R)`}
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

      {modalOpen && (
        <RenderModal
          onClose={() => setModalOpen(false)}
          onRetry={() => startRender(presetIndex)}
          submitting={submitting}
          method={lastMethod}
          clientProgress={clientProgress}
          clientPct={clientPct}
          clientBlob={clientBlob}
          job={latest}
        />
      )}
    </div>
  );
}

function RenderModal({
  onClose,
  onRetry,
  submitting,
  method,
  clientProgress,
  clientPct,
  clientBlob,
  job,
}: {
  onClose: () => void;
  onRetry: () => void;
  submitting: boolean;
  method: "webcodecs" | "server" | null;
  clientProgress: ClientRenderProgress | null;
  clientPct: number | null;
  clientBlob: Blob | null;
  job: Job | undefined;
}) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!clientBlob) return;
    const url = URL.createObjectURL(clientBlob);
    setBlobUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [clientBlob]);

  useEffect(() => {
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [onClose]);

  const serverDone = job?.status === "done" && !!job.outputPath && method === "server";
  const done = !!clientBlob || serverDone;
  const error = job?.status === "failed" ? job.error || "Render failed." : null;
  const rawPct = method === "webcodecs" ? clientPct : job ? job.progress : null;
  const pctInt = rawPct !== null ? Math.round(Math.max(0, Math.min(1, rawPct)) * 100) : null;

  let phaseText = "Working…";
  if (method === "webcodecs" && clientProgress) {
    phaseText =
      clientProgress.phase === "initializing"
        ? "Preparing composition…"
        : clientProgress.phase === "capturing"
          ? `Capturing frames… ${clientProgress.frame}/${clientProgress.totalFrames}`
          : clientProgress.phase === "encoding"
            ? "Encoding video…"
            : clientProgress.phase === "audio"
              ? "Mixing audio…"
              : clientProgress.phase === "muxing"
                ? "Finalizing MP4…"
                : "Finishing up…";
  } else if (job?.status === "queued") {
    phaseText = job.retryReason
      ? "A transient error occurred — retrying automatically…"
      : "Queued — waiting for a render slot…";
  } else if (job?.status === "running") {
    phaseText = "Rendering on the server…";
  } else if (submitting) {
    phaseText = "Starting render…";
  }

  const methodLabel =
    method === "webcodecs"
      ? "Rendering on your device"
      : method === "server"
        ? "Rendering on the server"
        : null;
  const title = error ? "Render failed" : done ? "Render complete" : "Rendering…";

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="animate-scale-in w-full max-w-md overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-3.5">
          <h2 className="font-semibold text-[var(--color-fg)]">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--color-fg-muted)] hover:bg-[var(--color-bg-2)] hover:text-[var(--color-fg)]"
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

        <div className="px-5 py-5">
          {error ? (
            <div className="space-y-4">
              <div className="flex items-start gap-2.5 rounded-xl border border-[var(--color-danger)]/30 bg-[var(--color-danger)]/8 p-3 text-sm text-[var(--color-danger)]">
                <span className="mt-px shrink-0">⚠</span>
                <span className="break-words">{error}</span>
              </div>
              <button
                onClick={onRetry}
                className="w-full rounded-xl bg-[var(--color-accent)] py-2.5 text-sm font-semibold text-black transition-opacity hover:opacity-90"
              >
                Try again
              </button>
            </div>
          ) : done ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-success)]/15 text-[var(--color-success)]">
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </span>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-[var(--color-fg)]">
                    Your MP4 is ready
                  </div>
                  {methodLabel && (
                    <div className="text-xs text-[var(--color-fg-muted)]">{methodLabel}</div>
                  )}
                </div>
              </div>
              {clientBlob && blobUrl ? (
                <a
                  href={blobUrl}
                  download="render.mp4"
                  className="block w-full rounded-xl bg-[var(--color-accent)] py-2.5 text-center text-sm font-semibold text-black transition-opacity hover:opacity-90"
                >
                  ↓ Download MP4
                </a>
              ) : serverDone && job ? (
                <a
                  href={`/api/render/${job.id}/download`}
                  className="block w-full rounded-xl bg-[var(--color-accent)] py-2.5 text-center text-sm font-semibold text-black transition-opacity hover:opacity-90"
                >
                  ↓ Download MP4
                </a>
              ) : null}
              <button
                onClick={onClose}
                className="w-full rounded-xl border border-[var(--color-border)] py-2 text-sm font-medium text-[var(--color-fg-muted)] transition-colors hover:text-[var(--color-fg)]"
              >
                Close
              </button>
            </div>
          ) : (
            <div className="space-y-3.5">
              {methodLabel && (
                <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-fg-subtle)]">
                  {methodLabel}
                </div>
              )}
              <div className="flex items-center gap-2 text-sm text-[var(--color-fg)]">
                <span className="inline-block h-2 w-2 shrink-0 animate-pulse rounded-full bg-[var(--color-accent)]" />
                {phaseText}
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[var(--color-border)]">
                {pctInt !== null ? (
                  <div
                    className="h-full rounded-full bg-[var(--color-accent)] transition-[width] duration-200"
                    style={{ width: `${Math.max(3, pctInt)}%` }}
                  />
                ) : (
                  <div className="h-full w-1/3 animate-pulse rounded-full bg-[var(--color-accent)]" />
                )}
              </div>
              <div className="flex items-center justify-between text-xs text-[var(--color-fg-muted)]">
                <span className="font-mono tabular-nums">
                  {pctInt !== null ? `${pctInt}%` : "starting…"}
                </span>
                {job && job.status === "running" && <EtaInline job={job} />}
              </div>
              <p className="text-[11px] text-[var(--color-fg-subtle)]">
                You can close this — the render keeps going. Reopen it from the Render button.
              </p>
            </div>
          )}
        </div>
      </div>
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
