"use client";

import { useEffect, useState } from "react";

interface Status {
  bridge: boolean;
  hasAnthropicKey: boolean;
  pending: number;
}

// Polls /api/bridge/status every 2s. Shows a tiny dot in the header:
//   green steady   → real API mode, key set
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
  const color = bridge ? (pending > 0 ? "bg-amber-400" : "bg-amber-500/70") : "bg-emerald-500";
  const pulse = bridge && pending > 0 ? "animate-pulse" : "";
  const label = bridge
    ? pending > 0
      ? `Bridge · ${pending} pending`
      : "Bridge · idle"
    : "Anthropic API";
  return (
    <span
      title={label}
      className="flex items-center gap-1 text-[10px] font-mono text-neutral-500"
    >
      <span className={`h-1.5 w-1.5 rounded-full ${color} ${pulse}`} />
      <span className="hidden md:inline">{label}</span>
    </span>
  );
}
