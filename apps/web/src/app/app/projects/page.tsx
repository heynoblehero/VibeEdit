"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "@/lib/auth-client";
import { UsageMeter } from "@/components/UsageMeter";
import { Onboarding } from "@/components/Onboarding";
import { Wordmark } from "@/components/Wordmark";
import { ConnectExtension } from "@/components/ConnectExtension";
import { useToast } from "@/components/Toast";

type Project = {
  id: string;
  name: string;
  updatedAt: string;
  platform?: string;
  aspectRatio?: string;
  renderCount?: number;
  lastRenderAt?: string | null;
};

/* Deterministic gradient from project id */
const GRADIENTS = [
  "from-violet-900/80 via-purple-900/60 to-indigo-950",
  "from-emerald-900/80 via-teal-900/60 to-cyan-950",
  "from-orange-900/80 via-amber-900/60 to-yellow-950",
  "from-rose-900/80 via-pink-900/60 to-fuchsia-950",
  "from-sky-900/80 via-blue-900/60 to-indigo-950",
  "from-lime-900/80 via-green-900/60 to-emerald-950",
  "from-red-900/80 via-rose-900/60 to-pink-950",
  "from-cyan-900/80 via-teal-900/60 to-emerald-950",
];

function projectGradient(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xffffffff;
  return GRADIENTS[Math.abs(h) % GRADIENTS.length];
}

const PLATFORM_META: Record<
  string,
  { label: string; ratio: string; shortLabel: string; color: string }
> = {
  youtube: {
    label: "YouTube",
    shortLabel: "YT",
    ratio: "16:9",
    color: "bg-red-500/20 text-red-400 border-red-500/20",
  },
  tiktok: {
    label: "TikTok",
    shortLabel: "TT",
    ratio: "9:16",
    color: "bg-pink-500/20 text-pink-400 border-pink-500/20",
  },
  instagram: {
    label: "Instagram",
    shortLabel: "IG",
    ratio: "1:1",
    color: "bg-purple-500/20 text-purple-400 border-purple-500/20",
  },
  linkedin: {
    label: "LinkedIn",
    shortLabel: "LI",
    ratio: "16:9",
    color: "bg-blue-500/20 text-blue-400 border-blue-500/20",
  },
};

const NAV_LINKS = [
  { href: "/app/projects", label: "Projects" },
  { href: "/app/renders", label: "Renders" },
  { href: "/app/effects", label: "Effects" },
  { href: "/app/billing", label: "Billing" },
];

