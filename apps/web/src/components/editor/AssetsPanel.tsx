"use client";

import { useState } from "react";
import { EditHistory } from "./EditHistory";
import { FilesDrawer } from "./FilesDrawer";
import { EffectsPanel } from "./EffectsPanel";

type Source = "mine" | "store";

/**
 * Unified Assets tab: the user's own files and the Store live under one roof,
 * switched with a Mine / Store segmented control. One mental model — "what can
 * I drop into this video?" — instead of two separate tabs.
 */
export function AssetsPanel({ projectId, reloadKey }: { projectId: string; reloadKey: number }) {
  const [source, setSource] = useState<Source>("mine");

  const tabs: Array<{ id: Source; label: string; icon: React.ReactNode }> = [
    {
      id: "mine",
      label: "My files",
      icon: (
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
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
        </svg>
      ),
    },
    {
      id: "store",
      label: "Store",
      icon: (
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
          <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="flex flex-col">
      <div className="sticky top-0 z-10 flex gap-1.5 border-b border-[var(--color-border)] bg-[var(--color-bg)] p-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setSource(tab.id)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              source === tab.id
                ? "bg-[var(--color-accent)] text-black shadow-[var(--glow-accent-sm)]"
                : "text-[var(--color-fg-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-fg)]"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {source === "mine" ? (
        <>
          <EditHistory projectId={projectId} />
          <FilesDrawer projectId={projectId} reloadKey={reloadKey} />
        </>
      ) : (
        <EffectsPanel />
      )}
    </div>
  );
}
