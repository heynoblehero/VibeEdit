"use client";

import { useEffect, useState } from "react";

interface Status {
  bridge: boolean;
  hasAnthropicKey: boolean;
  pending: number;
  isProxied?: boolean;
  baseUrl?: string | null;
}

// Polls /api/bridge/status every 2s. Shows a tiny dot in the header:
//   green steady   → real API mode, key set
//   sky steady     → via Claude Max / custom proxy (ANTHROPIC_BASE_URL set)
//   amber steady   → bridge mode, queue empty
//   amber pulse    → bridge mode, N requests pending
//   red steady     → bridge mode, no key — misconfigured
export function BridgeIndicator() {
  const [s, setS] = useState<Status | null>(null);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const r = await fetch("/api/bridge/status", { cache: "no-store" });
        if (!alive) return;
        setS(await r.json());
      } catch {
        // ignore
      }
    };
    tick();
    const t = setInterval(tick, 2000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  if (!s) return null;
  const bridge = s.bridge;
  const pending = s.pending;
  const proxied = !bridge && !!s.isProxied;
  const color = bridge
    ? pending > 0
      ? "bg-amber-400"
      : "bg-amber-500/70"
    : proxied
      ? "bg-sky-500"
      : "bg-emerald-500";
  const pulse = bridge && pending > 0 ? "animate-pulse" : "";
  const label = bridge
    ? pending > 0
      ? `Bridge · ${pending} pending`
      : "Bridge · idle"
    : proxied
      ? "via Claude Max"
      : "Anthropic API";
  return (
    <button
      onClick={() => {
        navigator.clipboard
          ?.writeText(JSON.stringify(s, null, 2))
          .catch(() => {});
      }}
      title={`${label} — click to copy full status JSON`}
      className="flex items-center gap-1 text-[10px] font-mono text-neutral-500 hover:text-neutral-200 transition-colors"
    >
      <span className={`h-1.5 w-1.5 rounded-full ${color} ${pulse}`} />
      <span className="hidden md:inline">{label}</span>
    </button>
  );
}
