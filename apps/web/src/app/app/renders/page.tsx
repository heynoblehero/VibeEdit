"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import { Wordmark } from "@/components/Wordmark";
import { useToast } from "@/components/Toast";

type Job = {
  id: string;
  projectId: string;
  projectName: string | null;
  status: "queued" | "running" | "done" | "failed";
  progress: number;
  outputPath: string | null;
  error: string | null;
  fps: number;
  quality: string;
  createdAt: string;
  finishedAt: string | null;
  startedAt?: string | null;
  publicShareSlug?: string | null;
  showcased?: boolean;
};

export default function RendersPage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [rendersLoading, setRendersLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<"all" | "running" | "done" | "failed">("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!isPending && !session) router.replace("/app/login");
  }, [isPending, session, router]);

  async function refresh() {
    const r = await fetch("/api/render");
    if (!r.ok) return;
    const j = (await r.json()) as { jobs: Job[] };
    setJobs(j.jobs);
    setRendersLoading(false);
  }

  useEffect(() => {
    if (session) refresh();
  }, [session]);

  // Live-tail any active job
  useEffect(() => {
    const active = jobs.find((j) => j.status === "running" || j.status === "queued");
    if (!active) return;
    const source = new EventSource(`/api/render/${active.id}/stream`);
    source.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as Partial<Job>;
        setJobs((prev) => prev.map((j) => (j.id === active.id ? { ...j, ...data } : j)));
        if (data.status === "done" || data.status === "failed") {
          source.close();
          refresh();
        }
      } catch {
        /* */
      }
    };
    return () => source.close();
  }, [jobs]);

  if (isPending || !session) {
    return (
      <main className="flex min-h-screen items-center justify-center text-[var(--color-fg-muted)]">
        Loading...
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl p-4 sm:p-8">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-3 sm:mb-10">
        <Wordmark size="md" />
        <nav aria-label="Primary" className="flex flex-wrap gap-3 text-sm">
          <Link
            href="/app/projects"
            className="text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
          >
            Projects
          </Link>
          <Link href="/app/renders" aria-current="page" className="text-[var(--color-accent)]">
            Renders
          </Link>
        </nav>
      </header>

      <h1 className="mb-6 text-2xl font-bold sm:text-3xl">Render history</h1>

      {jobs.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="flex gap-1.5">
            {(["all", "running", "done", "failed"] as const).map((status) => {
              const count =
                status === "all"
                  ? jobs.length
                  : jobs.filter((job) =>
                      status === "running"
                        ? job.status === "running" || job.status === "queued"
                        : job.status === status,
                    ).length;
              return (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`rounded-full px-3 py-1 text-xs ${
                    statusFilter === status
                      ? "bg-[var(--color-accent)] text-black"
                      : "border border-[var(--color-border)] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
                  }`}
                >
                  {status} · {count}
                </button>
              );
            })}
          </div>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search project name…"
            className="ml-auto w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1.5 text-xs outline-none focus:border-[var(--color-accent)] sm:w-56"
          />
        </div>
      )}

      {rendersLoading && <RendersSkeleton />}

      {!rendersLoading && jobs.length === 0 && (
        <div className="rounded-lg border border-dashed border-[var(--color-border)] p-8 text-center text-[var(--color-fg-muted)]">
          No renders yet. Open a project and hit Render MP4.
        </div>
      )}

      {!rendersLoading && (
        <ul className="space-y-2">
          {jobs
            .filter((job) => {
              if (statusFilter === "all") return true;
              if (statusFilter === "running")
                return job.status === "running" || job.status === "queued";
              return job.status === statusFilter;
            })
            .filter((job) => {
              if (!search.trim()) return true;
              const term = search.trim().toLowerCase();
              return (job.projectName || "").toLowerCase().includes(term);
            })
            .map((job) => (
              <RenderJobRow
                key={job.id}
                job={job}
                onShareChange={(slug) =>
                  setJobs((prev) =>
                    prev.map((row) =>
                      row.id === job.id ? { ...row, publicShareSlug: slug } : row,
                    ),
                  )
                }
                onShowcaseChange={(showcased, slug) =>
                  setJobs((prev) =>
                    prev.map((row) =>
                      row.id === job.id
                        ? { ...row, showcased, publicShareSlug: slug ?? row.publicShareSlug }
                        : row,
                    ),
                  )
                }
              />
            ))}
        </ul>
      )}
    </main>
  );
}

