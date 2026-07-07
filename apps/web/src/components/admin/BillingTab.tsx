"use client";

import { Card, Loading, Stat, useAdminData } from "./ui";

type BillingData = {
  breakdown: Record<string, { total: number; active: number }>;
  mrr: number;
  trials: number;
  problems: number;
};

export default function BillingTab() {
  const { data } = useAdminData<BillingData>("/api/admin/billing");
  if (!data) return <Loading />;

  return (
    <div className="space-y-4">
      <section className="grid gap-3 sm:grid-cols-3">
        <Card accent className="p-4 sm:p-4">
          <div className="text-[10px] uppercase tracking-wider text-[var(--color-accent)]">
            Estimated MRR
          </div>
          <div className="mt-1 text-2xl font-bold">${data.mrr.toLocaleString()}</div>
        </Card>
        <Stat label="Trials" value={data.trials} />
        <Stat label="Payment problems" value={data.problems} />
      </section>

      <Card title="Subscriptions by plan">
        <div className="grid gap-3 sm:grid-cols-3">
          {Object.entries(data.breakdown).map(([plan, counts]) => (
            <div
              key={plan}
              className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-2)] p-3"
            >
              <div className="text-xs uppercase text-[var(--color-fg-muted)]">{plan}</div>
              <div className="mt-1 text-xl font-bold">
                {counts.active}
                <span className="text-sm text-[var(--color-fg-muted)]"> / {counts.total}</span>
              </div>
              <div className="text-[10px] text-[var(--color-fg-muted)]">active / total</div>
            </div>
          ))}
        </div>
      </Card>
      <p className="text-xs text-[var(--color-fg-muted)]">
        Use the Users tab to grant or comp a plan to an individual account.
      </p>
    </div>
  );
}