export default function ProjectsPage() {
  const router = useRouter();
  const toast = useToast();
  const { data: session, isPending } = useSession();
  const [projects, setProjects] = useState<Project[]>([]);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [search, setSearch] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [platform, setPlatform] = useState<"youtube" | "tiktok" | "instagram" | "linkedin">(
    "youtube",
  );

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
    setProjectsLoading(false);
  }

  useEffect(() => {
    if (session) refresh();
  }, [session]);

  async function create() {
    setCreating(true);
    setCreateError(null);
    try {
      const meta = PLATFORM_META[platform];
      const result = await fetch("/api/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          // Blank name → the server auto-generates one from the description.
          name: name.trim(),
          description: description.trim(),
          platform,
          aspectRatio: meta.ratio,
        }),
      });
      if (!result.ok) {
        const msg = await result.text().catch(() => "Unknown error");
        setCreateError(msg || `Server error ${result.status}`);
        toast.error("Couldn't create project. Please try again.");
        return;
      }
      const { id } = (await result.json()) as { id: string };
      // Hand the description to the editor as the seeded first message (the
      // unified "describe it" step). Chat reads + clears this on mount.
      const desc = description.trim();
      if (desc) {
        try {
          localStorage.setItem(`vibeedit:seed:${id}`, desc);
        } catch {
          // non-fatal
        }
      }
      router.push(`/app/projects/${id}/edit`);
    } catch (err) {
      setCreateError((err as Error).message || "Could not create project — check your connection.");
      toast.error("Could not create project — check your connection.");
    } finally {
      setCreating(false);
    }
  }

  async function rename(id: string) {
    const next = renameValue.trim();
    setRenamingId(null);
    if (!next) return;
    const prev = projects;
    const before = prev.find((p) => p.id === id)?.name;
    if (next === before) return;
    // Optimistic: update the name in place, roll back if the request fails.
    setProjects((current) => current.map((p) => (p.id === id ? { ...p, name: next } : p)));
    try {
      const res = await fetch(`/api/projects/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: next }),
      });
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      toast.success("Project renamed");
    } catch {
      setProjects(prev);
      toast.error("Couldn't rename project — change reverted.");
    }
  }

  async function duplicate(id: string) {
    try {
      const result = await fetch(`/api/projects/${id}/duplicate`, { method: "POST" });
      if (!result.ok) throw new Error(`Server error ${result.status}`);
      await refresh();
      toast.success("Project duplicated");
    } catch {
      toast.error("Couldn't duplicate project. Please try again.");
    }
  }

  async function remove(id: string, projectName: string) {
    if (!confirm(`Delete "${projectName}"? This cannot be undone.`)) return;
    const prev = projects;
    // Optimistic: remove the card immediately, restore it on failure.
    setProjects((current) => current.filter((p) => p.id !== id));
    try {
      const res = await fetch(`/api/projects/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      toast.success(`Deleted "${projectName}"`);
    } catch {
      setProjects(prev);
      toast.error("Couldn't delete project — it's been restored.");
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter((p) => p.name.toLowerCase().includes(q));
  }, [projects, search]);

  const menuButtonRef = useRef<HTMLButtonElement>(null);

  // Close account menu on outside click or Esc; return focus to the trigger.
  useEffect(() => {
    if (!menuOpen) return;
    function onPointer(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-account-menu]")) setMenuOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setMenuOpen(false);
        menuButtonRef.current?.focus();
      }
    }
    window.addEventListener("mousedown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  if (isPending || !session) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--color-border)] border-t-[var(--color-accent)]" />
      </main>
    );
  }

  const userInitial = (session.user.name?.[0] ?? session.user.email[0]).toUpperCase();

  return (
    <>
      {showOnboarding && <Onboarding onDone={() => setShowOnboarding(false)} />}

      <div className="flex min-h-screen flex-col bg-[var(--color-bg)]">
        {/* ── Header ─────────────────────────────────────────────── */}
        <header className="sticky top-0 z-20 border-b border-[var(--color-border)] bg-[var(--color-bg)]/90 backdrop-blur-xl">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
            {/* Logo */}
            <Link href="/app/projects">
              <Wordmark size="sm" />
            </Link>

            {/* Desktop nav */}
            <nav className="hidden items-center gap-0.5 text-sm sm:flex">
              {NAV_LINKS.map((link) => {
                const isActive = link.href === "/app/projects";
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    aria-current={isActive ? "page" : undefined}
                    className={`rounded-lg px-3 py-1.5 font-medium transition-colors ${
                      isActive
                        ? "bg-[var(--color-surface)] text-[var(--color-fg)]"
                        : "text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </nav>

            {/* Right side */}
            <div className="flex items-center gap-2">
              <ConnectExtension />
              <div className="hidden sm:block">
                <UsageMeter compact />
              </div>
              <div className="relative" data-account-menu="">
                <button
                  ref={menuButtonRef}
                  onClick={() => setMenuOpen((v) => !v)}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] text-xs font-bold text-[var(--color-accent)] transition-colors hover:border-[var(--color-accent)]/50"
                  aria-label="Account menu"
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                >
                  {userInitial}
                </button>
                {menuOpen && (
                  <div
                    role="menu"
                    aria-label="Account"
                    className="animate-slide-up absolute right-0 top-10 z-30 min-w-[200px] overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl"
                  >
                    <div className="border-b border-[var(--color-border)] bg-[var(--color-bg-2)] px-4 py-3">
                      <div className="text-sm font-semibold text-[var(--color-fg)] truncate">
                        {session.user.name}
                      </div>
                      <div className="text-xs text-[var(--color-fg-muted)] truncate mt-0.5">
                        {session.user.email}
                      </div>
                    </div>
                    {[
                      { href: "/app/settings/account", label: "Settings" },
                      { href: "/app/billing", label: "Billing" },
                      { href: "/app/snippets", label: "Snippets" },
                    ].map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        role="menuitem"
                        onClick={() => setMenuOpen(false)}
                        className="block px-4 py-2.5 text-sm text-[var(--color-fg-muted)] transition-colors hover:bg-[var(--color-bg-2)] hover:text-[var(--color-fg)]"
                      >
                        {item.label}
                      </Link>
                    ))}
                    <div className="border-t border-[var(--color-border)]">
                      <button
                        role="menuitem"
                        onClick={async () => {
                          await signOut();
                          router.push("/");
                        }}
                        className="w-full px-4 py-2.5 text-left text-sm text-[var(--color-fg-muted)] transition-colors hover:bg-[var(--color-bg-2)] hover:text-[var(--color-danger)]"
                      >
                        Sign out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Mobile nav — desktop nav is hidden on phones */}
          <nav
            aria-label="Primary"
            className="flex gap-1 overflow-x-auto border-t border-[var(--color-border)] px-2 py-2 text-sm sm:hidden"
          >
            {NAV_LINKS.map((link) => {
              const isActive = link.href === "/app/projects";
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={isActive ? "page" : undefined}
                  className={`shrink-0 rounded-lg px-3 py-1.5 font-medium transition-colors ${
                    isActive
                      ? "bg-[var(--color-surface)] text-[var(--color-fg)]"
                      : "text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
          {/* ── New project ─────────────────────────────────────── */}
          <section className="mb-10">
            {/* Row 1: name + platform picker */}
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") create();
                }}
                placeholder="Name your project (optional)…"
                className="max-w-xs flex-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-2 text-sm outline-none transition-colors placeholder:text-[var(--color-fg-subtle)] focus:border-[var(--color-accent)]"
              />
              {/* Platform picker */}
              <div className="flex items-center gap-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-1">
                {(["youtube", "tiktok", "instagram", "linkedin"] as const).map((p) => {
                  const meta = PLATFORM_META[p];
                  return (
                    <button
                      key={p}
                      onClick={() => setPlatform(p)}
                      title={`${meta.label} (${meta.ratio})`}
                      className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all ${
                        platform === p
                          ? "bg-[var(--color-accent)] text-black shadow-sm"
                          : "text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
                      }`}
                    >
                      <span className="hidden sm:inline">{meta.label}</span>
                      <span className="sm:hidden">{meta.shortLabel}</span>
                      <span
                        className={`font-mono text-[9px] opacity-70 ${platform === p ? "opacity-60" : ""}`}
                      >
                        {meta.ratio}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Row 1.5: describe it — seeds the first chat message */}
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) create();
              }}
              rows={2}
              placeholder="Describe the video you want (optional) — e.g. “a punchy 30s explainer about our pricing change” or “tighten my uploaded clip and add captions”. ⌘↵ to create."
              className="mb-4 w-full resize-none rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-2.5 text-sm outline-none transition-colors placeholder:text-[var(--color-fg-subtle)] focus:border-[var(--color-accent)]"
            />

            {/* Row 2: single new-project action */}
            <NewProjectCard
              icon={
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" />
                </svg>
              }
              title="New project"
              description="Upload clips to edit, or describe a scene to generate from scratch — the agent figures out what to do from your first message."
              accent
              disabled={creating}
              onClick={() => create()}
            />
            {createError && (
              <div className="mt-3 rounded-xl border border-[var(--color-danger)]/40 bg-[var(--color-danger)]/8 px-4 py-2.5 text-xs text-[var(--color-danger)]">
                Could not create project: {createError}
              </div>
            )}
          </section>

          {/* ── Project list ────────────────────────────────────── */}
          <section>
            <div className="mb-5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-[var(--color-fg)]">Your projects</h2>
                {projects.length > 0 && (
                  <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-0.5 text-xs text-[var(--color-fg-muted)]">
                    {projects.length}
                  </span>
                )}
              </div>
              {projects.length > 4 && (
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search…"
                  className="w-44 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-sm outline-none focus:border-[var(--color-accent)]"
                />
              )}
            </div>

            {/* Empty states */}
            {filtered.length === 0 && projects.length === 0 && !projectsLoading && (
              <div className="rounded-2xl border border-dashed border-[var(--color-border-2)] py-20 text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]">
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-[var(--color-fg-muted)]"
                    aria-hidden="true"
                  >
                    <rect x="2" y="3" width="20" height="18" rx="2" />
                    <path d="M7 3v18M17 3v18M2 8h5M2 13h5M2 18h5M17 8h5M17 13h5M17 18h5" />
                  </svg>
                </div>
                <p className="font-semibold text-[var(--color-fg)]">No projects yet</p>
                <p className="mt-1 text-sm text-[var(--color-fg-muted)]">
                  Start a new project above to begin.
                </p>
              </div>
            )}
            {filtered.length === 0 && projects.length > 0 && (
              <p className="py-8 text-center text-sm text-[var(--color-fg-muted)]">
                No matches for "{search}".
              </p>
            )}

            {projectsLoading ? (
              <ProjectsSkeleton />
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {filtered.map((p, i) => (
                  <ProjectCard
                    key={p.id}
                    project={p}
                    index={i}
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
            )}
          </section>
        </main>
      </div>
    </>
  );
}

/* ── ProjectsSkeleton ─────────────────────────────────────────────────────── */
function ProjectsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]"
        >
          <div className="h-32 animate-shimmer bg-[var(--color-bg-2)]" />
          <div className="space-y-2 p-4">
            <div className="h-4 w-2/3 animate-pulse rounded-md bg-[var(--color-bg-2)]" />
            <div className="h-3 w-1/3 animate-pulse rounded-md bg-[var(--color-bg-2)]" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── NewProjectCard ───────────────────────────────────────────────────────── */
function NewProjectCard({
  icon,
  title,
  description,
  accent,
  disabled,
  onClick,
}: {
  icon: React.ReactNode;
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
      className={`group flex items-start gap-4 rounded-2xl border p-5 text-left transition-all duration-200 disabled:opacity-60 sm:p-6 ${
        accent
          ? "border-[var(--color-accent)]/25 bg-[var(--color-accent)]/5 hover:border-[var(--color-accent)]/50 hover:bg-[var(--color-accent)]/10"
          : "border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-border-2)] hover:bg-[var(--color-surface-2)]"
      }`}
    >
      <div
        className={`mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-105 ${
          accent
            ? "bg-[var(--color-accent)]/15 text-[var(--color-accent)]"
            : "bg-[var(--color-bg-2)] text-[var(--color-fg-muted)] group-hover:text-[var(--color-accent)]"
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

/* ── ProjectCard ──────────────────────────────────────────────────────────── */
function ProjectCard({
  project,
  index,
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
  index: number;
  renamingId: string | null;
  renameValue: string;
  onSetRename: (id: string) => void;
  onRenameChange: (v: string) => void;
  onRenameCommit: () => void;
  onRenameCancel: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const isRenaming = renamingId === project.id;
  const gradient = projectGradient(project.id);
  const platMeta = project.platform ? PLATFORM_META[project.platform] : null;
  const initial = project.name[0]?.toUpperCase() ?? "P";
  // Track whether the thumbnail image has failed to load (404 = no render yet).
  const [thumbFailed, setThumbFailed] = useState(false);
  // Cache-buster fixed per card mount, so revisiting the dashboard picks up a
  // thumbnail refreshed from the latest preview (edits don't bump updatedAt).
  const [thumbBust] = useState(() => Date.now());

  return (
    <div
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] transition-all duration-200 hover:border-[var(--color-border-2)] hover:shadow-xl hover:shadow-black/20"
      style={{ animationDelay: `${index * 40}ms` }}
    >
      {/* Thumbnail — real frame if rendered, gradient fallback otherwise */}
      <Link
        href={`/app/projects/${project.id}/edit`}
        className={`relative flex h-32 w-full items-center justify-center overflow-hidden bg-gradient-to-br ${gradient}`}
        tabIndex={isRenaming ? -1 : 0}
      >
        {/* Gradient + noise — always rendered as background */}
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E\")",
          }}
        />

        {/* Real thumbnail — overlays the gradient when it loads successfully */}
        {!thumbFailed && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/projects/${project.id}/thumb?v=${thumbBust}`}
            alt={`Preview thumbnail for ${project.name}`}
            onError={() => setThumbFailed(true)}
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}

        {/* Fallback: initial letter, shown only when no real thumbnail */}
        {thumbFailed && (
          <span className="relative z-10 select-none text-5xl font-black tracking-tight text-white/25">
            {initial}
          </span>
        )}

        {/* Platform badge */}
        {platMeta && (
          <div className="absolute bottom-2 right-2 z-10">
            <span
              className={`rounded-md border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${platMeta.color}`}
            >
              {platMeta.ratio}
            </span>
          </div>
        )}

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/0 transition-all duration-200 group-hover:bg-black/20" />
        <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
          <span className="rounded-xl border border-white/20 bg-white/10 px-4 py-1.5 text-xs font-semibold text-white backdrop-blur-sm">
            Open →
          </span>
        </div>
      </Link>

      {/* Card body */}
      <div className="flex flex-1 flex-col gap-2.5 p-4">
        {isRenaming ? (
          <input
            autoFocus
            value={renameValue}
            onChange={(e) => onRenameChange(e.target.value)}
            onBlur={onRenameCommit}
            onKeyDown={(e) => {
              if (e.key === "Enter") onRenameCommit();
              if (e.key === "Escape") onRenameCancel();
            }}
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1 text-sm outline-none focus:border-[var(--color-accent)]"
          />
        ) : (
          <Link
            href={`/app/projects/${project.id}/edit`}
            className="line-clamp-1 text-sm font-semibold text-[var(--color-fg)] transition-colors hover:text-[var(--color-accent)]"
          >
            {project.name}
          </Link>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-[var(--color-fg-muted)]">
            <span>{relativeTime(project.updatedAt)}</span>
            {(project.renderCount ?? 0) > 0 && (
              <span className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-2)] px-1.5 py-0.5">
                {project.renderCount} render{project.renderCount === 1 ? "" : "s"}
              </span>
            )}
          </div>

          {/* Action buttons — visible on hover or keyboard focus */}
          <div className="flex gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
            <ActionBtn title="Rename" onClick={() => onSetRename(project.id)}>
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </ActionBtn>
            <ActionBtn title="Duplicate" onClick={onDuplicate}>
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <rect x="9" y="9" width="13" height="13" rx="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
            </ActionBtn>
            <ActionBtn title="Delete" onClick={onDelete} danger>
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                <path d="M10 11v6M14 11v6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
              </svg>
            </ActionBtn>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── ActionBtn ────────────────────────────────────────────────────────────── */
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
      aria-label={title}
      onClick={onClick}
      className={`flex h-6 w-6 items-center justify-center rounded-md transition-colors focus-visible:opacity-100 ${
        danger
          ? "text-[var(--color-fg-subtle)] hover:bg-red-500/10 hover:text-red-400"
          : "text-[var(--color-fg-subtle)] hover:bg-[var(--color-bg-2)] hover:text-[var(--color-fg)]"
      }`}
    >
      {children}
    </button>
  );
}

/* ── Helpers ──────────────────────────────────────────────────────────────── */
function relativeTime(iso: string): string {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
