"use client";

import { useEffect, useRef, useState } from "react";
import { p50, readSamples, recordReload } from "@/lib/preview-budget";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      "hyperframes-player": React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          src?: string;
          controls?: boolean | string;
          autoplay?: boolean | string;
          muted?: boolean | string;
        },
        HTMLElement
      >;
    }
  }
}

type PlayerEl = HTMLElement & {
  play?: () => void;
  pause?: () => void;
  paused?: boolean;
  currentTime?: number;
  duration?: number;
};

export function Preview({ projectId, reloadKey }: { projectId: string; reloadKey: number }) {
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [playerReady, setPlayerReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<number | null>(null);
  const [hasComposition, setHasComposition] = useState<boolean | null>(null);
  const [lastLatencyMs, setLastLatencyMs] = useState<number | null>(null);
  const [p50LatencyMs, setP50LatencyMs] = useState<number | null>(null);
  const [agentWorking, setAgentWorking] = useState(false);
  const [agentLabel, setAgentLabel] = useState<string | null>(null);
  const [workStartedAt, setWorkStartedAt] = useState<number | null>(null);
  const playerRef = useRef<PlayerEl | null>(null);
  // Capture playback position+state across reloads so an edit doesn't
  // snap the user back to t=0.
  const carryOverRef = useRef<{ time: number; wasPlaying: boolean } | null>(null);
  const lastReloadKeyRef = useRef<number>(reloadKey);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/projects/${projectId}`)
      .then((response) => (response.ok ? response.json() : { files: [] }))
      .then((data) => {
        if (cancelled) return;
        const files: string[] = Array.isArray(data?.files) ? data.files : [];
        setHasComposition(files.some((path) => path === "index.html"));
      })
      .catch(() => !cancelled && setHasComposition(false));
    return () => {
      cancelled = true;
    };
  }, [projectId, reloadKey]);

  // Load the player script once
  useEffect(() => {
    if (scriptLoaded) return;
    if (typeof window === "undefined") return;
    if (customElements.get("hyperframes-player")) {
      setScriptLoaded(true);
      return;
    }
    const script = document.createElement("script");
    script.src =
      "https://cdn.jsdelivr.net/npm/@hyperframes/player/dist/hyperframes-player.global.js";
    script.async = true;
    script.onload = () => setScriptLoaded(true);
    script.onerror = () => setScriptLoaded(true);
    document.head.appendChild(script);
  }, [scriptLoaded]);

  // When a new composition arrives, auto-play it so the user sees the result
  // immediately without having to click play. Only auto-plays when triggered
  // by a file-change event (reloadKey > 0); does not fire on initial load.
  const autoPlayPendingRef = useRef(false);

  useEffect(() => {
    if (reloadKey === lastReloadKeyRef.current) return;
    lastReloadKeyRef.current = reloadKey;
    const player = playerRef.current;
    if (player && playerReady) {
      carryOverRef.current = {
        time: Number(player.currentTime ?? 0),
        wasPlaying: player.paused === false,
      };
    }
    if (reloadKey > 0) {
      setLastUpdate(Date.now());
      const delta = recordReload();
      if (delta !== null) {
        setLastLatencyMs(delta);
        setP50LatencyMs(p50(readSamples()));
      }
      // Schedule auto-play for when the new player becomes ready.
      autoPlayPendingRef.current = true;
    }
    setPlayerReady(false);
  }, [reloadKey, playerReady]);

  // Attach to player events once it's available
  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    const onReady = () => {
      setPlayerReady(true);
      const carry = carryOverRef.current;
      if (carry && Number.isFinite(carry.time) && carry.time > 0.05) {
        try {
          player.currentTime = carry.time;
        } catch {
          /* player may not allow direct currentTime set yet */
        }
        if (carry.wasPlaying) {
          try {
            player.play?.();
          } catch {
            /* */
          }
        }
      }
      carryOverRef.current = null;

      // Auto-play the composition the first time it loads after a file change.
      if (autoPlayPendingRef.current) {
        autoPlayPendingRef.current = false;
        try {
          player.currentTime = 0;
          player.play?.();
        } catch {
          /* ignore — user can press play manually */
        }
      }
    };
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    player.addEventListener("ready", onReady);
    player.addEventListener("play", onPlay);
    player.addEventListener("pause", onPause);
    player.addEventListener("ended", onPause);
    return () => {
      player.removeEventListener("ready", onReady);
      player.removeEventListener("play", onPlay);
      player.removeEventListener("pause", onPause);
      player.removeEventListener("ended", onPause);
    };
  }, [scriptLoaded, reloadKey]);

  // Listen for Cmd+P / Ctrl+P play-pause shortcut
  useEffect(() => {
    function onShortcut() {
      const player = playerRef.current;
      if (!player) return;
      if (player.paused === false) player.pause?.();
      else player.play?.();
    }
    window.addEventListener("vibeedit:toggle-play", onShortcut);
    return () => window.removeEventListener("vibeedit:toggle-play", onShortcut);
  }, []);

  // Listen for agent status broadcast from Chat. Drives the "Building..." overlay
  // so the user can see the agent is working, not just an unrelated demo loop.
  useEffect(() => {
    function onStatus(event: Event) {
      const detail = (event as CustomEvent<{ working: boolean; label?: string }>).detail;
      if (!detail) return;
      setAgentWorking(detail.working);
      setAgentLabel(detail.label ?? null);
      if (detail.working) {
        setWorkStartedAt((prev) => prev ?? Date.now());
      } else {
        setWorkStartedAt(null);
      }
    }
    window.addEventListener("vibeedit:agent-status", onStatus);
    return () => window.removeEventListener("vibeedit:agent-status", onStatus);
  }, []);

  // Shift-click anywhere on the player → pre-fill chat with the current timestamp
  function onPlayerClick(event: React.MouseEvent<HTMLDivElement>) {
    if (!event.shiftKey) return;
    const player = playerRef.current;
    if (!player) return;
    event.preventDefault();
    event.stopPropagation();
    const timestamp = Number(player.currentTime ?? 0);
    window.dispatchEvent(new CustomEvent("vibeedit:edit-at", { detail: { timestamp } }));
  }

  const src = `/api/projects/${projectId}/files/index.html?v=${reloadKey}`;
  const stateLabel = agentWorking
    ? "Building…"
    : hasComposition === false
      ? "Empty"
      : !playerReady
        ? "Loading"
        : isPlaying
          ? "Playing"
          : "Paused";

  return (
    <div className="flex h-full w-full flex-col bg-black">
      <div className="flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1.5 text-xs text-[var(--color-fg-muted)] md:px-4 md:py-2">
        <div className="flex min-w-0 items-center gap-2 md:gap-3">
          <span className="flex shrink-0 items-center gap-1.5">
            <span
              className={`inline-block h-2 w-2 rounded-full ${
                !playerReady
                  ? "animate-pulse bg-[var(--color-fg-muted)]"
                  : isPlaying
                    ? "bg-[var(--color-success)]"
                    : "bg-[var(--color-accent)]"
              }`}
            />
            {stateLabel}
          </span>
          {lastUpdate && (
            <span className="hidden sm:inline truncate">
              <Freshness ts={lastUpdate} />
            </span>
          )}
          {lastLatencyMs !== null && (
            <span className="hidden sm:inline">
              <LatencyBadge last={lastLatencyMs} median={p50LatencyMs} />
            </span>
          )}
        </div>
        <span className="hidden shrink-0 font-mono md:inline">
          ⌘P play · ⌘R render · ⇧click to edit frame
        </span>
      </div>
      <div
        className="relative flex min-h-0 flex-1 items-center justify-center p-2 md:p-4"
        onClick={onPlayerClick}
        onKeyDown={() => {}}
        role="presentation"
      >
        {/* The player frame is always mounted — its 16:9 box reserves the
				    layout so nothing jumps. The actual <hyperframes-player> is only
				    instantiated once a composition file exists, otherwise an
				    informational overlay sits inside the same frame. */}
        <div className="relative flex aspect-video w-full max-w-[min(100%,calc(76svh*16/9))] items-center justify-center overflow-hidden rounded-xl border border-[var(--color-border)] bg-black md:max-w-[min(100%,calc(70vh*16/9))] md:rounded-lg">
          {hasComposition === true && scriptLoaded ? (
            // @ts-expect-error custom element
            <hyperframes-player
              ref={(el: PlayerEl | null) => {
                playerRef.current = el;
              }}
              key={reloadKey}
              src={src}
              controls
              style={{
                width: "100%",
                height: "100%",
                display: "block",
              }}
            />
          ) : null}

          {/* Overlays — sit on top of (or in place of) the player. */}
          {hasComposition !== true && (
            <div className="absolute inset-0 flex items-center justify-center p-6">
              {agentWorking ? (
                <BuildingState label={agentLabel} startedAt={workStartedAt} />
              ) : hasComposition === false ? (
                <EmptyStateIdle />
              ) : (
                <div className="flex items-center gap-2 text-sm text-[var(--color-fg-muted)]">
                  <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-[var(--color-accent)]" />
                  Loading project…
                </div>
              )}
            </div>
          )}
          {hasComposition === true && !scriptLoaded && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/70 text-sm text-[var(--color-fg-muted)]">
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-[var(--color-accent)]" />
              <span className="ml-2">Loading player…</span>
            </div>
          )}
          {agentWorking && hasComposition === true && (
            <WorkingBanner label={agentLabel} startedAt={workStartedAt} />
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyStateIdle() {
  return (
    <div className="flex max-w-md flex-col items-center justify-center p-6 text-center">
      <div className="mb-3 text-4xl">🎬</div>
      <div className="text-base font-semibold text-white">No video yet</div>
      <div className="mt-2 text-sm text-white/60">
        Describe the video you want in the chat on the left. Your preview will render here once the
        agent builds it.
      </div>
    </div>
  );
}

function BuildingState({ label, startedAt }: { label: string | null; startedAt: number | null }) {
  return (
    <div className="flex max-w-md flex-col items-center justify-center p-6 text-center">
      <div className="mb-3 flex items-center gap-2 text-[var(--color-accent)]">
        <span className="inline-flex gap-1">
          <span className="h-2 w-2 animate-bounce rounded-full bg-[var(--color-accent)] [animation-delay:-0.3s]" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-[var(--color-accent)] [animation-delay:-0.15s]" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-[var(--color-accent)]" />
        </span>
        <span className="text-sm font-semibold uppercase tracking-wider">Agent is building</span>
      </div>
      <div className="font-mono text-xs text-white/60">{label ? `→ ${label}` : "→ thinking…"}</div>
      {startedAt !== null && <Elapsed startedAt={startedAt} />}
      <div className="mt-3 text-xs text-white/50">
        First builds usually take 30–90s. Watch the chat for plan + tool calls.
      </div>
    </div>
  );
}

function WorkingBanner({ label, startedAt }: { label: string | null; startedAt: number | null }) {
  return (
    <div className="pointer-events-none absolute left-1/2 top-3 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full border border-[var(--color-accent)]/40 bg-black/80 px-3 py-1.5 backdrop-blur-sm">
      <span className="inline-flex gap-0.5">
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--color-accent)] [animation-delay:-0.3s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--color-accent)] [animation-delay:-0.15s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--color-accent)]" />
      </span>
      <span className="text-[11px] font-medium text-[var(--color-fg)]">Agent working</span>
      {label && (
        <span className="font-mono text-[10px] text-[var(--color-fg-muted)]">· {label}</span>
      )}
      {startedAt !== null && (
        <span className="font-mono text-[10px] text-[var(--color-fg-muted)]">
          · <Elapsed startedAt={startedAt} inline />
        </span>
      )}
    </div>
  );
}

function Elapsed({ startedAt, inline }: { startedAt: number; inline?: boolean }) {
  const [, force] = useState(0);
  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const seconds = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
  const text = `${seconds}s`;
  if (inline) return <>{text}</>;
  return (
    <div className="mt-3 font-mono text-[11px] text-[var(--color-fg-muted)]">elapsed {text}</div>
  );
}

function LatencyBadge({ last, median }: { last: number; median: number | null }) {
  const seconds = (last / 1000).toFixed(1);
  const overBudget = last > 3000;
  const medianLabel = median !== null ? ` (p50 ${(median / 1000).toFixed(1)}s)` : "";
  return (
    <span
      className={overBudget ? "text-[var(--color-danger)]" : "text-[var(--color-success)]"}
      title="Edit-to-preview latency. Target: under 3s."
    >
      ↻ {seconds}s{medianLabel}
    </span>
  );
}

function Freshness({ ts }: { ts: number }) {
  const [, force] = useState(0);
  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const seconds = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  const label =
    seconds < 2
      ? "updated just now"
      : seconds < 60
        ? `updated ${seconds}s ago`
        : `updated ${Math.floor(seconds / 60)}m ago`;
  return <span>{label}</span>;
}
