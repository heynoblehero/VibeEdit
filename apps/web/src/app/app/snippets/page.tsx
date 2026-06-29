"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import { Wordmark } from "@/components/Wordmark";

type Snippet = {
  id: string;
  label: string;
  sourceProjectId: string | null;
  isPublic: boolean;
  likesCount: number;
  createdAt: string;
  size: number;
};

export default function SnippetsPage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!isPending && !session) router.replace("/app/login");
  }, [isPending, session, router]);

  async function refresh() {
    const response = await fetch("/api/snippets");
    if (!response.ok) return;
    const data = (await response.json()) as { snippets: Snippet[] };
    setSnippets(data.snippets || []);
  }

  useEffect(() => {
    if (session) refresh();
  }, [session]);

  async function fork(snippet: Snippet) {
    if (busy) return;
    setBusy(snippet.id);
    try {
      const response = await fetch(`/api/snippets/${snippet.id}/fork`, {
        method: "POST",
      });
      if (!response.ok) return;
      const data = (await response.json()) as { id: string };
      router.push(`/app/projects/${data.id}/edit`);
    } finally {
      setBusy(null);
    }
  }

  async function remove(snippet: Snippet) {
    if (!confirm(`Delete snippet "${snippet.label}"?`)) return;
    await fetch(`/api/snippets?id=${snippet.id}`, { method: "DELETE" });
    refresh();
  }

  if (isPending || !session) return null;

  return (
    <main className="mx-auto max-w-4xl p-4 sm:p-8">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-3 sm:mb-10">
        <Link href="/app/projects">
          <Wordmark size="md" />
        </Link>
        <nav className="flex flex-wrap gap-3 text-sm">
          <Link
            href="/app/projects"
            className="text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
          >
            Projects
          </Link>
          <Link href="/app/snippets" className="text-[var(--color-accent)]">
            Snippets
          </Link>
        </nav>
      </header>

      <h1 className="mb-2 text-2xl font-bold sm:text-3xl">My snippets</h1>
      <p className="mb-8 max-w-2xl text-[var(--color-fg-muted)]">
        Save any project's composition as a personal starter. Fork it into a fresh project anytime.
      </p>

      {snippets.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--color-border)] p-8 text-center text-[var(--color-fg-muted)]">
          No snippets yet. Open a project and click{" "}
          <span className="font-medium text-[var(--color-fg)]">★ Save as snippet</span>.
        </div>
      ) : (
        <ul className="space-y-3">
          {snippets.map((snippet) => (
            <li
              key={snippet.id}
              className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:flex-nowrap sm:gap-4"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-semibold text-[var(--color-fg)]">
                    {snippet.label}
                  </span>
                  {snippet.isPublic && (
                    <span className="shrink-0 rounded-full bg-[var(--color-accent)]/15 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-[var(--color-accent)]">
                      Public
                    </span>
                  )}
                </div>
                <div className="mt-0.5 flex items-center gap-2 text-xs text-[var(--color-fg-muted)]">
                  <span>{new Date(snippet.createdAt).toLocaleString()}</span>
                  <span>·</span>
                  <span>{Math.round(snippet.size / 1024)}KB</span>
                  {snippet.isPublic && snippet.likesCount > 0 && (
                    <>
                      <span>·</span>
                      <span>
                        <span className="text-[var(--color-fg)]">{snippet.likesCount}</span> like
                        {snippet.likesCount === 1 ? "" : "s"}
                      </span>
                    </>
                  )}
                </div>
              </div>

              <button
                onClick={() => fork(snippet)}
                disabled={busy === snippet.id}
                className="shrink-0 rounded-lg bg-[var(--color-accent)] px-3 py-1.5 text-xs font-semibold text-black disabled:opacity-50"
              >
                {busy === snippet.id ? "Forking…" : "Fork"}
              </button>

              <button
                onClick={() => remove(snippet)}
                className="shrink-0 text-xs text-[var(--color-fg-subtle)] hover:text-[var(--color-danger)]"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
