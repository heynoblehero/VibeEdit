"use client";

import Link from "next/link";

// Mirror of PaywallResponse in @/lib/billing/paywall (kept as a local type so
// this client component has no server-only imports). The render/chat APIs
// return this shape with HTTP 402 when a user hits a wall; the editor detects
// `paywall === true` on the response and renders this instead of a raw error.
export type PaywallData = {
  paywall: true;
  reason: string;
  title: string;
  message: string;
  unlocks: string[];
  suggestedPlan: string;
  cta: { label: string; href: string };
  reassurance: string;
  usage?: { used: number; limit: number };
};

export function isPaywall(data: unknown): data is PaywallData {
  return !!data && typeof data === "object" && (data as { paywall?: unknown }).paywall === true;
}

export function Paywall({ data, onDismiss }: { data: PaywallData; onDismiss?: () => void }) {
  return (
    <div className="rounded-2xl border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/5 p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-[var(--color-accent)]">
            Upgrade to continue
          </div>
          <h3 className="mt-1 text-lg font-bold text-[var(--color-fg)]">{data.title}</h3>
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
            aria-label="Dismiss"
          >
            ✕
          </button>
        )}
      </div>

      <p className="mt-2 text-sm text-[var(--color-fg-muted)]">{data.message}</p>

      {data.usage && data.usage.limit !== -1 && (
        <div className="mt-3 text-xs text-[var(--color-fg-muted)]">
          Used {data.usage.used} of {data.usage.limit} this month.
        </div>
      )}

      {data.unlocks.length > 0 && (
        <ul className="mt-4 space-y-1.5">
          {data.unlocks.map((u) => (
            <li key={u} className="flex items-start gap-2 text-sm text-[var(--color-fg)]">
              <span className="mt-0.5 text-[var(--color-accent)]">→</span>
              <span>{u}</span>
            </li>
          ))}
        </ul>
      )}

      <Link
        href={data.cta.href}
        className="mt-5 inline-flex w-full items-center justify-center rounded-lg bg-[var(--color-accent)] px-4 py-2.5 text-sm font-semibold text-black transition-opacity hover:opacity-90 sm:w-auto"
      >
        {data.cta.label}
      </Link>

      {/* Don't-lose-your-work reassurance — keeps the moment from feeling like a
          dead end. */}
      <p className="mt-3 text-xs text-[var(--color-fg-subtle)]">{data.reassurance}</p>
    </div>
  );
}
