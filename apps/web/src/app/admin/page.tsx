"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import { Wordmark } from "@/components/Wordmark";

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

export default function AdminPage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [data, setData] = useState<Overview | null>(null);
  const [status, setStatus] = useState<"loading" | "ok" | "forbidden">("loading");

  useEffect(() => {
    if (!isPending && !session) router.replace("/app/login");
  }, [isPending, session, router]);

  useEffect(() => {
    if (!session) return;
    fetch("/api/admin/overview")
      .then(async (r) => {
        if (r.status === 403) {
          setStatus("forbidden");
          return null;
        }
        if (!r.ok) throw new Error(await r.text());
        return r.json();
      })
      .then((value) => {
        if (value) {
          setData(value as Overview);
          setStatus("ok");
        }
      })
      .catch(() => setStatus("forbidden"));
  }, [session]);

  if (isPending || !session) return null;

  if (status === "forbidden") {
    return (
      <main className="mx-auto max-w-2xl p-8">
        <h1 className="mb-3 text-2xl font-bold">Not for you 👋</h1>
        <p className="text-[var(--color-fg-muted)]">
          This page is for the operator only. Set{" "}
          <code className="rounded bg-[var(--color-bg-2)] px-1">ADMIN_EMAILS</code> in your env to
          your account email if this is your deployment.
        </p>
        <Link
          href="/app/projects"
          className="mt-4 inline-block text-[var(--color-accent)] underline"
        >
          Back to the app →
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl p-4 sm:p-8">
      <header className="mb-6 flex items-center justify-between">
        <Link href="/app/projects">
          <Wordmark size="md" />
        </Link>
        <span className="text-xs uppercase tracking-wider text-[var(--color-accent)]">Admin</span>
      </header>

      <h1 className="mb-1 text-2xl font-bold sm:text-3xl">Operator dashboard</h1>
      <p className="mb-6 text-sm text-[var(--color-fg-muted)]">
        Auto-refreshes on reload. Numbers are point-in-time from the live DB.
      </p>

      {!data ? (
        <p className="text-sm text-[var(--color-fg-muted)]">Loading…</p>
      ) : (
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

          <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:p-6">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[var(--color-fg-muted)]">
              Subscriptions
            </h2>
            <div className="grid gap-3 sm:grid-cols-3">
              {Object.entries(data.subscriptions.breakdown).map(([plan, counts]) => (
                <div
                  key={plan}
                  className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-2)] p-3"
                >
                  <div className="text-xs uppercase text-[var(--color-fg-muted)]">{plan}</div>
                  <div className="mt-1 text-xl font-bold">
                    {counts.active}
                    <span className="text-sm text-[var(--color-fg-muted)]"> / {counts.total}</span>
                  </div>
                  <div className="text-[10px] text-[var(--color-fg-muted)]">active / total</div>
                </div>
              ))}
              <div className="rounded-md border border-[var(--color-accent)] bg-[var(--color-bg-2)] p-3">
                <div className="text-xs uppercase text-[var(--color-accent)]">Estimated MRR</div>
                <div className="mt-1 text-xl font-bold">
                  ${data.subscriptions.mrr.toLocaleString()}
                </div>
                <div className="text-[10px] text-[var(--color-fg-muted)]">
                  sum of active-plan prices
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:p-6">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[var(--color-fg-muted)]">
              Top users · last 30d (by chat turns)
            </h2>
            {data.topUsers.length === 0 ? (
              <p className="text-sm text-[var(--color-fg-muted)]">No usage in the last 30 days.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-left text-[10px] uppercase tracking-wider text-[var(--color-fg-muted)]">
                  <tr>
                    <th className="pb-2">Email</th>
                    <th className="pb-2 text-right">Turns</th>
                  </tr>
                </thead>
                <tbody>
                  {data.topUsers.map((row) => (
                    <tr key={row.userId} className="border-t border-[var(--color-border)]">
                      <td className="py-1.5 truncate">{row.email}</td>
                      <td className="py-1.5 text-right font-mono">{row.turns}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:p-6">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-fg-muted)]">
                Recent errors
              </h2>
              <span className="text-xs text-[var(--color-fg-muted)]">
                {data.bugReportsLast7d} user bug reports · 7d
              </span>
            </div>
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
          </section>
        </div>
      )}
    </main>
  );
}

function Stat({ label, value, hint }: { label: string; value: number; hint?: string }) {
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
