"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Wordmark } from "@/components/Wordmark";

// Mirrors the shape returned by GET /api/health.
type CheckStatus = "ok" | "degraded" | "down";
type Check = { ok: boolean; status: CheckStatus; detail?: string; latencyMs?: number };
type Health = {
  status: CheckStatus;
  checks: Record<string, Check>;
  timestamp: string;
};

// Human-readable labels for the raw check keys from the health endpoint.
const CHECK_LABELS: Record<string, string> = {
  databaseRead: "Database (read)",
  databaseWrite: "Database (write)",
  storage: "Object storage",
  ffmpeg: "FFmpeg",
  ffprobe: "FFprobe",
  snapshotBrowser: "Snapshot browser",
  aiProvider: "AI provider",
  cli: "Renderer CLI",
};

const DOT: Record<CheckStatus, string> = {
  ok: "bg-[var(--color-success)]",
  degraded: "bg-amber-400",
  down: "bg-[var(--color-danger)]",
};

const STATUS_TEXT: Record<CheckStatus, string> = {
  ok: "text-[var(--color-success)]",
  degraded: "text-amber-400",
  down: "text-[var(--color-danger)]",
};

const STATUS_WORD: Record<CheckStatus, string> = {
  ok: "Operational",
  degraded: "Degraded",
  down: "Down",
};

const BANNER: Record<CheckStatus, { ring: string; heading: string }> = {
  ok: {
    ring: "border-[var(--color-success)] bg-[var(--color-success)]/10",
    heading: "All systems operational",
  },
  degraded: {
    ring: "border-amber-400 bg-amber-400/10",
    heading: "Some systems degraded",
  },
  down: {
    ring: "border-[var(--color-danger)] bg-[var(--color-danger)]/10",
    heading: "Major outage",
  },
};

export function StatusBoard() {
  const [health, setHealth] = useState<Health | null>(null);
  const [lastChecked, setLastChecked] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      // /api/health returns 503 when a critical dep is down — read the body either way.
      const r = await fetch("/api/health", { cache: "no-store" });
      const data = (await r.json()) as Health;
      setHealth(data);
    } catch {
      setHealth({
        status: "down",
        checks: { network: { ok: false, status: "down", detail: "could not reach API" } },
        timestamp: new Date().toISOString(),
      });
    } finally {
      setLastChecked(Date.now());
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 30_000);
    return () => clearInterval(id);
  }, [refresh]);

  const overall: CheckStatus = health?.status ?? "ok";
  const banner = BANNER[overall];

  return (
    <main className="mx-auto max-w-3xl p-4 sm:p-8">
      <header className="mb-8 flex items-center justify-between sm:mb-10">
        <Link
          href="/"
          aria-label="VibeEdit home"
          className="rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
        >
          <Wordmark size="md" />
        </Link>
        <span className="text-xs text-[var(--color-fg-muted)]">Auto-refresh · 30s</span>
      </header>

      <div
        className={`mb-8 rounded-2xl border p-6 sm:p-8 ${banner.ring}`}
        role="status"
        aria-live="polite"
      >
        <div className="mb-2 flex items-center gap-3">
          <span
            className={`inline-block h-3 w-3 rounded-full ${DOT[overall]}`}
            aria-hidden="true"
          />
          <h1 className="text-xl font-bold sm:text-2xl">
            {loading ? "Checking systems…" : banner.heading}
          </h1>
        </div>
        {lastChecked > 0 && (
          <div className="text-sm text-[var(--color-fg-muted)]">
            Checked{" "}
            <time dateTime={new Date(lastChecked).toISOString()}>
              {new Date(lastChecked).toLocaleTimeString()}
            </time>
          </div>
        )}
      </div>

      <section aria-label="Subsystem status">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[var(--color-fg-muted)]">
          Subsystems
        </h2>
        <ul className="space-y-2">
          {health &&
            Object.entries(health.checks).map(([name, check]) => (
              <li
                key={name}
                className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className={`inline-block h-2 w-2 shrink-0 rounded-full ${DOT[check.status]}`}
                    aria-hidden="true"
                  />
                  <span className="truncate font-medium">{CHECK_LABELS[name] ?? name}</span>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  {check.detail && (
                    <span className="hidden text-[var(--color-fg-muted)] sm:inline">
                      {check.detail}
                    </span>
                  )}
                  {typeof check.latencyMs === "number" && (
                    <span className="text-[var(--color-fg-subtle)]">{check.latencyMs}ms</span>
                  )}
                  <span className={`font-semibold ${STATUS_TEXT[check.status]}`}>
                    {STATUS_WORD[check.status]}
                  </span>
                </div>
              </li>
            ))}
        </ul>
        <p className="mt-6 text-xs text-[var(--color-fg-subtle)]">
          Live readout from <code>/api/health</code>. Degraded means reachable but impaired; down
          means a critical dependency is unavailable.
        </p>
      </section>
    </main>
  );
}
