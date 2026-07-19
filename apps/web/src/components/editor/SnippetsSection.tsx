"use client";

import { useEffect, useState } from "react";

type Snippet = {
  id: string;
  label: string;
  sourceProjectId: string | null;
  isPublic: boolean;
  likesCount: number;
  createdAt: string;
  size: number;
};

/**
 * In-editor Snippets source. The project is already open, so clicking a saved
 * snippet asks the agent to fold that composition into the current project via
 * a vibeedit:send-prompt event — mirroring how EffectsPanel hands work to Chat.
 */
export function SnippetsSection({ projectId }: { projectId: string }) {
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [loading, setLoading] = useState(true);
  const [appliedId, setAppliedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/snippets")
      .then((response) => (response.ok ? response.json() : { snippets: [] }))
      .then((data) => {
        if (!cancelled) setSnippets((data.snippets as Snippet[]) || []);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function apply(snippet: Snippet) {
    const text = `Use my saved snippet "${snippet.label}" (snippet id: ${snippet.id}) as the basis for this video — load its composition and adapt it into the current project (${projectId}).`;
    window.dispatchEvent(new CustomEvent("vibeedit:send-prompt", { detail: { text } }));
    // Jump to the chat on mobile so the user sees the agent pick it up.
    window.dispatchEvent(new CustomEvent("vibeedit:focus-chat"));
    setAppliedId(snippet.id);
    setTimeout(() => setAppliedId((current) => (current === snippet.id ? null : current)), 1600);
  }

  if (loading) {
    return <p className="px-3 py-4 text-[11px] text-[var(--color-fg-subtle)]">Loading snippets…</p>;
  }

  if (snippets.length === 0) {
    return (
      <p className="px-3 py-4 text-[11px] leading-relaxed text-[var(--color-fg-subtle)]">
        No snippets yet — save one from a project's ⋯ menu.
      </p>
    );
  }

  return (
    <div className="flex flex-col">
      <p className="px-3 pt-2.5 text-[11px] text-[var(--color-fg-subtle)]">
        Click a snippet to have the AI reuse it in this video.
      </p>

      <ul className="flex flex-col gap-1.5 p-3">
        {snippets.map((snippet) => {
          const applied = appliedId === snippet.id;
          return (
            <li key={snippet.id}>
              <button
                type="button"
                onClick={() => apply(snippet)}
                title={`Reuse "${snippet.label}" in this video`}
                className="group flex w-full items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-2 text-left transition-colors hover:border-[var(--color-accent)]/50"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[var(--color-bg-2)] text-[var(--color-fg-subtle)]">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M16 3H5a2 2 0 0 0-2 2v14" />
                    <path d="M21 8a2 2 0 0 0-2-2H9a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2z" />
                  </svg>
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[11px] font-medium text-[var(--color-fg)]">
                    {snippet.label}
                  </span>
                  <span className="flex items-center gap-1.5 text-[9px] text-[var(--color-fg-subtle)]">
                    <span>{new Date(snippet.createdAt).toLocaleDateString()}</span>
                    <span aria-hidden="true">·</span>
                    <span>{Math.round(snippet.size / 1024)}KB</span>
                    {snippet.isPublic && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="text-[var(--color-accent)]">Public</span>
                      </>
                    )}
                  </span>
                </span>
                {applied && (
                  <span className="shrink-0 text-[10px] font-semibold text-[var(--color-accent)]">
                    Sent ✓
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
