"use client";

import { Card, Loading, Stat, useAdminData } from "./ui";

type Overview = {
  users: { total: number; last24h: number; last7d: number };
  projects: { total: number };
  renders: { total: number; last24h: number; failed24h: number };
  waitlist: number;
  bugReportsLast7d: number;
  subscriptions: {
    breakdown: Record<string, { total: number; active: number }>;
    mrr: number;
  };
  usage: { chatTurns24h: number };
  errors: Array<{ id: string; source: string; message: string; at: string }>;
  topUsers: Array<{ userId: string; email: string; turns: number }>;
};

export default function OverviewTab() {
  const { data } = useAdminData<Overview>("/api/admin/overview");
  if (!data) return <Loading />;

  return (
    <div className="space-y-6">
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Users (total)" value={data.users.total} />
        <Stat label="New users · 24h" value={data.users.last24h} />
        <Stat label="New users · 7d" value={data.users.last7d} />
        <Stat label="Waitlist" value={data.waitlist} />
        <Stat label="Projects" value={data.projects.total} />
        <Stat label="Renders (done)" value={data.renders.total} />
        <Stat
          label="Renders · 24h"
          value={data.renders.last24h}
          hint={data.renders.failed24h > 0 ? `${data.renders.failed24h} failed` : undefined}
        />
        <Stat label="Chat turns · 24h" value={data.usage.chatTurns24h} />
      </section>

      <Card title="Recent errors">
        {data.errors.length === 0 ? (
          <p className="text-sm text-[var(--color-success)]">Clean — nothing in the log.</p>
        ) : (
          <ul className="space-y-1.5 font-mono text-xs">
            {data.errors.map((error) => (
              <li key={error.id} className="border-l-2 border-[var(--color-danger)] pl-2">
                <span className="text-[var(--color-fg-muted)]">[{error.source}]</span>{" "}
                <span className="text-[var(--color-fg)]">{error.message}</span>
                <div className="text-[10px] text-[var(--color-fg-muted)]">
                  {new Date(error.at).toLocaleString()}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
