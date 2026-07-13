"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/Toast";

/**
 * Header control for the browser extension.
 *
 * Detects whether the VibeEdit extension is installed (its site-bridge content
 * script sets `data-vibeedit-extension` on <html> and posts a "present" message
 * reporting whether it already holds a token). When installed but not connected,
 * clicking mints a token and hands it to the extension in one step via
 * same-origin postMessage — no copy/paste. When not installed, it links to the
 * install instructions.
 */
export function ConnectExtension() {
  const toast = useToast();
  const [installed, setInstalled] = useState(false);
  const [connected, setConnected] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Attribute is set synchronously by the content script at document_start.
    if (document.documentElement.getAttribute("data-vibeedit-extension")) setInstalled(true);

    const onMessage = (event: MessageEvent) => {
      if (event.source !== window) return;
      const data = event.data as { source?: string; type?: string; connected?: boolean };
      if (data?.source !== "vibeedit-extension") return;
      if (data.type === "present") {
        setInstalled(true);
        if (data.connected) setConnected(true);
      }
      if (data.type === "connected") setConnected(true);
    };
    window.addEventListener("message", onMessage);
    // Nudge the extension to (re)announce in case it loaded after us.
    window.postMessage({ source: "vibeedit-site", type: "ping" }, window.location.origin);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  async function connect() {
    if (busy) return;
    setBusy(true);
    try {
      const response = await fetch("/api/extension-tokens", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "browser extension" }),
      });
      if (!response.ok) {
        toast.error("Couldn't create a connection token.");
        return;
      }
      const { token } = (await response.json()) as { token: string };

      const connectedPromise = new Promise<boolean>((resolve) => {
        const onMessage = (event: MessageEvent) => {
          if (event.source !== window) return;
          const data = event.data as { source?: string; type?: string };
          if (data?.source === "vibeedit-extension" && data.type === "connected") {
            window.removeEventListener("message", onMessage);
            resolve(true);
          }
        };
        window.addEventListener("message", onMessage);
        setTimeout(() => {
          window.removeEventListener("message", onMessage);
          resolve(false);
        }, 4000);
      });

      window.postMessage(
        {
          source: "vibeedit-site",
          type: "connect",
          token,
          apiBase: window.location.origin,
        },
        window.location.origin,
      );

      const ok = await connectedPromise;
      if (ok) {
        setConnected(true);
        toast.success("Extension connected.");
      } else {
        toast.error("Connection timed out — reload the extension and try again.");
      }
    } finally {
      setBusy(false);
    }
  }

  // Not installed → prompt to get it.
  if (!installed) {
    return (
      <a
        href="/app/settings/extension"
        className="hidden items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1.5 text-xs font-medium text-[var(--color-fg-muted)] transition-colors hover:border-[var(--color-accent)]/40 hover:text-[var(--color-fg)] sm:flex"
        title="Grab the VibeEdit browser extension"
      >
        <ExtensionIcon />
        Get extension
      </a>
    );
  }

  if (connected) {
    return (
      <span
        className="hidden items-center gap-1.5 rounded-lg border border-[var(--color-accent)]/40 bg-[var(--color-accent)]/10 px-2.5 py-1.5 text-xs font-semibold text-[var(--color-accent)] sm:flex"
        title="The browser extension is connected to your account"
      >
        <ExtensionIcon />
        Extension connected
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={connect}
      disabled={busy}
      className="hidden items-center gap-1.5 rounded-lg border border-[var(--color-accent)]/50 bg-[var(--color-accent)] px-2.5 py-1.5 text-xs font-bold text-black transition-opacity hover:opacity-90 disabled:opacity-60 sm:flex"
      title="Connect the installed extension to your account"
    >
      <ExtensionIcon />
      {busy ? "Connecting…" : "Connect extension"}
    </button>
  );
}

function ExtensionIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 3h4v3a2 2 0 0 0 4 0V3h4v4h-3a2 2 0 0 0 0 4h3v6a2 2 0 0 1-2 2h-4v-3a2 2 0 0 0-4 0v3H6a2 2 0 0 1-2-2v-4H1" />
    </svg>
  );
}
