"use client";

import { useCallback, useEffect, useState } from "react";
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

type Tab = "overview" | "users" | "billing" | "renders" | "moderation";

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "users", label: "Users" },
  { id: "billing", label: "Billing" },
  { id: "renders", label: "Render ops" },
  { id: "moderation", label: "Moderation" },
];

export default function AdminPage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [status, setStatus] = useState<"loading" | "ok" | "forbidden">("loading");
  const [tab, setTab] = useState<Tab>("overview");

  useEffect(() => {
    if (!isPending && !session) router.replace("/app/login");
  }, [isPending, session, router]);

  useEffect(() => {
    if (!session) return;
    // Probe the overview endpoint just to determine admin access.
    fetch("/api/admin/overview")
      .then((r) => {
        if (r.status === 403 || r.status === 401) {
          setStatus("forbidden");
          return;
        }
        setStatus("ok");
      })
      .catch(() => setStatus("forbidden"));
  }, [session]);

  if (isPending || !session) return null;

  if (status === "forbidden") {
    return (
      <main className="mx-auto max-w-2xl p-8">
        <h1 className="mb-3 text-2xl font-bold">Not for you</h1>
        <p className="text-[var(--color-fg-muted)]">
          This page is for the operator only. Set{" "}
          <code className="rounded bg-[var(--color-bg-2)] px-1">ADMIN_EMAILS</code> in your env to
          your account email if this is your deployment.
        </p>
        <Link
          href="/app/projects"
          className="mt-4 inline-block text-[var(--color-accent)] underline"
        >
          Back to the app
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

      <h1 className="mb-1 text-2xl font-bold sm:text-3xl">Operator console</h1>
      <p className="mb-5 text-sm text-[var(--color-fg-muted)]">
        Single pane for users, billing, renders and moderation. Numbers are live from the DB.
      </p>

      <nav className="mb-6 flex flex-wrap gap-1 border-b border-[var(--color-border)]">
        {TABS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            onClick={() => setTab(entry.id)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition ${
              tab === entry.id
                ? "border-[var(--color-accent)] text-[var(--color-fg)]"
                : "border-transparent text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
            }`}
          >
            {entry.label}
          </button>
        ))}
      </nav>

      {tab === "overview" && <OverviewTab />}
      {tab === "users" && <UsersTab />}
      {tab === "billing" && <BillingTab />}
      {tab === "renders" && <RendersTab />}
      {tab === "moderation" && <ModerationTab />}
    </main>
  );
}

// ── Overview ──────────────────────────────────────────────────────────────

function OverviewTab() {
  const [data, setData] = useState<Overview | null>(null);
  useEffect(() => {
    fetch("/api/admin/overview")
      .then((r) => (r.ok ? r.json() : null))
      .then((v) => v && setData(v as Overview))
      .catch(() => {});
  }, []);

  if (!data) return <p className="text-sm text-[var(--color-fg-muted)]">Loading…</p>;

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

      <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:p-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[var(--color-fg-muted)]">
          Recent errors
        </h2>
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
  );
}

// ── Users ─────────────────────────────────────────────────────────────────

type UserRow = {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
  createdAt: string;
  plan: string;
  subStatus: string | null;
  projectCount: number;
  renderCount: number;
  failedRenders: number;
  chatTurnsThisMonth: number;
};

function UsersTab() {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  const load = useCallback((query: string) => {
    setLoading(true);
    fetch(`/api/admin/users?q=${encodeURIComponent(query)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((v) => {
        if (v) {
          setRows(v.users as UserRow[]);
          setTotal(v.total as number);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const t = setTimeout(() => load(q), 250);
    return () => clearTimeout(t);
  }, [q, load]);

  if (selected) {
    return <UserDetail userId={selected} onBack={() => setSelected(null)} />;
  }

  return (
    <div className="space-y-4">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search by email or name…"
        className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-2)] px-4 py-2.5 text-sm outline-none focus:border-[var(--color-accent)]"
      />
      <p className="text-xs text-[var(--color-fg-muted)]">
        {loading ? "Loading…" : `${rows.length} shown · ${total} total`}
      </p>
      <div className="overflow-x-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]">
        <table className="w-full text-sm">
          <thead className="text-left text-[10px] uppercase tracking-wider text-[var(--color-fg-muted)]">
            <tr className="border-b border-[var(--color-border)]">
              <th className="p-3">Email</th>
              <th className="p-3">Plan</th>
              <th className="p-3 text-right">Projects</th>
              <th className="p-3 text-right">Renders</th>
              <th className="p-3 text-right">Chat · mo</th>
              <th className="p-3">Joined</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-bg-2)]"
              >
                <td className="p-3">
                  <button
                    type="button"
                    onClick={() => setSelected(row.id)}
                    className="text-left text-[var(--color-accent)] hover:underline"
                  >
                    {row.email}
                  </button>
                  {!row.emailVerified && (
                    <span className="ml-1 text-[10px] text-[var(--color-fg-muted)]">
                      (unverified)
                    </span>
                  )}
                </td>
                <td className="p-3">
                  <PlanBadge plan={row.plan} status={row.subStatus} />
                </td>
                <td className="p-3 text-right font-mono">{row.projectCount}</td>
                <td className="p-3 text-right font-mono">
                  {row.renderCount}
                  {row.failedRenders > 0 && (
                    <span className="text-[var(--color-danger)]"> ·{row.failedRenders}✗</span>
                  )}
                </td>
                <td className="p-3 text-right font-mono">{row.chatTurnsThisMonth}</td>
                <td className="p-3 text-xs text-[var(--color-fg-muted)]">
                  {new Date(row.createdAt).toLocaleDateString()}
                </td>
                <td className="p-3 text-right">
                  <ImpersonateButton userId={row.id} email={row.email} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

type UserDetailData = {
  user: { id: string; email: string; name: string; emailVerified: boolean; createdAt: string };
  subscription: {
    plan: string;
    status: string;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
    renderCredits: number;
  } | null;
  plan: { id: string; name: string; renderLimit: number; chatTurnLimit: number };
  usage: {
    renders: { used: number; limit: number };
    chatTurns: { used: number; limit: number };
    renderMinutes: { used: number; limit: number };
  };
  projects: Array<{ id: string; name: string; platform: string; updatedAt: string }>;
  renders: Array<{
    id: string;
    status: string;
    quality: string;
    error: string | null;
    createdAt: string;
  }>;
};

function UserDetail({ userId, onBack }: { userId: string; onBack: () => void }) {
  const [data, setData] = useState<UserDetailData | null>(null);

  useEffect(() => {
    fetch(`/api/admin/users/${userId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((v) => v && setData(v as UserDetailData))
      .catch(() => {});
  }, [userId]);

  if (!data) return <p className="text-sm text-[var(--color-fg-muted)]">Loading…</p>;

  return (
    <div className="space-y-5">
      <button
        type="button"
        onClick={onBack}
        className="text-sm text-[var(--color-accent)] hover:underline"
      >
        ← Back to users
      </button>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">{data.user.email}</h2>
          <p className="text-xs text-[var(--color-fg-muted)]">
            {data.user.name} · joined {new Date(data.user.createdAt).toLocaleDateString()} ·{" "}
            <PlanBadge plan={data.plan.id} status={data.subscription?.status ?? null} />
          </p>
        </div>
        <ImpersonateButton userId={data.user.id} email={data.user.email} />
      </div>

      <section className="grid gap-3 sm:grid-cols-3">
        <UsageBar
          label="Renders · mo"
          used={data.usage.renders.used}
          limit={data.usage.renders.limit}
        />
        <UsageBar
          label="Chat turns · mo"
          used={data.usage.chatTurns.used}
          limit={data.usage.chatTurns.limit}
        />
        <UsageBar
          label="Render mins · mo"
          used={data.usage.renderMinutes.used}
          limit={data.usage.renderMinutes.limit}
        />
      </section>

      <GrantPlan userId={data.user.id} current={data.subscription?.plan ?? "free"} />

      <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[var(--color-fg-muted)]">
          Projects ({data.projects.length})
        </h3>
        {data.projects.length === 0 ? (
          <p className="text-sm text-[var(--color-fg-muted)]">No projects.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {data.projects.map((p) => (
              <li
                key={p.id}
                className="flex justify-between border-b border-[var(--color-border)] py-1 last:border-0"
              >
                <span>{p.name}</span>
                <span className="text-xs text-[var(--color-fg-muted)]">
                  {p.platform} · {new Date(p.updatedAt).toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[var(--color-fg-muted)]">
          Recent renders
        </h3>
        {data.renders.length === 0 ? (
          <p className="text-sm text-[var(--color-fg-muted)]">No renders.</p>
        ) : (
          <ul className="space-y-1.5 text-xs">
            {data.renders.map((r) => (
              <li key={r.id} className="border-b border-[var(--color-border)] py-1 last:border-0">
                <span className="font-mono">
                  <StatusDot status={r.status} /> {r.status} · {r.quality}
                </span>
                <span className="ml-2 text-[var(--color-fg-muted)]">
                  {new Date(r.createdAt).toLocaleString()}
                </span>
                {r.error && (
                  <div className="mt-0.5 font-mono text-[var(--color-danger)]">{r.error}</div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function GrantPlan({ userId, current }: { userId: string; current: string }) {
  const [plan, setPlan] = useState(current);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function grant() {
    setBusy(true);
    setDone(false);
    const r = await fetch("/api/admin/billing", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId, plan }),
    }).catch(() => null);
    setBusy(false);
    if (r?.ok) setDone(true);
  }

  return (
    <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[var(--color-fg-muted)]">
        Grant / comp plan
      </h3>
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={plan}
          onChange={(e) => setPlan(e.target.value)}
          className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-2)] px-3 py-2 text-sm"
        >
          <option value="free">Free</option>
          <option value="creator">Creator</option>
          <option value="studio">Studio</option>
        </select>
        <button
          type="button"
          onClick={grant}
          disabled={busy}
          className="rounded-xl bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-black disabled:opacity-50"
        >
          {busy ? "Applying…" : "Apply"}
        </button>
        {done && <span className="text-sm text-[var(--color-success)]">Updated ✓</span>}
      </div>
      <p className="mt-2 text-[10px] text-[var(--color-fg-muted)]">
        Sets subscription status to active. Audited in the error log.
      </p>
    </section>
  );
}

// ── Billing ─────────────────────────────────────────────────────────────────

type BillingData = {
  breakdown: Record<string, { total: number; active: number }>;
  mrr: number;
  trials: number;
  problems: number;
};

function BillingTab() {
  const [data, setData] = useState<BillingData | null>(null);
  useEffect(() => {
    fetch("/api/admin/billing")
      .then((r) => (r.ok ? r.json() : null))
      .then((v) => v && setData(v as BillingData))
      .catch(() => {});
  }, []);

  if (!data) return <p className="text-sm text-[var(--color-fg-muted)]">Loading…</p>;

  return (
    <div className="space-y-4">
      <section className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-[var(--color-accent)] bg-[var(--color-surface)] p-4">
          <div className="text-[10px] uppercase tracking-wider text-[var(--color-accent)]">
            Estimated MRR
          </div>
          <div className="mt-1 text-2xl font-bold">${data.mrr.toLocaleString()}</div>
        </div>
        <Stat label="Trials" value={data.trials} />
        <Stat label="Payment problems" value={data.problems} />
      </section>

      <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:p-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[var(--color-fg-muted)]">
          Subscriptions by plan
        </h2>
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
      </section>
      <p className="text-xs text-[var(--color-fg-muted)]">
        Use the Users tab to grant or comp a plan to an individual account.
      </p>
    </div>
  );
}

// ── Render ops ──────────────────────────────────────────────────────────────

type RenderRow = {
  id: string;
  userEmail: string | null;
  projectName: string | null;
  status: string;
  quality: string;
  error: string | null;
  createdAt: string;
};

function RendersTab() {
  const [data, setData] = useState<{ counts: Record<string, number>; jobs: RenderRow[] } | null>(
    null,
  );
  const [retrying, setRetrying] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch("/api/admin/render-ops")
      .then((r) => (r.ok ? r.json() : null))
      .then((v) => v && setData(v))
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function retry(id: string) {
    setRetrying(id);
    await fetch(`/api/admin/render-ops/${id}/retry`, { method: "POST" }).catch(() => {});
    setRetrying(null);
    load();
  }

  if (!data) return <p className="text-sm text-[var(--color-fg-muted)]">Loading…</p>;

  return (
    <div className="space-y-4">
      <section className="flex flex-wrap gap-2">
        {Object.entries(data.counts).map(([s, n]) => (
          <div
            key={s}
            className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-2)] px-3 py-1.5 text-xs"
          >
            <StatusDot status={s} /> {s}: <span className="font-mono">{n}</span>
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

// ── Moderation ──────────────────────────────────────────────────────────────

type ModSnippet = {
  id: string;
  label: string;
  description: string | null;
  isPublic: boolean;
  likesCount: number;
  userEmail: string | null;
  createdAt: string;
};
type ModShowcase = {
  id: string;
  showcased: boolean;
  publicShareSlug: string | null;
  userEmail: string | null;
  createdAt: string;
};

function ModerationTab() {
  const [data, setData] = useState<{ snippets: ModSnippet[]; showcased: ModShowcase[] } | null>(
    null,
  );

  const load = useCallback(() => {
    fetch("/api/admin/moderation")
      .then((r) => (r.ok ? r.json() : null))
      .then((v) => v && setData(v))
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function toggle(type: "snippet" | "showcase", id: string, visible: boolean) {
    await fetch("/api/admin/moderation", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type, id, visible }),
    }).catch(() => {});
    load();
  }

  if (!data) return <p className="text-sm text-[var(--color-fg-muted)]">Loading…</p>;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[var(--color-fg-muted)]">
          Public marketplace snippets ({data.snippets.length})
        </h2>
        {data.snippets.length === 0 ? (
          <p className="text-sm text-[var(--color-fg-muted)]">Nothing public.</p>
        ) : (
          <ul className="space-y-2">
            {data.snippets.map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between gap-3 border-b border-[var(--color-border)] pb-2 last:border-0"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{s.label}</div>
                  <div className="truncate text-xs text-[var(--color-fg-muted)]">
                    {s.userEmail || "—"} · {s.likesCount} likes
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => toggle("snippet", s.id, false)}
                  className="shrink-0 rounded-lg border border-[var(--color-danger)] px-2.5 py-1 text-xs text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10"
                >
                  Unpublish
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[var(--color-fg-muted)]">
          Showcased renders ({data.showcased.length})
        </h2>
        {data.showcased.length === 0 ? (
          <p className="text-sm text-[var(--color-fg-muted)]">Nothing showcased.</p>
        ) : (
          <ul className="space-y-2">
            {data.showcased.map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between gap-3 border-b border-[var(--color-border)] pb-2 last:border-0"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm">{s.publicShareSlug || s.id}</div>
                  <div className="truncate text-xs text-[var(--color-fg-muted)]">
                    {s.userEmail || "—"}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => toggle("showcase", s.id, false)}
                  className="shrink-0 rounded-lg border border-[var(--color-danger)] px-2.5 py-1 text-xs text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10"
                >
                  Hide
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

// ── Shared bits ─────────────────────────────────────────────────────────────

function ImpersonateButton({ userId, email }: { userId: string; email: string }) {
  const [busy, setBusy] = useState(false);

  async function go() {
    if (!confirm(`Log in as ${email}? You will see the app exactly as they do.`)) return;
    setBusy(true);
    const r = await fetch("/api/admin/impersonate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ targetUserId: userId }),
    }).catch(() => null);
    if (r?.ok) {
      window.location.href = "/app/projects";
    } else {
      setBusy(false);
      alert("Could not start impersonation.");
    }
  }

  return (
    <button
      type="button"
      onClick={go}
      disabled={busy}
      className="rounded-lg border border-[var(--color-accent)] px-2.5 py-1 text-xs font-medium text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10 disabled:opacity-50"
    >
      {busy ? "…" : "Log in as"}
    </button>
  );
}

function PlanBadge({ plan, status }: { plan: string; status: string | null }) {
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

function StatusDot({ status }: { status: string }) {
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

function UsageBar({ label, used, limit }: { label: string; used: number; limit: number }) {
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
