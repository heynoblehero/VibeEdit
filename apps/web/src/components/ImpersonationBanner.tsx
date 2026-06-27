"use client";

import { useEffect, useState } from "react";

type Status = {
  impersonating: boolean;
  by?: { id: string; email: string };
  target?: { id: string; email: string; name: string };
};

export function ImpersonationBanner() {
  const [status, setStatus] = useState<Status | null>(null);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    fetch("/api/admin/impersonate/status")
      .then((r) => (r.ok ? r.json() : null))
      .then((value: Status | null) => setStatus(value))
      .catch(() => setStatus(null));
  }, []);

  if (!status?.impersonating) return null;

  async function exit() {
    setExiting(true);
    await fetch("/api/admin/impersonate", { method: "DELETE" }).catch(() => {});
    window.location.href = "/admin";
  }

  return (
    <div className="fixed inset-x-0 top-0 z-[9999] flex items-center justify-center gap-3 bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-black shadow-lg">
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M9 12l2 2 4-4" />
        <circle cx="12" cy="12" r="10" />
      </svg>
      <span>
        Impersonating <strong>{status.target?.email}</strong>
        {status.by ? <span className="opacity-70"> · as {status.by.email}</span> : null}
      </span>
      <button
        type="button"
        onClick={exit}
        disabled={exiting}
        className="rounded-lg bg-black/15 px-3 py-1 text-xs font-semibold uppercase tracking-wider transition hover:bg-black/25 disabled:opacity-50"
      >
        {exiting ? "Exiting…" : "Exit"}
      </button>
    </div>
  );
}
