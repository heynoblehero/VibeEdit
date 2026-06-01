"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import { Wordmark } from "@/components/Wordmark";
import { UserMenu } from "@/components/UserMenu";

type ScheduledPublish = {
  id: string;
  projectId: string;
  projectName: string | null;
  renderJobId: string | null;
  platform: string;
  title: string | null;
  description: string | null;
  scheduledAt: string | number;
  status: "pending" | "published" | "failed" | "cancelled";
  publishedAt: string | number | null;
  error: string | null;
  createdAt: string | number;
};

const PLATFORM_META: Record<string, { label: string; color: string; icon: string }> = {
  youtube: { label: "YouTube", color: "text-red-400", icon: "▶" },
  tiktok: { label: "TikTok", color: "text-pink-400", icon: "♪" },
  instagram: { label: "Instagram", color: "text-purple-400", icon: "◈" },
};

const STATUS_META: Record<string, { label: string; color: string }> = {
  pending: { label: "Scheduled", color: "text-[var(--color-accent)] bg-[var(--color-accent)]/10" },
  published: {
    label: "Published",
    color: "text-[var(--color-success)] bg-[var(--color-success)]/10",
  },
  failed: { label: "Failed", color: "text-[var(--color-danger)] bg-[var(--color-danger)]/10" },
  cancelled: {
    label: "Cancelled",
    color: "text-[var(--color-fg-subtle)] bg-[var(--color-surface)]",
  },
};

