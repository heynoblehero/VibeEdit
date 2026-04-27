"use client";

import { Check, Cloud } from "lucide-react";
import { useEffect, useState } from "react";
import { onStorageFlush } from "@/store/throttled-storage";

/**
 * Always-visible autosave indicator. Pulses '✓ saved' for 1.2s on
 * every throttled localStorage flush, then settles into a quieter
 * relative-time pill ('saved 12s ago' → '3m ago' → '2h ago'). Lets
 * the user trust that work is sticking without leaving a stale
 * 'unsaved' impression on long idle sessions.
 */
export function SaveIndicator() {
  const [flashing, setFlashing] = useState(false);
  const [lastSaved, setLastSaved] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    return onStorageFlush(() => {
      setFlashing(true);
      setLastSaved(Date.now());
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => setFlashing(false), 1200);
    });
  }, []);

  // Tick a clock so the relative label refreshes without a save event.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  if (flashing) {
    return (
      <span
        title="Project state saved to browser"
        className="flex items-center gap-1 text-[10px] text-emerald-400 font-mono"
      >
        <Check className="h-3 w-3" />
        saved
      </span>
    );
  }
  if (lastSaved === null) return null;
  const dt = Math.max(0, now - lastSaved);
  const sec = Math.floor(dt / 1000);
  const label =
    sec < 60
      ? `${sec}s`
      : sec < 3600
        ? `${Math.floor(sec / 60)}m`
        : `${Math.floor(sec / 3600)}h`;
  return (
    <span
      title={`Last saved ${new Date(lastSaved).toLocaleTimeString()}`}
      className="hidden md:flex items-center gap-1 text-[10px] text-neutral-500 font-mono"
    >
      <Cloud className="h-3 w-3" />
      {label}
    </span>
  );
}
