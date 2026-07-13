"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import { Wordmark } from "@/components/Wordmark";

type Reference = {
  id: string;
  kind: string;
  title: string;
  uploader: string | null;
  sourceUrl: string | null;
  durationSeconds: number | null;
  rightsBasis: string;
  hasThumb: boolean;
  createdAt: string;
};

type Project = { id: string; name: string };

const RIGHTS_LABEL: Record<string, string> = {
  "reference-only": "Reference only",
  "owner-attested": "Licensed / owned",
  cc: "Creative Commons",
};

export default function ReferencesPage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [references, setReferences] = useState<Reference[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!isPending && !session) router.replace("/app/login");
  }, [isPending, session, router]);

  async function refresh() {
    const [refRes, projRes] = await Promise.all([fetch("/api/references"), fetch("/api/projects")]);
    if (refRes.ok) setReferences(((await refRes.json()).references as Reference[]) || []);
    if (projRes.ok) setProjects(((await projRes.json()).projects as Project[]) || []);
  }

  useEffect(() => {
    if (session) refresh();
  }, [session]);

  async function addToProject(ref: Reference, projectId: string, recreate: boolean) {
    if (!projectId || busy) return;
    setBusy(ref.id);
    try {
      const response = await fetch(`/api/references/${ref.id}/add-to-project`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      if (!response.ok) return;
      if (recreate) {
        // Seed the editor's chat with a recreate prompt (Chat reads this key).
        const handle = ref.title || "the clip";
        localStorage.setItem(
          `vibeedit:seed:${projectId}`,
          `Recreate the style of the reference clip "${handle}" as an original composition — ` +
            `study its pacing, color grade, typography, and effects, then rebuild it as my own version.`,
        );
      }
      router.push(`/app/projects/${projectId}/edit`);
    } finally {
      setBusy(null);
    }
  }

  async function remove(ref: Reference) {
    if (!confirm(`Delete "${ref.title}" from your library?`)) return;
    await fetch(`/api/references?id=${ref.id}`, { method: "DELETE" });
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
          <Link
            href="/app/snippets"
            className="text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
          >
            Snippets
          </Link>
          <Link href="/app/references" className="text-[var(--color-accent)]">
            References
          </Link>
        </nav>
      </header>

      <h1 className="mb-2 text-2xl font-bold sm:text-3xl">Reference library</h1>
      <p className="mb-8 max-w-2xl text-[var(--color-fg-muted)]">
        Clips you saved from videos you like. Drop one into any project, or have the AI recreate its
        style as your own original version.
      </p>

      {references.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--color-border)] p-8 text-center text-[var(--color-fg-muted)]">
          Nothing saved yet. In the editor, click the{" "}
          <span className="font-medium text-[var(--color-fg)]">link icon</span> to import a clip
          from a URL and tick{" "}
          <span className="font-medium text-[var(--color-fg)]">Save to library</span>.
        </div>
      ) : (
        <ul className="space-y-3">
          {references.map((ref) => (
            <li
              key={ref.id}
              className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:flex-nowrap sm:gap-4"
            >
              {ref.hasThumb ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`/api/references/${ref.id}/thumb`}
                  alt=""
                  className="h-14 w-24 flex-shrink-0 rounded object-cover"
                />
              ) : (
                <div className="h-14 w-24 flex-shrink-0 rounded bg-[var(--color-bg)]" />
              )}

              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold text-[var(--color-fg)]">{ref.title}</div>
                <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-[var(--color-fg-muted)]">
                  {ref.uploader && <span>{ref.uploader}</span>}
                  {ref.durationSeconds != null && <span>{Math.round(ref.durationSeconds)}s</span>}
                  <span className="rounded-full bg-[var(--color-bg)] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide">
                    {RIGHTS_LABEL[ref.rightsBasis] ?? ref.rightsBasis}
                  </span>
                </div>
              </div>

              <select
                defaultValue=""
                disabled={busy === ref.id || projects.length === 0}
                onChange={(event) => addToProject(ref, event.target.value, false)}
                className="shrink-0 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5 text-xs text-[var(--color-fg)]"
                title="Add this clip to a project"
              >
                <option value="" disabled>
                  Add to project…
                </option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>

              <select
                defaultValue=""
                disabled={busy === ref.id || projects.length === 0}
                onChange={(event) => addToProject(ref, event.target.value, true)}
                className="shrink-0 rounded-lg border border-[var(--color-accent)] bg-[var(--color-accent)]/8 px-2 py-1.5 text-xs font-semibold text-[var(--color-accent)]"
                title="Recreate this clip's style in a project"
              >
                <option value="" disabled>
                  Recreate in…
                </option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>

              <button
                onClick={() => remove(ref)}
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
