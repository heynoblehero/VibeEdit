"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getApiKey } from "@/lib/api-keys/store";

const DISMISS_KEY = "vibeedit:keybanner-dismissed";

/**
 * Gentle BYOK nudge shown in the editor when the user hasn't added a generation
 * key yet. Replicate covers images, b-roll video, and background removal, so its
 * absence is the signal that AI generation is locked. Chat/editing/renders work
 * without any key, so this is a nudge, not a gate — and it's dismissible.
 */
export function KeySetupBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(DISMISS_KEY) === "1") return;
    if (!getApiKey("replicate")) setShow(true);
  }, []);

  if (!show) return null;

  return (
    <div className="flex items-center gap-2 border-b border-[var(--color-border)] bg-[var(--color-accent)]/8 px-3 py-2 text-xs text-[var(--color-fg)]">
      <span aria-hidden="true">🔑</span>
      <span className="flex-1 min-w-0">
        Add your own API keys to generate AI images, video &amp; voiceover — chat and editing work
        without them.
      </span>
      <Link
        href="/app/settings/api-keys"
        className="shrink-0 rounded-md bg-[var(--color-accent)] px-2.5 py-1 font-semibold text-black transition-opacity hover:opacity-90"
      >
        Add keys
      </Link>
      <button
        type="button"
        onClick={() => {
          localStorage.setItem(DISMISS_KEY, "1");
          setShow(false);
        }}
        aria-label="Dismiss"
        className="shrink-0 rounded-md px-1.5 py-1 text-[var(--color-fg-muted)] transition-colors hover:text-[var(--color-fg)]"
      >
        ✕
      </button>
    </div>
  );
}
