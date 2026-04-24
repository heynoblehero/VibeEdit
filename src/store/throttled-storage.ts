// A tiny throttled wrapper around localStorage. Zustand's persist middleware
// fires setItem on every state change; for our project store (mutated on
// every keystroke via the agent), that was thrashing localStorage. We
// throttle per key so at most one write per 300ms.

import type { StateStorage } from "zustand/middleware";

const FLUSH_MS = 300;
const pending = new Map<string, { value: string; timer: ReturnType<typeof setTimeout> }>();

// UI can subscribe to know when we've actually flushed a write — used to
// flash a "Saved" indicator.
const flushListeners = new Set<() => void>();
export function onStorageFlush(cb: () => void): () => void {
  flushListeners.add(cb);
  return () => {
    flushListeners.delete(cb);
  };
}

export function throttledLocalStorage(): StateStorage {
  return {
    getItem: (name) =>
      typeof window === "undefined" ? null : window.localStorage.getItem(name),
    setItem: (name, value) => {
      if (typeof window === "undefined") return;
      const existing = pending.get(name);
      if (existing) clearTimeout(existing.timer);
      const timer = setTimeout(() => {
        pending.delete(name);
        try {
          window.localStorage.setItem(name, value);
        } catch {
          // storage full or blocked — ignore
        }
        for (const cb of flushListeners) cb();
      }, FLUSH_MS);
      pending.set(name, { value, timer });
    },
    removeItem: (name) => {
      if (typeof window === "undefined") return;
      const existing = pending.get(name);
      if (existing) clearTimeout(existing.timer);
      pending.delete(name);
      window.localStorage.removeItem(name);
    },
  };
}