function formatDate(ts: string | number): string {
  const d = new Date(typeof ts === "number" ? ts * 1000 : ts);
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function PublishingPage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [schedules, setSchedules] = useState<ScheduledPublish[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "published" | "failed">(
    "all",
  );
  const [showScheduleModal, setShowScheduleModal] = useState(false);

  useEffect(() => {
    if (!isPending && !session) router.replace("/app/login");
  }, [isPending, session, router]);

  async function refresh() {
    setLoading(true);
    const r = await fetch("/api/publishing/schedule");
    if (r.ok) {
      const data = (await r.json()) as { schedules: ScheduledPublish[] };
      setSchedules(data.schedules);
    }
    setLoading(false);
  }

  useEffect(() => {
    if (session) refresh();
  }, [session]);

  async function cancel(id: string) {
    setCancelling(id);
    await fetch(`/api/publishing/schedule/${id}`, { method: "DELETE" });
    setCancelling(null);
    refresh();
  }

  const filtered =
    statusFilter === "all" ? schedules : schedules.filter((s) => s.status === statusFilter);

  if (isPending || !session) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--color-bg)]">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-border)] border-t-[var(--color-accent)]" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--color-bg)]">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-[var(--color-border)] bg-[var(--color-bg)]/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <Link href="/app/projects" className="shrink-0 transition-opacity hover:opacity-80">
              <Wordmark size="sm" />
            </Link>
            <svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
              className="text-[var(--color-border)]"
              aria-hidden="true"
            >
              <path
                d="M4 2l4 4-4 4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
            <span className="text-sm font-medium text-[var(--color-fg-muted)]">Publishing</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowScheduleModal(true)}
              className="flex items-center gap-1.5 rounded-xl bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-black transition-opacity hover:opacity-90"
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 12 12"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M6 1v10M1 6h10" />
              </svg>
              Schedule
            </button>
            <UserMenu />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-8">
        {/* Page title */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[var(--color-fg)]">Publishing schedule</h1>
          <p className="mt-1 text-sm text-[var(--color-fg-muted)]">
            Schedule renders to publish automatically to YouTube, TikTok, or Instagram. Connect your
            accounts in{" "}
            <Link
              href="/app/settings/account"
              className="text-[var(--color-accent)] hover:underline"
            >
              Settings → Account
            </Link>
            .
          </p>
        </div>

        {/* Stats strip */}
        <div className="mb-6 grid grid-cols-3 gap-3">
          {(["pending", "published", "failed"] as const).map((s) => {
            const count = schedules.filter((x) => x.status === s).length;
            const meta = STATUS_META[s];
            return (
              <button
                key={s}
                onClick={() => setStatusFilter(statusFilter === s ? "all" : s)}
                className={`rounded-xl border p-4 text-left transition-colors ${
                  statusFilter === s
                    ? "border-[var(--color-accent)]/50 bg-[var(--color-surface)]"
                    : "border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-border-2)]"
                }`}
              >
                <p className="text-2xl font-bold text-[var(--color-fg)]">{count}</p>
                <p className="mt-0.5 text-xs text-[var(--color-fg-muted)]">{meta.label}</p>
              </button>
            );
          })}
        </div>

        {/* Filter tabs */}
        <div className="mb-4 flex gap-1 overflow-x-auto">
          {(["all", "pending", "published", "failed"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                statusFilter === f
                  ? "bg-[var(--color-accent)] text-black"
                  : "text-[var(--color-fg-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-fg)]"
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Schedule list */}
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-20 animate-shimmer rounded-xl bg-[var(--color-surface)]" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-[var(--color-border)] py-20 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]">
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
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-[var(--color-fg)]">
                {statusFilter === "all" ? "No schedules yet" : `No ${statusFilter} publishes`}
              </p>
              <p className="mt-1 text-sm text-[var(--color-fg-muted)]">
                Render a project then schedule it to publish automatically.
              </p>
            </div>
            <button
              onClick={() => setShowScheduleModal(true)}
              className="rounded-xl bg-[var(--color-accent)] px-5 py-2.5 text-sm font-semibold text-black transition-opacity hover:opacity-90"
            >
              Schedule a publish
            </button>
          </div>
        ) : (
          <ul className="space-y-3">
            {filtered.map((schedule) => {
              const platform = PLATFORM_META[schedule.platform] ?? {
                label: schedule.platform,
                color: "text-[var(--color-fg-muted)]",
                icon: "●",
              };
              const statusMeta = STATUS_META[schedule.status] ?? STATUS_META.cancelled;
              return (
                <li
                  key={schedule.id}
                  className="group flex items-start gap-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 transition-colors hover:border-[var(--color-border-2)]"
                >
                  {/* Platform icon */}
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] text-lg">
                    <span className={platform.color}>{platform.icon}</span>
                  </div>

                  {/* Main content */}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-[var(--color-fg)]">
                          {schedule.title || schedule.projectName || "Untitled"}
                        </p>
                        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-[var(--color-fg-muted)]">
                          <span className={`font-medium ${platform.color}`}>{platform.label}</span>
                          {schedule.projectName && (
                            <>
                              <span>·</span>
                              <Link
                                href={`/app/projects/${schedule.projectId}/edit`}
                                className="hover:text-[var(--color-fg)] hover:underline"
                              >
                                {schedule.projectName}
                              </Link>
                            </>
                          )}
                          <span>·</span>
                          <span>
                            {schedule.status === "published" && schedule.publishedAt
                              ? `Published ${formatDate(schedule.publishedAt)}`
                              : `Scheduled for ${formatDate(schedule.scheduledAt)}`}
                          </span>
                        </div>
                        {schedule.error && (
                          <p className="mt-1 text-xs text-[var(--color-danger)]">
                            {schedule.error}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${statusMeta.color}`}
                        >
                          {statusMeta.label}
                        </span>
                        {schedule.status === "pending" && (
                          <button
                            onClick={() => cancel(schedule.id)}
                            disabled={cancelling === schedule.id}
                            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-2.5 py-1 text-xs font-medium text-[var(--color-fg-muted)] opacity-0 transition-all hover:border-[var(--color-danger)]/40 hover:text-[var(--color-danger)] disabled:opacity-40 group-hover:opacity-100"
                          >
                            {cancelling === schedule.id ? "Cancelling…" : "Cancel"}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {showScheduleModal && (
        <ScheduleModal
          onClose={() => setShowScheduleModal(false)}
          onCreated={() => {
            setShowScheduleModal(false);
            refresh();
          }}
        />
      )}
    </main>
  );
}

function ScheduleModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [projects, setProjects] = useState<Array<{ id: string; name: string }>>([]);
  const [renders, setRenders] = useState<Array<{ id: string; createdAt: string }>>([]);
  const [projectId, setProjectId] = useState("");
  const [renderId, setRenderId] = useState("");
  const [platform, setPlatform] = useState("youtube");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load projects on mount.
  useEffect(() => {
    fetch("/api/projects?limit=50")
      .then((r) => (r.ok ? r.json() : { projects: [] }))
      .then((data: { projects?: Array<{ id: string; name: string }> }) =>
        setProjects(data.projects ?? []),
      );
  }, []);

  // Load renders when project changes.
  useEffect(() => {
    if (!projectId) {
      setRenders([]);
      return;
    }
    fetch(`/api/render?projectId=${projectId}&status=done&limit=20`)
      .then((r) => (r.ok ? r.json() : { jobs: [] }))
      .then((data: { jobs?: Array<{ id: string; createdAt: string }> }) =>
        setRenders(data.jobs ?? []),
      );
  }, [projectId]);

  useEffect(() => {
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [onClose]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!projectId || !platform || !scheduledAt) {
      setError("Project, platform, and scheduled time are required.");
      return;
    }
    setSaving(true);
    const r = await fetch("/api/publishing/schedule", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        projectId,
        renderJobId: renderId || undefined,
        platform,
        title: title.trim() || undefined,
        description: description.trim() || undefined,
        scheduledAt: new Date(scheduledAt).toISOString(),
      }),
    });
    setSaving(false);
    if (r.ok) {
      onCreated();
    } else {
      const text = await r.text();
      setError(text || "Failed to schedule publish.");
    }
  }

  // Default scheduledAt to tomorrow at 9am local.
  useEffect(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(9, 0, 0, 0);
    setScheduledAt(d.toISOString().slice(0, 16));
  }, []);

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="animate-scale-in w-full max-w-md overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-4">
          <h2 className="font-semibold text-[var(--color-fg)]">Schedule a publish</h2>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--color-fg-muted)] hover:bg-[var(--color-bg-2)] hover:text-[var(--color-fg)]"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M1 1l10 10M11 1L1 11" />
            </svg>
          </button>
        </div>

        <form onSubmit={submit} className="p-5 space-y-4">
          {error && (
            <p className="rounded-xl border border-[var(--color-danger)]/30 bg-[var(--color-danger)]/8 px-3 py-2 text-xs text-[var(--color-danger)]">
              {error}
            </p>
          )}

          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-[var(--color-fg-muted)]">
              Project *
            </span>
            <select
              value={projectId}
              onChange={(e) => {
                setProjectId(e.target.value);
                setRenderId("");
              }}
              required
              className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-2)] px-3.5 py-2.5 text-sm text-[var(--color-fg)] outline-none focus:border-[var(--color-accent)]"
            >
              <option value="">Select a project…</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>

          {renders.length > 0 && (
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-[var(--color-fg-muted)]">
                Render to publish
              </span>
              <select
                value={renderId}
                onChange={(e) => setRenderId(e.target.value)}
                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-2)] px-3.5 py-2.5 text-sm text-[var(--color-fg)] outline-none focus:border-[var(--color-accent)]"
              >
                <option value="">Most recent render</option>
                {renders.map((r) => (
                  <option key={r.id} value={r.id}>
                    Render from {new Date(r.createdAt).toLocaleDateString()}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-[var(--color-fg-muted)]">
              Platform *
            </span>
            <div className="grid grid-cols-3 gap-2">
              {(["youtube", "tiktok", "instagram"] as const).map((p) => {
                const meta = PLATFORM_META[p];
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPlatform(p)}
                    className={`flex items-center justify-center gap-1.5 rounded-xl border py-2.5 text-xs font-medium transition-colors ${
                      platform === p
                        ? "border-[var(--color-accent)]/50 bg-[var(--color-accent)]/10 text-[var(--color-fg)]"
                        : "border-[var(--color-border)] bg-[var(--color-bg-2)] text-[var(--color-fg-muted)] hover:border-[var(--color-border-2)]"
                    }`}
                  >
                    <span className={meta.color}>{meta.icon}</span>
                    {meta.label}
                  </button>
                );
              })}
            </div>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-[var(--color-fg-muted)]">
              Title
            </span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Leave blank to use project name"
              className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-2)] px-3.5 py-2.5 text-sm outline-none placeholder:text-[var(--color-fg-subtle)] focus:border-[var(--color-accent)]"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-[var(--color-fg-muted)]">
              Description
            </span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Optional description / caption"
              className="w-full resize-none rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-2)] px-3.5 py-2.5 text-sm outline-none placeholder:text-[var(--color-fg-subtle)] focus:border-[var(--color-accent)]"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-[var(--color-fg-muted)]">
              Publish at *
            </span>
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              required
              className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-2)] px-3.5 py-2.5 text-sm text-[var(--color-fg)] outline-none focus:border-[var(--color-accent)]"
            />
          </label>

          <p className="text-[10px] leading-snug text-[var(--color-fg-subtle)]">
            Requires a connected platform account. Connect accounts in{" "}
            <Link
              href="/app/settings/account"
              className="text-[var(--color-accent)] hover:underline"
            >
              Settings → Account
            </Link>
            . Publishing runs in the background — you don&apos;t need to stay on this page.
          </p>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-[var(--color-border)] py-2.5 text-sm font-medium text-[var(--color-fg-muted)] transition-colors hover:border-[var(--color-border-2)] hover:text-[var(--color-fg)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-xl bg-[var(--color-accent)] py-2.5 text-sm font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "Scheduling…" : "Schedule"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
