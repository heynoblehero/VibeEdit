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

function menuIcon(children: React.ReactNode): React.ReactNode {
  return (
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
      {children}
    </svg>
  );
}

const MENU_ITEMS: Array<{ href: string; label: string; icon: React.ReactNode }> = [
  {
    href: "/app/projects",
    label: "Projects",
    icon: menuIcon(
      <>
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </>,
    ),
  },
  {
    href: "/app/renders",
    label: "Renders",
    icon: menuIcon(<polygon points="5 3 19 12 5 21 5 3" />),
  },
  {
    href: "/app/effects",
    label: "Store",
    icon: menuIcon(
      <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3z" />,
    ),
  },
  {
    href: "/app/settings/account",
    label: "Settings",
    icon: menuIcon(
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M12 1v4M12 19v4M4.2 4.2l2.8 2.8M17 17l2.8 2.8M1 12h4M19 12h4M4.2 19.8 7 17M17 7l2.8-2.8" />
      </>,
    ),
  },
  {
    href: "/app/billing",
    label: "Billing",
    icon: menuIcon(
      <>
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <line x1="2" y1="10" x2="22" y2="10" />
      </>,
    ),
  },
];

export default function ProjectsPage() {
  const router = useRouter();
  const toast = useToast();
  const { data: session, isPending } = useSession();
  const [projects, setProjects] = useState<Project[]>([]);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [usage, setUsage] = useState<{
    credits?: { total: number };
    usage?: {
      renders?: { used: number; limit: number };
      renderMinutes?: { used: number; limit: number };
    };
  } | null>(null);

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

  useEffect(() => {
    if (!session) return;
    fetch("/api/billing/me")
      .then((r) => (r.ok ? r.json() : null))
      .then(setUsage)
      .catch(() => {});
  }, [session]);

  async function create(opts: { name: string; platform: string; aspectRatio: string }) {
    setCreating(true);
    setCreateError(null);
    try {
      const result = await fetch("/api/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: opts.name.trim(),
          platform: opts.platform,
          aspectRatio: opts.aspectRatio,
        }),
      });
      if (!result.ok) {
        const msg = await result.text().catch(() => "Unknown error");
        setCreateError(msg || `Server error ${result.status}`);
        toast.error("Couldn't create project. Please try again.");
        return;
      }
      const { id } = (await result.json()) as { id: string };
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
      {showCreate && (
        <CreateProjectModal
          creating={creating}
          onClose={() => setShowCreate(false)}
          onCreate={create}
        />
      )}

      <div className="flex min-h-screen flex-col bg-[var(--color-bg)]">
        {/* ── Header (mobile only — desktop uses the sidebar) ─────── */}
        <header className="sticky top-0 z-20 border-b border-[var(--color-border)] bg-[var(--color-bg)]/90 backdrop-blur-xl md:hidden">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
            {/* Logo */}
            <Link href="/app/projects">
              <Wordmark size="sm" />
            </Link>

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
                    {usage?.usage?.renders && (
                      <Link
                        href="/app/billing"
                        onClick={() => setMenuOpen(false)}
                        className="block border-b border-[var(--color-border)] px-4 py-2.5 text-xs text-[var(--color-fg-muted)] transition-colors hover:bg-[var(--color-bg-2)]"
                      >
                        <div className="flex items-center justify-between">
                          <span>Renders this month</span>
                          <span className="font-mono text-[var(--color-fg)]">
                            {usage.usage.renders.used}
                            {usage.usage.renders.limit === -1
                              ? ""
                              : ` / ${usage.usage.renders.limit}`}
                          </span>
                        </div>
                        {typeof usage.credits?.total === "number" && (
                          <div className="mt-1 flex items-center justify-between">
                            <span>Credits left</span>
                            <span className="font-mono text-[var(--color-fg)]">
                              {usage.credits.total === -1
                                ? "∞"
                                : usage.credits.total.toLocaleString()}
                            </span>
                          </div>
                        )}
                      </Link>
                    )}
                    {MENU_ITEMS.map((item) =>
                      item.href === "/app/settings/account" ? (
                        <button
                          key={item.href}
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setMenuOpen(false);
                            window.dispatchEvent(new CustomEvent("vibeedit:open-settings"));
                          }}
                          className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-[var(--color-fg-muted)] transition-colors hover:bg-[var(--color-bg-2)] hover:text-[var(--color-fg)]"
                        >
                          <span className="text-[var(--color-fg-subtle)]">{item.icon}</span>
                          {item.label}
                        </button>
                      ) : (
                        <Link
                          key={item.href}
                          href={item.href}
                          role="menuitem"
                          onClick={() => setMenuOpen(false)}
                          className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-[var(--color-fg-muted)] transition-colors hover:bg-[var(--color-bg-2)] hover:text-[var(--color-fg)]"
                        >
                          <span className="text-[var(--color-fg-subtle)]">{item.icon}</span>
                          {item.label}
                        </Link>
                      ),
                    )}
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
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
          {/* ── Project list ────────────────────────────────────── */}
          <section>
            <div className="mb-5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-[var(--color-fg)]">Your projects</h2>
                {projects.length > 0 && (
                  <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-0.5 text-xs text-[var(--color-fg-muted)]">
                    {projects.length}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {projects.length > 4 && (
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search…"
                    className="w-40 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)] sm:w-44"
                  />
                )}
                <button
                  type="button"
                  onClick={() => {
                    setCreateError(null);
                    setShowCreate(true);
                  }}
                  disabled={creating}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-black shadow-[var(--glow-accent-sm)] transition-all hover:-translate-y-0.5 hover:opacity-95 disabled:opacity-50"
                >
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                  {creating ? "Creating…" : "New project"}
                </button>
              </div>
            </div>
            {createError && (
              <div className="mb-4 rounded-xl border border-[var(--color-danger)]/40 bg-[var(--color-danger)]/8 px-4 py-2.5 text-xs text-[var(--color-danger)]">
                Could not create project: {createError}
              </div>
            )}

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
                  Create your first video — pick a name and format, then build it with the AI.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setCreateError(null);
                    setShowCreate(true);
                  }}
                  className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-accent)] px-5 py-2.5 text-sm font-semibold text-black shadow-[var(--glow-accent-sm)] transition-all hover:-translate-y-0.5 hover:opacity-95"
                >
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                  New project
                </button>
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

