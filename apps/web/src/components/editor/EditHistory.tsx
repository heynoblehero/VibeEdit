"use client";

import { useCallback, useEffect, useState } from "react";

type EditState = {
  canUndo: boolean;
  undoSteps: number;
  summary: string | null;
  hasEdits: boolean;
};

// Drive an edit through the existing agent loop (which handles the re-render)
// rather than mutating project-state behind the agent's back.
function sendPrompt(text: string) {
  window.dispatchEvent(new CustomEvent("vibeedit:send-prompt", { detail: { text } }));
  // Mobile: jump to the chat so the user sees the agent run.
  window.dispatchEvent(new CustomEvent("vibeedit:focus-chat"));
}

const QUICK_ACTIONS: Array<{ label: string; prompt: string }> = [
  { label: "Make it tighter", prompt: "Make it tighter — cut filler and dead air." },
  { label: "Add captions", prompt: "Add captions." },
];

export function EditHistory({ projectId }: { projectId: string }) {
  const [state, setState] = useState<EditState | null>(null);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch(`/api/projects/${projectId}/edit-state`);
      if (!r.ok) return;
      setState((await r.json()) as EditState);
    } catch {
      // non-fatal — leave the last known state in place
    }
  }, [projectId]);

  // Refresh on mount, on a light interval, and whenever the agent finishes a
  // turn (that's when an edit may have just been applied / undone).
  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 15000);
    function onStatus(e: Event) {
      const detail = (e as CustomEvent<{ working: boolean }>).detail;
      if (!detail?.working) refresh();
    }
    window.addEventListener("vibeedit:agent-status", onStatus);
    return () => {
      clearInterval(interval);
      window.removeEventListener("vibeedit:agent-status", onStatus);
    };
  }, [refresh]);

  const canUndo = state?.canUndo ?? false;

  return (
    <div className="border-b border-[var(--color-border)] p-4">
      <div className="mb-3 flex items-center gap-1.5">
        <svg
          width="11"
          height="11"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-[var(--color-accent)]"
          aria-hidden="true"
        >
          <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
          <path d="M3 3v5h5" />
          <path d="M12 7v5l4 2" />
        </svg>
        <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--color-fg-subtle)]">
          Edits
        </span>
      </div>

      <p className="mb-3 text-[11px] leading-relaxed text-[var(--color-fg-muted)]">
        {state?.hasEdits && state.summary
          ? state.summary
          : "No edits yet — just tell the chat what to change."}
      </p>

      <button
        onClick={() => sendPrompt("Undo the last edit.")}
        disabled={!canUndo}
        title={canUndo ? "Undo the last edit" : "Nothing to undo yet"}
        className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-xs font-medium text-[var(--color-fg)] transition-colors hover:border-[var(--color-accent)]/40 hover:bg-[var(--color-surface-2)] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-[var(--color-border)] disabled:hover:bg-[var(--color-surface)]"
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M9 14L4 9l5-5" />
          <path d="M4 9h11a5 5 0 0 1 0 10h-3" />
        </svg>
        Undo last edit
      </button>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {QUICK_ACTIONS.map(({ label, prompt }) => (
          <button
            key={label}
            onClick={() => sendPrompt(prompt)}
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1 text-[10px] font-medium text-[var(--color-fg-muted)] transition-colors hover:border-[var(--color-accent)]/40 hover:text-[var(--color-fg)]"
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
