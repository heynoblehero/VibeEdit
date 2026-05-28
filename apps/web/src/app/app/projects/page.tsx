"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "@/lib/auth-client";
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
  const [menuOpen, setMenuOpen] = useState(false);

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
      body: JSON.stringify({ name: name.trim() || "Untitled Project", seed }),
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
    const result = await fetch(`/api/projects/${id}/duplicate`, { method: "POST" });
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
      <main className="flex min-h-screen items-center justify-center">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--color-border)] border-t-[var(--color-accent)]" />
      </main>
    );
  }

  return (
    <>
      {showOnboarding && <Onboarding onDone={() => setShowOnboarding(false)} />}

      <div className="flex min-h-screen flex-col">
        {/* Top nav */}
        <header className="sticky top-0 z-10 border-b border-[var(--color-border)] bg-[var(--color-bg)]/90 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
            <Link
              href="/app/projects"
              className="text-base font-black tracking-tight text-[var(--color-fg)]"
            >
              VibeEdit
            </Link>

            <nav className="hidden items-center gap-1 text-sm sm:flex">
              <Link
                href="/app/projects"
                className="rounded-md px-3 py-1.5 text-[var(--color-accent)] font-medium"
              >
                Projects
              </Link>
              <Link
                href="/app/renders"
                className="rounded-md px-3 py-1.5 text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
              >
                Renders
              </Link>
              <Link
                href="/app/templates"
                className="rounded-md px-3 py-1.5 text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
              >
                Templates
              </Link>
              <Link
                href="/app/billing"
                className="rounded-md px-3 py-1.5 text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
              >
                Billing
              </Link>
            </nav>

            <div className="flex items-center gap-2">
              <UsageMeter compact />
              <div className="relative">
                <button
                  onClick={() => setMenuOpen((v) => !v)}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-surface)] border border-[var(--color-border)] text-xs font-bold uppercase text-[var(--color-accent)] hover:border-[var(--color-accent)] transition-colors"
                  aria-label="Account menu"
                >
                  {session.user.name?.[0] ?? session.user.email[0]}
                </button>
                {menuOpen && (
                  <div
                    className="absolute right-0 top-10 z-20 min-w-[180px] rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] py-1 shadow-2xl"
                    onBlur={() => setMenuOpen(false)}
                  >
                    <div className="border-b border-[var(--color-border)] px-3 py-2">
                      <div className="text-xs font-medium text-[var(--color-fg)]">
                        {session.user.name}
                      </div>
                      <div className="text-xs text-[var(--color-fg-muted)] truncate">
                        {session.user.email}
                      </div>
                    </div>
                    <Link
                      href="/app/settings/account"
                      onClick={() => setMenuOpen(false)}
                      className="block px-3 py-2 text-sm text-[var(--color-fg-muted)] hover:bg-[var(--color-bg-2)] hover:text-[var(--color-fg)]"
                    >
                      Settings
                    </Link>
                    <Link
                      href="/app/billing"
                      onClick={() => setMenuOpen(false)}
                      className="block px-3 py-2 text-sm text-[var(--color-fg-muted)] hover:bg-[var(--color-bg-2)] hover:text-[var(--color-fg)]"
                    >
                      Billing
                    </Link>
                    <button
                      onClick={async () => {
                        await signOut();
                        router.push("/");
                      }}
                      className="w-full px-3 py-2 text-left text-sm text-[var(--color-fg-muted)] hover:bg-[var(--color-bg-2)] hover:text-[var(--color-fg)]"
                    >
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
          {/* New project row */}
          <section className="mb-10">
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") create("empty");
                }}
                placeholder="Name your project (optional)…"
                className="max-w-xs flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-2)] px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--color-accent)]"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <NewProjectCard
                icon="✂"
                title="Edit footage"
                description="Upload clips and describe the edit — trim, grade, caption, export as MP4."
                accent={false}
                disabled={creating}
                onClick={() => create("empty")}
              />
              <NewProjectCard
                icon="✦"
                title="Create from scratch"
                description="Describe a scene and the AI builds every frame — motion graphics, voiceover, music."
                accent
                disabled={creating}
                onClick={() => create("empty")}
              />
            </div>

            <div className="mt-3 flex items-center justify-between">
              <p className="text-xs text-[var(--color-fg-muted)]">
                Both use the same project — the agent figures it out from your first message.
              </p>
              <Link
                href="/app/templates"
                className="text-xs text-[var(--color-accent)] hover:underline whitespace-nowrap"
              >
                Browse templates →
              </Link>
            </div>
          </section>

          {/* Project list */}
          <section>
            <div className="mb-5 flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-[var(--color-fg)]">
                Your projects
                {projects.length > 0 && (
                  <span className="ml-2 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-0.5 text-xs font-normal text-[var(--color-fg-muted)]">
                    {projects.length}
                  </span>
                )}
              </h2>
              {projects.length > 4 && (
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search…"
                  className="w-48 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-2)] px-3 py-1.5 text-sm outline-none focus:border-[var(--color-accent)]"
                />
              )}
            </div>

            {filtered.length === 0 && projects.length === 0 && (
              <div className="rounded-2xl border border-dashed border-[var(--color-border)] py-16 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] text-xl">
                  ✦
                </div>
                <p className="font-medium text-[var(--color-fg)]">No projects yet</p>
                <p className="mt-1 text-sm text-[var(--color-fg-muted)]">
                  Start a blank project above, or jump-start from a template.
                </p>
                <Link
                  href="/app/templates"
                  className="mt-4 inline-flex items-center gap-1.5 rounded-md border border-[var(--color-accent)]/40 bg-[var(--color-accent)]/5 px-4 py-2 text-sm font-medium text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10"
                >
                  Browse templates →
                </Link>
              </div>
            )}

            {filtered.length === 0 && projects.length > 0 && (
              <p className="text-sm text-[var(--color-fg-muted)]">No matches for "{search}".</p>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((p) => (
                <ProjectCard
                  key={p.id}
                  project={p}
                  renamingId={renamingId}
                  renameValue={renameValue}
                  onSetRename={(id) => {
                    setRenamingId(id);
                    setRenameValue(p.name);
                  }}
                  onRenameChange={setRenameValue}
                  onRenameCommit={() => rename(p.id)}
                  onRenameCancel={() => setRenamingId(null)}
                  onDuplicate={() => duplicate(p.id)}
                  onDelete={() => remove(p.id, p.name)}
                />
              ))}
            </div>
          </section>
        </main>
      </div>
    </>
  );
}

