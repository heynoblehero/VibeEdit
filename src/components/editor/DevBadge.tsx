"use client";

import { useEffect, useState } from "react";

// Tiny "DEV" pill shown only when the page is served by the local dev server.
// Checked at runtime (not via NODE_ENV) so it works on Capacitor WebView too.
// Resolved after mount to keep SSR and first client render in sync.
export function DevBadge() {
  const [host, setHost] = useState<string | null>(null);
  useEffect(() => {
    setHost(window.location.hostname);
  }, []);
  if (host === null) return null;
  const isLocal =
    host === "localhost" ||
    host === "127.0.0.1" ||
    host.startsWith("192.168.") ||
    host.startsWith("10.") ||
    host.startsWith("172.16.") ||
    host.startsWith("172.17.") ||
    host.endsWith(".local");
  if (!isLocal) return null;
  return (
    <span
      title={`Running on ${host}`}
      className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-amber-500/20 border border-amber-500/40 text-amber-300"
    >
      DEV
    </span>
  );
}
