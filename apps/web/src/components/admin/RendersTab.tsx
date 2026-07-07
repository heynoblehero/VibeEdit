"use client";

import { useState } from "react";
import { Loading, StatusDot, useAdminData } from "./ui";

type RenderRow = {
  id: string;
  userEmail: string | null;
  projectName: string | null;
  status: string;
  quality: string;
  error: string | null;
  createdAt: string;
};

type RenderOps = { counts: Record<string, number>; jobs: RenderRow[] };

export default function RendersTab() {
  const { data, reload } = useAdminData<RenderOps>("/api/admin/render-ops");
  const [retrying, setRetrying] = useState<string | null>(null);

  async function retry(id: string) {
    setRetrying(id);
    await fetch(`/api/admin/render-ops/${id}/retry`, { method: "POST" }).catch(() => {});
    setRetrying(null);
    reload();
  }

  if (!data) return <Loading />;

  return (
    <div className="space-y-4">
      <section className="flex flex-wrap gap-2">
        {Object.entries(data.counts).map(([status, count]) => (
          <div
            key={status}
            className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-2)] px-3 py-1.5 text-xs"
          >
            <StatusDot status={status} /> {status}: <span className="font-mono">{count}</span>
          </div>
        ))}
        <span className="self-center text-[10px] text-[var(--color-fg-muted)]">last 7 days</span>
      </section>

      <div className="overflow-x-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]">
        <table className="w-full text-sm">
          <thead className="text-left text-[10px] uppercase tracking-wider text-[var(--color-fg-muted)]">
            <tr className="border-b border-[var(--color-border)]">
              <th className="p-3">User</th>
              <th className="p-3">Project</th>
              <th className="p-3">Status</th>
              <th className="p-3">Error</th>
              <th className="p-3">When</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {data.jobs.map((job) => (
              <tr
                key={job.id}
                className="border-b border-[var(--color-border)] align-top last:border-0"
              >
                <td className="p-3 text-xs">{job.userEmail || "—"}</td>
                <td className="p-3 text-xs">{job.projectName || "—"}</td>
                <td className="p-3 text-xs">
                  <StatusDot status={job.status} /> {job.status}
                </td>
                <td className="max-w-xs p-3 font-mono text-[10px] text-[var(--color-danger)]">
                  {job.error || ""}
                </td>
                <td className="p-3 text-[10px] text-[var(--color-fg-muted)]">
                  {new Date(job.createdAt).toLocaleString()}
                </td>
                <td className="p-3 text-right">
                  {job.status === "failed" && (
                    <button
                      type="button"
                      onClick={() => retry(job.id)}
                      disabled={retrying === job.id}
                      className="rounded-lg border border-[var(--color-border)] px-2.5 py-1 text-xs hover:bg-[var(--color-bg-2)] disabled:opacity-50"
                    >
                      {retrying === job.id ? "…" : "Retry"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] text-[var(--color-fg-muted)]">
        Retry resets the job to queued; full re-enqueue semantics live in the render queue (wiring
        pending).
      </p>
    </div>
  );
}
