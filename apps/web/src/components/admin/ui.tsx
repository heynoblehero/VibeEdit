"use client";

// Shared admin design-system primitives. Every tab imports these instead of
// re-declaring its own Stat / StatusDot / UsageBar / card / loading state, so
// the operator console reads as one consistent system rather than five
// independently hand-rolled panels.

import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";

// ── Layout ────────────────────────────────────────────────────────────────

export function Card({
  title,
  children,
  className,
  accent,
}: {
  title?: string;
  children: ReactNode;
  className?: string;
  accent?: boolean;
}) {
  const border = accent ? "border-[var(--color-accent)]" : "border-[var(--color-border)]";
  return (
    <section
      className={`rounded-2xl border ${border} bg-[var(--color-surface)] p-4 sm:p-6 ${className ?? ""}`}
    >
      {title && (
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[var(--color-fg-muted)]">
          {title}
        </h2>
      )}
      {children}
    </section>
  );
}

export function Loading() {
  return <p className="text-sm text-[var(--color-fg-muted)]">Loading…</p>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="text-sm text-[var(--color-fg-muted)]">{children}</p>;
}

// ── Stat / status primitives ────────────────────────────────────────────────

export function Stat({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <div className="text-[10px] uppercase tracking-wider text-[var(--color-fg-muted)]">
        {label}
      </div>
      <div className="mt-1 text-2xl font-bold">{value.toLocaleString()}</div>
      {hint && <div className="text-[10px] text-[var(--color-danger)]">{hint}</div>}
    </div>
  );
}

export function StatusDot({ status }: { status: string }) {
  const color =
    status === "done"
      ? "var(--color-success)"
      : status === "failed"
        ? "var(--color-danger)"
        : "var(--color-fg-muted)";
  return (
    <span
      className="mr-1 inline-block h-2 w-2 rounded-full align-middle"
      style={{ backgroundColor: color }}
    />
  );
}

export function UsageBar({ label, used, limit }: { label: string; used: number; limit: number }) {
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-2)] p-3">
      <div className="text-[10px] uppercase tracking-wider text-[var(--color-fg-muted)]">
        {label}
      </div>
      <div className="mt-1 text-lg font-bold">
        {used}
        <span className="text-sm text-[var(--color-fg-muted)]">
          {" "}
          / {limit === -1 ? "∞" : limit}
        </span>
      </div>
      {limit > 0 && (
        <div className="mt-1.5 h-1.5 w-full rounded-full bg-[var(--color-border)]">
          <div
            className="h-full rounded-full bg-[var(--color-accent)]"
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}

export function PlanBadge({ plan, status }: { plan: string; status: string | null }) {
  const isPaid = plan !== "free";
  return (
    <span
      className={`inline-block rounded-md px-1.5 py-0.5 text-[10px] uppercase tracking-wider ${
        isPaid
          ? "bg-[var(--color-accent)]/15 text-[var(--color-accent)]"
          : "bg-[var(--color-bg-2)] text-[var(--color-fg-muted)]"
      }`}
    >
      {plan}
      {status && status !== "active" ? ` · ${status}` : ""}
    </span>
  );
}

// ── Two-click confirm button ─────────────────────────────────────────────────
// Replaces the browser confirm()/alert() dialogs, which block the whole page
// (and, per the harness rules, break automation). First click arms; second
// click within the arm window runs the action; blur/timeout disarms.

export function ConfirmButton({
  label,
  confirmLabel,
  onConfirm,
  className,
  disabled,
  busy,
}: {
  label: string;
  confirmLabel?: string;
  onConfirm: () => void;
  className?: string;
  disabled?: boolean;
  busy?: boolean;
}) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const timer = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(timer);
  }, [armed]);

  return (
    <button
      type="button"
      disabled={disabled || busy}
      onBlur={() => setArmed(false)}
      onClick={() => {
        if (armed) {
          setArmed(false);
          onConfirm();
        } else {
          setArmed(true);
        }
      }}
      className={className}
    >
      {busy ? "…" : armed ? (confirmLabel ?? "Confirm?") : label}
    </button>
  );
}

// ── Data fetching hook ───────────────────────────────────────────────────────
// One place for the GET-json-into-state pattern every tab used to hand-roll,
// with a shared loading flag and a reload() for post-mutation refreshes.

export function useAdminData<T>(url: string): {
  data: T | null;
  loading: boolean;
  reload: () => void;
} {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(() => {
    setLoading(true);
    fetch(url)
      .then((response) => (response.ok ? response.json() : null))
      .then((value) => {
        if (value) setData(value as T);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [url]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { data, loading, reload };
}
