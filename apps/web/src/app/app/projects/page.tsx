"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "@/lib/auth-client";
import { Wordmark } from "@/components/Wordmark";
import { UsageMeter } from "@/components/UsageMeter";
import { Onboarding } from "@/components/Onboarding";

type Project = {
  id: string;
  name: string;
  updatedAt: string;
  renderCount?: number;
  lastRenderAt?: string | null;
};

export default function ProjectsPage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [projects, setProjects] = useState<Project[]>([]);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [search, setSearch] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    if (!session) return;
    fetch("/api/onboarding")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && !data.onboardingCompleted) setShowOnboarding(true);
      });
  }, [session]);

  useEffect(() => {
    if (!isPending && !session) router.replace("/app/login");
  }, [isPending, session, router]);

  async function refresh() {
    const result = await fetch("/api/projects");
    if (!result.ok) return;
    const json = (await result.json()) as { projects: Project[] };
    setProjects(json.projects);
  }

  useEffect(() => {
    if (session) refresh();
  }, [session]);

  async function create(seed: "isaac" | "empty") {
    setCreating(true);
    const result = await fetch("/api/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: name || "Untitled Project", seed }),
    });
    setCreating(false);
    if (!result.ok) return;
    const { id } = (await result.json()) as { id: string };
    router.push(`/app/projects/${id}/edit`);
  }

  async function rename(id: string) {
    if (!renameValue.trim()) {
      setRenamingId(null);
      return;
    }
    await fetch(`/api/projects/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: renameValue.trim() }),
    });
    setRenamingId(null);
    refresh();
  }

  async function duplicate(id: string) {
    const result = await fetch(`/api/projects/${id}/duplicate`, {
      method: "POST",
    });
    if (!result.ok) return;
    refresh();
  }

  async function remove(id: string, projectName: string) {
    if (!confirm(`Delete "${projectName}"? This cannot be undone.`)) return;
    await fetch(`/api/projects/${id}`, { method: "DELETE" });
    refresh();
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter((p) => p.name.toLowerCase().includes(q));
  }, [projects, search]);

  if (isPending || !session) {
    return (
      <main className="flex min-h-screen items-center justify-center text-[var(--color-fg-muted)]">
        Loading...
      </main>
    );
  }

  return (
    <>
      {showOnboarding && <Onboarding onDone={() => setShowOnboarding(false)} />}
      <main className="mx-auto max-w-5xl p-4 sm:p-8">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-3 sm:mb-10">
          <Wordmark size="md" />
          <div className="flex flex-wrap items-center gap-2 text-sm text-[var(--color-fg-muted)] sm:gap-3">
            <UsageMeter compact />
            <Link href="/app/templates" className="hidden hover:text-[var(--color-fg)] sm:inline">
              Templates
            </Link>
            <Link href="/app/renders" className="hover:text-[var(--color-fg)]">
              Renders
            </Link>
            <Link href="/app/billing" className="hover:text-[var(--color-fg)]">
              Billing
            </Link>
            <span className="hidden md:inline">{session.user.email}</span>
            <button
              onClick={async () => {
                await signOut();
                router.push("/");
              }}
              className="rounded-md border border-[var(--color-border)] px-3 py-1 hover:bg-[var(--color-surface)]"
            >
              Sign out
            </button>
          </div>
        </header>

        <h1 className="mb-6 text-2xl font-bold sm:text-3xl">Your projects</h1>

        <section className="mb-8">
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") create("empty");
              }}
              placeholder="New project name…"
              className="flex-1 min-w-[200px] max-w-sm rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 outline-none focus:border-[var(--color-accent)]"
            />
            <button
              disabled={creating}
              onClick={() => create("empty")}
              className="rounded-md bg-[var(--color-accent)] px-4 py-2 font-semibold text-black hover:opacity-90 disabled:opacity-50"
            >
              {creating ? "Creating…" : "New project"}
            </button>
            <Link
              href="/app/templates"
              className="rounded-md border border-[var(--color-border)] px-4 py-2 text-sm hover:bg-[var(--color-surface)]"
            >
              Templates
            </Link>
          </div>
          <p className="mt-2 text-xs text-[var(--color-fg-muted)]">
            Drop footage or describe a video — the agent handles the rest.
          </p>
        </section>

        <section>
          <div className="mb-4 flex items-center justify-between gap-3">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search projects..."
              className="w-64 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
            />
            <span className="text-xs text-[var(--color-fg-muted)]">
              {filtered.length} / {projects.length}
            </span>
          </div>

          {filtered.length === 0 && projects.length === 0 && (
            <div className="rounded-lg border border-dashed border-[var(--color-border)] p-8 text-center text-[var(--color-fg-muted)]">
              No projects yet. Create one above.
            </div>
          )}
          {filtered.length === 0 && projects.length > 0 && (
            <div className="text-sm text-[var(--color-fg-muted)]">No matches for "{search}".</div>
          )}

          <ul className="space-y-2">
            {filtered.map((p) => (
              <li
                key={p.id}
                className="group flex flex-wrap items-center gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 hover:border-[var(--color-fg-muted)] sm:flex-nowrap"
              >
                {renamingId === p.id ? (
                  <input
                    autoFocus
                    value={renameValue}
                    onChange={(event) => setRenameValue(event.target.value)}
                    onBlur={() => rename(p.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") rename(p.id);
                      if (event.key === "Escape") setRenamingId(null);
                    }}
                    className="flex-1 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1 text-sm"
                  />
                ) : (
                  <Link href={`/app/projects/${p.id}/edit`} className="flex-1 font-medium">
                    {p.name}
                  </Link>
                )}
                <span className="flex flex-col items-end text-xs text-[var(--color-fg-muted)]">
                  <span>{new Date(p.updatedAt).toLocaleDateString()}</span>
                  {(p.renderCount ?? 0) > 0 && (
                    <span className="text-[10px]">
                      {p.renderCount} render
                      {p.renderCount === 1 ? "" : "s"}
                      {p.lastRenderAt ? ` · last ${relativeTime(p.lastRenderAt)}` : ""}
                    </span>
                  )}
                </span>
                <div className="flex gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
                  <button
                    onClick={() => {
                      setRenamingId(p.id);
                      setRenameValue(p.name);
                    }}
                    className="rounded px-2 py-1 text-xs text-[var(--color-fg-muted)] hover:bg-[var(--color-bg)] hover:text-[var(--color-fg)]"
                    title="Rename"
                  >
                    Rename
                  </button>
                  <button
                    onClick={() => duplicate(p.id)}
                    className="rounded px-2 py-1 text-xs text-[var(--color-fg-muted)] hover:bg-[var(--color-bg)] hover:text-[var(--color-fg)]"
                    title="Duplicate"
                  >
                    Duplicate
                  </button>
                  <button
                    onClick={() => remove(p.id, p.name)}
                    className="rounded px-2 py-1 text-xs text-[var(--color-fg-muted)] hover:bg-[var(--color-bg)] hover:text-[var(--color-danger)]"
                    title="Delete"
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </>
  );
}

function relativeTime(iso: string): string {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