function NewProjectCard({
  icon,
  title,
  description,
  accent,
  disabled,
  onClick,
}: {
  icon: string;
  title: string;
  description: string;
  accent: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={`group flex items-start gap-4 rounded-2xl border p-5 text-left transition-all disabled:opacity-50 ${
        accent
          ? "border-[var(--color-accent)]/30 bg-[var(--color-accent)]/5 hover:border-[var(--color-accent)]/60 hover:bg-[var(--color-accent)]/8"
          : "border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-fg-muted)]"
      }`}
    >
      <div
        className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl ${
          accent
            ? "bg-[var(--color-accent)]/15 text-[var(--color-accent)]"
            : "bg-[var(--color-bg-2)] text-[var(--color-fg-muted)]"
        }`}
      >
        {icon}
      </div>
      <div>
        <div
          className={`font-semibold transition-colors ${
            accent
              ? "text-[var(--color-accent)]"
              : "text-[var(--color-fg)] group-hover:text-[var(--color-accent)]"
          }`}
        >
          {disabled ? "Creating…" : title}
        </div>
        <p className="mt-0.5 text-xs leading-relaxed text-[var(--color-fg-muted)]">{description}</p>
      </div>
    </button>
  );
}

function ProjectCard({
  project,
  renamingId,
  renameValue,
  onSetRename,
  onRenameChange,
  onRenameCommit,
  onRenameCancel,
  onDuplicate,
  onDelete,
}: {
  project: Project;
  renamingId: string | null;
  renameValue: string;
  onSetRename: (id: string) => void;
  onRenameChange: (value: string) => void;
  onRenameCommit: () => void;
  onRenameCancel: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const isRenaming = renamingId === project.id;

  return (
    <div className="group relative flex flex-col rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] transition-colors hover:border-[var(--color-fg-muted)]">
      {/* Thumbnail placeholder */}
      <Link
        href={`/app/projects/${project.id}/edit`}
        className="block h-32 w-full overflow-hidden rounded-t-2xl bg-[var(--color-bg-2)]"
        tabIndex={isRenaming ? -1 : 0}
      >
        <div className="flex h-full w-full items-center justify-center">
          <span className="text-3xl opacity-20">✦</span>
        </div>
      </Link>

      <div className="flex flex-1 flex-col gap-2 p-4">
        {isRenaming ? (
          <input
            autoFocus
            value={renameValue}
            onChange={(event) => onRenameChange(event.target.value)}
            onBlur={onRenameCommit}
            onKeyDown={(event) => {
              if (event.key === "Enter") onRenameCommit();
              if (event.key === "Escape") onRenameCancel();
            }}
            className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1 text-sm outline-none focus:border-[var(--color-accent)]"
          />
        ) : (
          <Link
            href={`/app/projects/${project.id}/edit`}
            className="line-clamp-1 text-sm font-semibold text-[var(--color-fg)] hover:text-[var(--color-accent)]"
          >
            {project.name}
          </Link>
        )}

        <div className="flex items-center justify-between">
          <div className="text-xs text-[var(--color-fg-muted)]">
            {relativeTime(project.updatedAt)}
            {(project.renderCount ?? 0) > 0 && (
              <span className="ml-2 rounded-full border border-[var(--color-border)] px-1.5 py-0.5">
                {project.renderCount} render{project.renderCount === 1 ? "" : "s"}
              </span>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
            <ActionBtn title="Rename" onClick={() => onSetRename(project.id)}>
              ✎
            </ActionBtn>
            <ActionBtn title="Duplicate" onClick={onDuplicate}>
              ⧉
            </ActionBtn>
            <ActionBtn title="Delete" onClick={onDelete} danger>
              ✕
            </ActionBtn>
          </div>
        </div>
      </div>
    </div>
  );
}

function ActionBtn({
  title,
  onClick,
  danger,
  children,
}: {
  title: string;
  onClick: () => void;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={`flex h-6 w-6 items-center justify-center rounded text-xs transition-colors ${
        danger
          ? "text-[var(--color-fg-muted)] hover:bg-red-500/10 hover:text-red-400"
          : "text-[var(--color-fg-muted)] hover:bg-[var(--color-bg)] hover:text-[var(--color-fg)]"
      }`}
    >
      {children}
    </button>
  );
}

function relativeTime(iso: string): string {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
