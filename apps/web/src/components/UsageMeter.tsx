"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Metric = { used: number; limit: number };

type CreditInfo = {
  monthly: number;
  used: number;
  topups: number;
  remaining: number;
  total: number;
};

type BillingInfo = {
  plan: { id: string; name: string };
  health?: { status: string; pastDue: boolean };
  credits?: CreditInfo;
  usage: {
    renders: Metric;
    chatTurns: Metric;
    renderMinutes?: Metric;
  };
};

function pctOf(m: Metric): number {
  if (m.limit === -1) return 0;
  return Math.min(100, (m.used / m.limit) * 100);
}

// The single "closest to the wall" metric drives the header nudge so we warn on
// whichever limit the user is actually about to hit (renders OR chat OR minutes).
function tightestMetric(usage: BillingInfo["usage"]): { metric: Metric; pct: number } {
  const metrics = [usage.renders, usage.chatTurns, usage.renderMinutes].filter(
    (m): m is Metric => !!m && m.limit !== -1,
  );
  if (metrics.length === 0) return { metric: usage.renders, pct: 0 };
  let top = metrics[0];
  let topPct = pctOf(top);
  for (const m of metrics) {
    const p = pctOf(m);
    if (p > topPct) {
      top = m;
      topPct = p;
    }
  }
  return { metric: top, pct: topPct };
}

