"use client";

import { useEffect, useState } from "react";

/*
 * "Analytics" tab for the admin console. Fetches /api/admin/growth (live DB)
 * and renders 30-day trends, the signup→activated→paying funnel, and unit
 * economics — the direction/ratio view that complements the point-in-time
 * Overview tab. Dependency-free CSS charts so it needs no charting library.
 */

type Growth = {
  windowDays: number;
  series: Array<{ day: string; signups: number; renders: number; failures: number }>;
  funnel: { signups: number; activated: number; paying: number; signupToActivatedPct: number };
  economics: {
    mrr: number;
    arr: number;
    payingUsers: number;
    freeUsers: number;
    totalUsers: number;
    freeToPaidPct: number;
    arpu: number;
    planBreakdown: Record<string, number>;
  };
  renderHealth: {
    total: number;
    done: number;
    failed: number;
    successPct: number;
    avgSeconds: number;
  };
};

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <div className="text-xs font-medium uppercase tracking-wider text-[var(--color-fg-muted)]">
        {label}
      </div>
      <div className="mt-1 text-2xl font-bold text-[var(--color-fg)]">{value}</div>
      {hint ? <div className="mt-0.5 text-xs text-[var(--color-fg-muted)]">{hint}</div> : null}
    </div>
  );
}

// A dependency-free SVG area+line chart (one point per day). Self-contained so
// it respects the app CSP — no charting library, no external assets. The area
// is filled with a soft gradient under a crisp line; hover a point for its value.
function BarChart({
  title,
  data,
  color,
}: {
  title: string;
  data: Array<{ day: string; value: number }>;
  color: string;
}) {
  const max = Math.max(1, ...data.map((point) => point.value));
  const total = data.reduce((sum, point) => sum + point.value, 0);
  const peak = Math.max(0, ...data.map((point) => point.value));

  const width = 100;
  const height = 40;
  const count = Math.max(1, data.length - 1);
  const xFor = (index: number) => (index / count) * width;
  const yFor = (value: number) => height - (value / max) * (height - 3) - 1;

  const points = data.map((point, index) => ({ x: xFor(index), y: yFor(point.value), point }));
  const line = points.map((p, index) => `${index === 0 ? "M" : "L"}${p.x} ${p.y}`).join(" ");
  const area = points.length
    ? `${line} L${points[points.length - 1].x} ${height} L${points[0].x} ${height} Z`
    : "";
  // Stable gradient id per chart so multiple charts on one page don't collide.
  const gradientId = `growth-fill-${title.replace(/[^a-z0-9]/gi, "")}`;

  return (
    <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:p-6">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-fg-muted)]">
          {title}
        </h2>
        <span className="text-xs text-[var(--color-fg-muted)]">
          {total.toLocaleString()} total · peak {peak.toLocaleString()}
        </span>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="h-28 w-full"
        role="img"
        aria-label={`${title}: ${total} total over ${data.length} days`}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.35" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {area && <path d={area} fill={`url(#${gradientId})`} />}
        {line && (
          <path
            d={line}
            fill="none"
            stroke={color}
            strokeWidth="1.2"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        )}
        {points.map(({ x, y, point }) => (
          <circle key={point.day} cx={x} cy={y} r="1.1" fill={color}>
            <title>{`${point.day}: ${point.value}`}</title>
          </circle>
        ))}
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-[var(--color-fg-muted)]">
        <span>{data[0]?.day}</span>
        <span>{data[data.length - 1]?.day}</span>
      </div>
    </section>
  );
}

// A horizontal funnel stage bar.
function FunnelStage({
  label,
  value,
  pctOfTop,
}: {
  label: string;
  value: number;
  pctOfTop: number;
}) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-sm">
        <span className="text-[var(--color-fg)]">{label}</span>
        <span className="text-[var(--color-fg-muted)]">
          {value} · {pctOfTop.toFixed(0)}%
        </span>
      </div>
      <div className="h-3 overflow-hidden rounded bg-[var(--color-bg-2)]">
        <div
          className="h-full rounded bg-[var(--color-accent)]"
          style={{ width: `${Math.min(100, Math.max(2, pctOfTop))}%` }}
        />
      </div>
    </div>
  );
}

export default function GrowthPanel() {
  const [data, setData] = useState<Growth | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch("/api/admin/growth")
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((value) => setData(value as Growth))
      .catch(() => setError(true));
  }, []);

  if (error) return <p className="text-sm text-[var(--color-danger)]">Couldn't load analytics.</p>;
  if (!data) return <p className="text-sm text-[var(--color-fg-muted)]">Loading…</p>;

  const { economics: eco, funnel, renderHealth: health } = data;
  const money = (value: number) => `$${value.toLocaleString()}`;
  const topOfFunnel = Math.max(1, funnel.signups);

  return (
    <div className="space-y-6">
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label="MRR" value={money(eco.mrr)} hint={`${money(eco.arr)} ARR`} />
        <Tile
          label="Paying users"
          value={String(eco.payingUsers)}
          hint={`${eco.freeUsers} free · ${eco.totalUsers} total`}
        />
        <Tile label="Free → paid" value={`${eco.freeToPaidPct.toFixed(1)}%`} />
        <Tile label="ARPU" value={money(Math.round(eco.arpu))} hint="per paying user / mo" />
        <Tile
          label="Render success"
          value={`${health.successPct.toFixed(1)}%`}
          hint={`${health.done}/${health.total} · ${health.failed} failed (30d)`}
        />
        <Tile label="Avg render time" value={`${health.avgSeconds}s`} hint="wall-clock, 30d" />
        <Tile label="New signups · 30d" value={String(funnel.signups)} />
        <Tile
          label="Activation"
          value={`${funnel.signupToActivatedPct.toFixed(0)}%`}
          hint="signed up → rendered"
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <BarChart
          title="Signups / day (30d)"
          color="var(--color-accent)"
          data={data.series.map((point) => ({ day: point.day, value: point.signups }))}
        />
        <BarChart
          title="Renders / day (30d)"
          color="var(--color-success, #22c55e)"
          data={data.series.map((point) => ({ day: point.day, value: point.renders }))}
        />
      </div>

      <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:p-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-[var(--color-fg-muted)]">
          Funnel · last 30 days
        </h2>
        <div className="space-y-3">
          <FunnelStage label="Signed up" value={funnel.signups} pctOfTop={100} />
          <FunnelStage
            label="Activated (rendered ≥1)"
            value={funnel.activated}
            pctOfTop={(funnel.activated / topOfFunnel) * 100}
          />
          <FunnelStage
            label="Paying (current)"
            value={funnel.paying}
            pctOfTop={(funnel.paying / topOfFunnel) * 100}
          />
        </div>
        {Object.keys(eco.planBreakdown).length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2 text-xs text-[var(--color-fg-muted)]">
            {Object.entries(eco.planBreakdown).map(([plan, count]) => (
              <span key={plan} className="rounded bg-[var(--color-bg-2)] px-2 py-1">
                {plan}: {count}
              </span>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}
