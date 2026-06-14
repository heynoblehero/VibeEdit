"use client";

import { useEffect, useRef, useState } from "react";
import { editActionsFor, runAssetAction } from "@/lib/asset-actions";

// A compact "Edit with AI" dropdown for a single asset. The agent already has
// the footage pipeline; this just makes the actions discoverable per file.
export function AssetEditMenu({
  path,
  compact,
  onFired,
}: {
  path: string;
  // compact = icon-only trigger (used on hover overlays); otherwise a labelled pill.
  compact?: boolean;
  onFired?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const actions = editActionsFor(path);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        title="Edit with AI"
        className={
          compact
            ? "pointer-events-auto flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-black shadow-lg transition-transform hover:scale-105"
            : "flex items-center gap-1 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-2)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--color-fg-muted)] transition-colors hover:border-[var(--color-accent)]/50 hover:text-[var(--color-fg)]"
        }
      >
        <svg
          width={compact ? "12" : "10"}
          height={compact ? "12" : "10"}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M5 3v4M3 5h4M6 17v4M4 19h4M13 3l2.5 6.5L22 12l-6.5 2.5L13 21l-2.5-6.5L4 12l6.5-2.5L13 3z" />
        </svg>
        {!compact && "Edit with AI"}
      </button>

      {open && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute bottom-full right-0 z-50 mb-1 w-48 overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl"
        >
          <div className="border-b border-[var(--color-border)] px-3 py-1.5 text-[9px] font-semibold uppercase tracking-[0.1em] text-[var(--color-fg-subtle)]">
            Edit with AI
          </div>
          {actions.map((action) => (
            <button
              key={action.label}
              onClick={() => {
                setOpen(false);
                runAssetAction(action, path);
                onFired?.();
              }}
              className="block w-full px-3 py-2 text-left text-xs text-[var(--color-fg)] transition-colors hover:bg-[var(--color-bg-2)]"
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Small badge marking whether an asset was uploaded by the user or made by AI.
export function SourceBadge({ source }: { source: "upload" | "ai" }) {
  return (
    <span
      title={source === "ai" ? "Created by AI" : "Uploaded by you"}
      className={`rounded px-1 py-0.5 text-[8px] font-semibold uppercase tracking-wide ${
        source === "ai"
          ? "bg-[var(--color-accent)]/15 text-[var(--color-accent)]"
          : "bg-[var(--color-fg-subtle)]/15 text-[var(--color-fg-muted)]"
      }`}
    >
      {source === "ai" ? "AI" : "Upload"}
    </span>
  );
}