/* ── CreateProjectModal ───────────────────────────────────────────────────── */
const NAME_ADJECTIVES = [
  "Crimson",
  "Golden",
  "Violet",
  "Neon",
  "Amber",
  "Cobalt",
  "Silver",
  "Emerald",
  "Midnight",
  "Solar",
  "Electric",
  "Velvet",
  "Coral",
  "Lunar",
  "Scarlet",
  "Azure",
  "Radiant",
  "Onyx",
];
const NAME_NOUNS = [
  "Harbor",
  "Circuit",
  "Vortex",
  "Falcon",
  "Ember",
  "Summit",
  "Comet",
  "Atlas",
  "Prism",
  "Nomad",
  "Echo",
  "Horizon",
  "Cascade",
  "Beacon",
  "Meridian",
  "Pulse",
  "Signal",
  "Aurora",
];
function randomProjectName(): string {
  const adjective = NAME_ADJECTIVES[Math.floor(Math.random() * NAME_ADJECTIVES.length)];
  const noun = NAME_NOUNS[Math.floor(Math.random() * NAME_NOUNS.length)];
  return `${adjective} ${noun}`;
}

const FORMATS = [
  { ratio: "16:9", label: "Landscape", dims: "1920 × 1080", platform: "youtube", box: "h-5 w-8" },
  { ratio: "9:16", label: "Vertical", dims: "1080 × 1920", platform: "tiktok", box: "h-8 w-5" },
  { ratio: "1:1", label: "Square", dims: "1080 × 1080", platform: "instagram", box: "h-6 w-6" },
] as const;