function RendersSkeleton() {
  return (
    <ul className="space-y-2">
      {Array.from({ length: 5 }).map((_, index) => (
        <li
          key={index}
          className="flex items-center gap-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3"
        >
          <div className="h-2.5 w-2.5 rounded-full animate-pulse bg-[var(--color-bg-2)]" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 w-2/5 animate-pulse rounded bg-[var(--color-bg-2)]" />
            <div className="h-2.5 w-1/4 animate-pulse rounded bg-[var(--color-bg-2)]" />
          </div>
          <div className="h-7 w-20 animate-pulse rounded-md bg-[var(--color-bg-2)]" />
        </li>
      ))}
    </ul>
  );
}

function ShowcaseToggle({
  job,
  onToggle,
}: {
  job: Job;
  onToggle: (showcased: boolean, slug?: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  async function toggle() {
    if (busy) return;
    setBusy(true);
    const wasShowcased = job.showcased;
    try {
      if (wasShowcased) {
        const response = await fetch(`/api/render/${job.id}/showcase`, { method: "DELETE" });
        if (!response.ok) throw new Error("failed");
        onToggle(false);
        toast.success("Removed from showcase");
      } else {
        const response = await fetch(`/api/render/${job.id}/showcase`, { method: "POST" });
        if (!response.ok) throw new Error("failed");
        const data = (await response.json()) as { slug: string };
        onToggle(true, data.slug);
        toast.success("Featured in the public showcase");
      }
    } catch {
      toast.error(
        wasShowcased ? "Couldn't remove from showcase." : "Couldn't feature this render.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={busy}
      title={job.showcased ? "Remove from public showcase" : "Feature in public showcase"}
      className={`flex items-center gap-1.5 rounded-md border px-3 py-1 text-xs transition-colors disabled:opacity-50 ${
        job.showcased
          ? "border-[var(--color-accent)]/40 bg-[var(--color-accent)]/10 text-[var(--color-accent)]"
          : "border-[var(--color-border)] text-[var(--color-fg-muted)] hover:border-[var(--color-accent)]/40 hover:text-[var(--color-accent)]"
      }`}
    >
      <svg
        width="10"
        height="10"
        viewBox="0 0 24 24"
        fill={job.showcased ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
      {busy ? "…" : job.showcased ? "Featured" : "Feature"}
    </button>
  );
}

function RenderJobRow({
  job,
  onShareChange,
  onShowcaseChange,
}: {
  job: Job;
  onShareChange: (slug: string | null) => void;
  onShowcaseChange: (showcased: boolean, slug?: string) => void;
}) {
  const [previewOpen, setPreviewOpen] = useState(false);
  return (
    <li className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
      <div className="flex flex-wrap items-center gap-3 px-4 py-3 sm:flex-nowrap sm:gap-4">
        <StatusDot status={job.status} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <Link
              href={`/app/projects/${job.projectId}/edit`}
              className="truncate font-semibold hover:underline"
            >
              {job.projectName || "(deleted project)"}
            </Link>
            <span className="font-mono text-[10px] text-[var(--color-fg-muted)]">
              {job.fps}fps · {job.quality}
            </span>
          </div>
          <div className="text-xs text-[var(--color-fg-muted)]">
            {new Date(job.createdAt).toLocaleString()}
            {job.error && (
              <span className="ml-2 text-[var(--color-danger)]">· {job.error.slice(0, 80)}</span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {job.status === "running" && (
            <>
              <progress
                value={job.progress}
                max={1}
                aria-label={`Render progress ${Math.round(job.progress * 100)}%`}
                className="w-24 sm:w-32"
              />
              <EtaBadge job={job} />
            </>
          )}
          {job.status === "queued" && (
            <span className="text-xs text-[var(--color-fg-muted)]">waiting…</span>
          )}
          {job.status === "done" && (
            <>
              <ShowcaseToggle job={job} onToggle={onShowcaseChange} />
              <ShareToggle job={job} onChange={onShareChange} />
              <a
                href={`/api/render/${job.id}/download`}
                className="rounded-md border border-[var(--color-border)] px-3 py-1 text-xs hover:bg-[var(--color-bg)]"
              >
                Download
              </a>
              <button
                onClick={() => setPreviewOpen((v) => !v)}
                className={`rounded-md border px-3 py-1 text-xs transition-colors ${
                  previewOpen
                    ? "border-[var(--color-accent)] bg-[var(--color-accent)]/10 text-[var(--color-accent)]"
                    : "border-[var(--color-border)] hover:bg-[var(--color-bg)]"
                }`}
                title="Toggle inline video preview"
              >
                {previewOpen ? "Hide" : "Preview"}
              </button>
            </>
          )}
        </div>
      </div>
      {previewOpen && job.status === "done" && (
        <div className="border-t border-[var(--color-border)] p-3">
          <video
            src={`/api/render/${job.id}/download`}
            controls
            className="mx-auto max-h-[360px] w-full rounded-md bg-black"
            preload="metadata"
          />
        </div>
      )}
    </li>
  );
}

function EtaBadge({ job }: { job: Job }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);
  if (job.progress <= 0.05) return null;
  const startMs = new Date(job.startedAt || job.createdAt).getTime();
  const elapsed = Math.max(0, Date.now() - startMs) / 1000;
  const remaining = (elapsed * (1 - job.progress)) / job.progress;
  if (!Number.isFinite(remaining) || remaining <= 0) return null;
  const label =
    remaining < 60 ? `~${Math.ceil(remaining)}s left` : `~${Math.ceil(remaining / 60)}m left`;
  return (
    <span
      className="font-mono text-xs text-[var(--color-fg-muted)]"
      title={`Progress ${(job.progress * 100).toFixed(0)}% · elapsed ${Math.round(elapsed)}s`}
    >
      {label}
    </span>
  );
}

function ShareToggle({ job, onChange }: { job: Job; onChange: (slug: string | null) => void }) {
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const toast = useToast();
  const shareUrl =
    job.publicShareSlug && typeof window !== "undefined"
      ? `${window.location.origin}/share/${job.publicShareSlug}`
      : "";

  async function enable() {
    if (busy) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/render/${job.id}/share`, {
        method: "POST",
      });
      if (!response.ok) throw new Error("failed");
      const data = (await response.json()) as { slug: string };
      onChange(data.slug);
      toast.success("Share link created");
    } catch {
      toast.error("Couldn't create a share link. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    if (busy) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/render/${job.id}/share`, { method: "DELETE" });
      if (!response.ok) throw new Error("failed");
      onChange(null);
      toast.info("Sharing disabled");
    } catch {
      toast.error("Couldn't disable sharing. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function copyLink() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
      toast.success("Link copied to clipboard");
    } catch {
      toast.error("Couldn't copy — copy the link manually.");
    }
  }

  if (!job.publicShareSlug) {
    return (
      <button
        onClick={enable}
        disabled={busy}
        className="rounded-md border border-[var(--color-border)] px-3 py-1 text-xs hover:bg-[var(--color-bg)] disabled:opacity-50"
        title="Make this render shareable with a public link"
      >
        {busy ? "…" : "Share"}
      </button>
    );
  }
  return (
    <span className="flex items-center gap-1.5 rounded-md border border-[var(--color-accent)] bg-[var(--color-bg-2)] px-2 py-0.5 text-xs">
      <button
        onClick={copyLink}
        className="text-[var(--color-accent)] hover:underline"
        title="Copy share link"
      >
        {copied ? "copied!" : "copy link"}
      </button>
      <button
        onClick={disable}
        disabled={busy}
        className="text-[var(--color-fg-muted)] hover:text-[var(--color-danger)]"
        title="Disable sharing"
        aria-label="Disable sharing"
      >
        ✕
      </button>
    </span>
  );
}

function StatusDot({ status }: { status: Job["status"] }) {
  const color =
    status === "done"
      ? "bg-[var(--color-success)]"
      : status === "failed"
        ? "bg-[var(--color-danger)]"
        : status === "running"
          ? "bg-[var(--color-accent)] animate-pulse"
          : "bg-[var(--color-fg-muted)]";
  return <span className={`inline-block h-2.5 w-2.5 rounded-full ${color}`} />;
}