export function UsageMeter({ compact = false }: { compact?: boolean }) {
  const [info, setInfo] = useState<BillingInfo | null>(null);

  useEffect(() => {
    fetch("/api/billing/me")
      .then((r) => (r.ok ? r.json() : null))
      .then(setInfo);
  }, []);

  if (!info) return null;
  const { renders } = info.usage;
  const credits = info.credits;
  // Credits are the real currency now — drive the nudges off the credit balance
  // when present, falling back to the legacy render/chat metrics otherwise.
  const creditPct =
    credits && credits.monthly > 0 ? Math.min(100, (credits.used / credits.monthly) * 100) : null;
  const tightest = tightestMetric(info.usage);
  const pct = creditPct ?? tightest.pct;
  // 80% "you're getting close" nudge; 100% = at the wall.
  const warn = pct >= 80 && pct < 100;
  const atLimit = pct >= 100;
  const pastDue = info.health?.pastDue ?? false;
  const onFree = info.plan.id === "free";

  if (compact) {
    // Past-due takes visual priority — it's the most urgent state.
    const accent = pastDue
      ? "text-[var(--color-accent-2)]"
      : atLimit || warn
        ? "text-[var(--color-accent-2)]"
        : "text-[var(--color-fg-muted)]";
    return (
      <Link
        href="/app/billing"
        className={`flex items-center gap-1.5 rounded-lg border bg-[var(--color-surface)] px-2.5 py-1 transition-colors hover:text-[var(--color-fg)] ${
          pastDue || atLimit
            ? "border-[var(--color-accent-2)]/50"
            : warn
              ? "border-[var(--color-accent-2)]/30"
              : "border-[var(--color-border)] hover:border-[var(--color-border-2)]"
        }`}
        title={
          pastDue
            ? "Payment failed — update your card to keep your plan"
            : credits
              ? `${info.plan.name} plan — ${credits.total.toLocaleString()} credits left`
              : `${info.plan.name} plan — ${renders.used} of ${renders.limit === -1 ? "∞" : renders.limit} renders this month`
        }
      >
        <span className="font-mono text-[9px] font-bold tracking-wider text-[var(--color-fg-subtle)]">
          {info.plan.name.toUpperCase()}
        </span>
        <span className="h-3 w-px bg-[var(--color-border)]" />
        {pastDue ? (
          <span className="font-mono text-[10px] font-semibold text-[var(--color-accent-2)]">
            Payment failed
          </span>
        ) : credits ? (
          <span className={`font-mono text-[10px] ${accent}`} title="Credits remaining">
            {credits.total === -1 ? "∞" : credits.total.toLocaleString()} cr
          </span>
        ) : (
          <span className={`font-mono text-[10px] ${accent}`}>
            {renders.used}/{renders.limit === -1 ? "∞" : renders.limit}
          </span>
        )}
        {(warn || atLimit) && onFree && !pastDue && (
          <span className="rounded bg-[var(--color-accent)] px-1 py-px font-mono text-[8px] font-bold text-black">
            UPGRADE
          </span>
        )}
      </Link>
    );
  }

  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-sm">
      {pastDue && (
        <div className="mb-3 rounded-md border border-[var(--color-accent-2)]/40 bg-[var(--color-accent-2)]/8 px-3 py-2 text-xs text-[var(--color-accent-2)]">
          Your last payment failed. Update your card on the{" "}
          <Link href="/app/billing" className="underline">
            billing page
          </Link>{" "}
          to keep your plan.
        </div>
      )}
      <div className="mb-2 flex items-center justify-between">
        <div>
          <span className="font-semibold">{info.plan.name}</span>
          <span className="ml-2 text-xs text-[var(--color-fg-muted)]">plan</span>
        </div>
        <Link
          href="/app/billing"
          className="rounded-md border border-[var(--color-border)] px-3 py-1 text-xs hover:bg-[var(--color-bg)]"
        >
          Manage
        </Link>
      </div>

      {credits ? (
        <>
          <MeterRow
            label="Credits this month"
            metric={{ used: credits.used, limit: credits.monthly }}
            suffix="cr"
          />
          <div className="mb-2 flex items-center justify-between text-xs text-[var(--color-fg-muted)]">
            <span>
              {credits.total === -1 ? "∞" : credits.total.toLocaleString()} credits left
              {credits.topups > 0 ? ` · +${credits.topups.toLocaleString()} top-up` : ""}
            </span>
            <Link
              href="/app/billing#credits"
              className="rounded border border-[var(--color-border)] px-2 py-0.5 hover:bg-[var(--color-bg)]"
            >
              Buy credits
            </Link>
          </div>
        </>
      ) : (
        <>
          <MeterRow label="Renders this month" metric={info.usage.renders} />
          {info.usage.renderMinutes && (
            <MeterRow label="Render minutes" metric={info.usage.renderMinutes} suffix="min" />
          )}
          <MeterRow label="AI messages" metric={info.usage.chatTurns} />
        </>
      )}

      {/* 80% nudge + one-click upgrade. Hidden once they're already paying the
          top tier (no -1 metric in tightest means a real limit is in play). */}
      {(warn || atLimit) && (
        <Link
          href="/app/billing"
          className="mt-3 flex items-center justify-between gap-2 rounded-md bg-[var(--color-accent)] px-3 py-2 text-xs font-semibold text-black transition-opacity hover:opacity-90"
        >
          <span>
            {atLimit
              ? "You're out of credits — upgrade or buy a top-up"
              : "You're at " + Math.round(pct) + "% of your credits — top up or upgrade"}
          </span>
          <span aria-hidden>→</span>
        </Link>
      )}
    </div>
  );
}

function MeterRow({ label, metric, suffix }: { label: string; metric: Metric; suffix?: string }) {
  const pct = pctOf(metric);
  const warn = pct >= 80 && metric.limit !== -1;
  const crit = pct >= 100 && metric.limit !== -1;
  const display = metric.limit === -1 ? "∞" : `${metric.limit}${suffix ? " " + suffix : ""}`;
  return (
    <div className="mb-2 last:mb-0">
      <div className="mb-1 flex items-baseline justify-between text-xs text-[var(--color-fg-muted)]">
        <span>{label}</span>
        <span
          className={
            crit ? "text-[var(--color-accent-2)]" : warn ? "text-[var(--color-accent)]" : ""
          }
        >
          {metric.used} / {display}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-bg)]">
        <div
          className={`h-full transition-[width] ${crit ? "bg-[var(--color-accent-2)]" : "bg-[var(--color-accent)]"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