function CreateProjectModal({
  creating,
  onClose,
  onCreate,
}: {
  creating: boolean;
  onClose: () => void;
  onCreate: (opts: { name: string; platform: string; aspectRatio: string }) => void;
}) {
  const [name, setName] = useState(() => randomProjectName());
  // Selected preset ratio, or "custom" for the width × height inputs.
  const [choice, setChoice] = useState<string>("16:9");
  const [customW, setCustomW] = useState("1080");
  const [customH, setCustomH] = useState("1350");
  const isCustom = choice === "custom";

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const customValid =
    Number(customW) >= 128 &&
    Number(customW) <= 4096 &&
    Number(customH) >= 128 &&
    Number(customH) <= 4096;

  function submit() {
    if (isCustom && !customValid) return;
    const preset = FORMATS.find((f) => f.ratio === choice);
    onCreate({
      name: name.trim() || randomProjectName(),
      platform: preset?.platform ?? "youtube",
      aspectRatio: isCustom ? `${Number(customW)}:${Number(customH)}` : choice,
    });
  }

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
    >
      <div
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-md overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-4">
          <h2 className="font-semibold text-[var(--color-fg)]">New project</h2>
          <button
            onClick={onClose}
            title="Close (Esc)"
            className="rounded-lg px-2 py-1 text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
          >
            ✕
          </button>
        </div>
        <div className="p-5">
          <label className="mb-1.5 block text-xs font-medium text-[var(--color-fg-muted)]">
            Name
          </label>
          <div className="mb-5 flex gap-2">
            <input
              autoFocus
              value={name}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") submit();
              }}
              className="flex-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-2)] px-3.5 py-2.5 text-sm outline-none focus:border-[var(--color-accent)]"
            />
            <button
              type="button"
              onClick={() => setName(randomProjectName())}
              title="Shuffle name"
              className="shrink-0 rounded-xl border border-[var(--color-border)] px-3 text-sm text-[var(--color-fg-muted)] transition-colors hover:text-[var(--color-fg)]"
            >
              🎲
            </button>
          </div>

          <label className="mb-1.5 block text-xs font-semibold text-[var(--color-fg)]">
            Format
          </label>
          <div className="mb-3 grid grid-cols-3 gap-2">
            {FORMATS.map((f) => {
              const selected = choice === f.ratio;
              return (
                <button
                  key={f.ratio}
                  type="button"
                  onClick={() => setChoice(f.ratio)}
                  className={`flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 text-center transition-colors ${
                    selected
                      ? "border-[var(--color-accent)] bg-[var(--color-accent)]/10"
                      : "border-[var(--color-border)] hover:border-[var(--color-border-2)]"
                  }`}
                >
                  <span
                    className={`rounded-sm border-2 ${f.box} ${
                      selected ? "border-[var(--color-accent)]" : "border-[var(--color-fg-muted)]"
                    }`}
                  />
                  <span className="text-xs font-semibold text-[var(--color-fg)]">{f.label}</span>
                  <span className="font-mono text-[10px] text-[var(--color-fg-muted)]">
                    {f.dims}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Custom dimensions */}
          <button
            type="button"
            onClick={() => setChoice("custom")}
            className={`mb-2 flex w-full items-center gap-2 rounded-xl border px-3 py-2.5 text-left transition-colors ${
              isCustom
                ? "border-[var(--color-accent)] bg-[var(--color-accent)]/10"
                : "border-[var(--color-border)] hover:border-[var(--color-border-2)]"
            }`}
          >
            <span className="text-sm font-semibold text-[var(--color-fg)]">Custom size</span>
            <span className="text-xs text-[var(--color-fg-muted)]">— set exact pixels</span>
          </button>
          {isCustom && (
            <div className="mb-5 flex items-center gap-2">
              <input
                type="number"
                value={customW}
                min={128}
                max={4096}
                onChange={(event) => setCustomW(event.target.value)}
                aria-label="Width in pixels"
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-2)] px-3 py-2 text-sm text-[var(--color-fg)] outline-none focus:border-[var(--color-accent)]"
              />
              <span className="text-sm font-medium text-[var(--color-fg-muted)]">×</span>
              <input
                type="number"
                value={customH}
                min={128}
                max={4096}
                onChange={(event) => setCustomH(event.target.value)}
                aria-label="Height in pixels"
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-2)] px-3 py-2 text-sm text-[var(--color-fg)] outline-none focus:border-[var(--color-accent)]"
              />
              <span className="text-xs text-[var(--color-fg-muted)]">px</span>
            </div>
          )}
          {!isCustom && <div className="mb-5" />}

          <button
            onClick={submit}
            disabled={creating || (isCustom && !customValid)}
            className="w-full rounded-xl bg-[var(--color-accent)] py-2.5 text-sm font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {creating ? "Creating…" : "Create project"}
          </button>
        </div>
      </div>
    </div>
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
