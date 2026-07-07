"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, ConfirmButton, Empty, Loading, PlanBadge, StatusDot, UsageBar } from "./ui";

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

export default function UsersTab() {
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  const load = useCallback((searchQuery: string) => {
    setLoading(true);
    fetch(`/api/admin/users?q=${encodeURIComponent(searchQuery)}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((value) => {
        if (value) {
          setRows(value.users as UserRow[]);
          setTotal(value.total as number);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => load(query), 250);
    return () => clearTimeout(timer);
  }, [query, load]);

  if (selected) {
    return <UserDetail userId={selected} onBack={() => setSelected(null)} />;
  }

  return (
    <div className="space-y-4">
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
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
  user: {
    id: string;
    email: string;
    name: string;
    emailVerified: boolean;
    createdAt: string;
    isAdmin: boolean;
    banned: boolean;
    bannedReason: string | null;
    bannedAt: string | null;
  };
  subscription: {
    plan: string;
    status: string;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
    renderCredits: number;
    polarCustomerId: string | null;
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

  const reload = useCallback(() => {
    fetch(`/api/admin/users/${userId}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((value) => value && setData(value as UserDetailData))
      .catch(() => {});
  }, [userId]);

  useEffect(() => {
    reload();
  }, [reload]);

  if (!data) return <Loading />;

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

      {data.user.banned && (
        <div className="rounded-2xl border border-[var(--color-danger)] bg-[var(--color-danger)]/10 p-3 text-sm">
          <span className="font-semibold text-[var(--color-danger)]">Account banned</span>
          {data.user.bannedReason ? ` — ${data.user.bannedReason}` : ""}
          {data.user.bannedAt && (
            <span className="ml-1 text-xs text-[var(--color-fg-muted)]">
              (since {new Date(data.user.bannedAt).toLocaleString()})
            </span>
          )}
        </div>
      )}

      {data.user.isAdmin && (
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-xs text-[var(--color-fg-muted)]">
          This is an admin account. Ban, delete, and refund actions are disabled for admins.
        </div>
      )}

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

      {!data.user.isAdmin && (
        <DangerZone
          userId={data.user.id}
          email={data.user.email}
          banned={data.user.banned}
          hasPolarCustomer={!!data.subscription?.polarCustomerId}
          onChanged={reload}
          onDeleted={onBack}
        />
      )}

      <Card title={`Projects (${data.projects.length})`} className="p-4 sm:p-4">
        {data.projects.length === 0 ? (
          <Empty>No projects.</Empty>
        ) : (
          <ul className="space-y-1 text-sm">
            {data.projects.map((project) => (
              <li
                key={project.id}
                className="flex justify-between border-b border-[var(--color-border)] py-1 last:border-0"
              >
                <span>{project.name}</span>
                <span className="text-xs text-[var(--color-fg-muted)]">
                  {project.platform} · {new Date(project.updatedAt).toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Recent renders" className="p-4 sm:p-4">
        {data.renders.length === 0 ? (
          <Empty>No renders.</Empty>
        ) : (
          <ul className="space-y-1.5 text-xs">
            {data.renders.map((render) => (
              <li
                key={render.id}
                className="border-b border-[var(--color-border)] py-1 last:border-0"
              >
                <span className="font-mono">
                  <StatusDot status={render.status} /> {render.status} · {render.quality}
                </span>
                <span className="ml-2 text-[var(--color-fg-muted)]">
                  {new Date(render.createdAt).toLocaleString()}
                </span>
                {render.error && (
                  <div className="mt-0.5 font-mono text-[var(--color-danger)]">{render.error}</div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
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
    const response = await fetch("/api/admin/billing", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId, plan }),
    }).catch(() => null);
    setBusy(false);
    if (response?.ok) setDone(true);
  }

  return (
    <Card title="Grant / comp plan" className="p-4 sm:p-4">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={plan}
          onChange={(event) => setPlan(event.target.value)}
          className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-2)] px-3 py-2 text-sm"
        >
          <option value="free">Locked (no plan)</option>
          <option value="creator">Starter · $39</option>
          <option value="pro">Pro · $99</option>
          <option value="studio">Studio · $149</option>
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
    </Card>
  );
}

function DangerZone({
  userId,
  email,
  banned,
  hasPolarCustomer,
  onChanged,
  onDeleted,
}: {
  userId: string;
  email: string;
  banned: boolean;
  hasPolarCustomer: boolean;
  onChanged: () => void;
  onDeleted: () => void;
}) {
  const [banReason, setBanReason] = useState("");
  const [banBusy, setBanBusy] = useState(false);
  const [banMsg, setBanMsg] = useState<string | null>(null);
  const [refundBusy, setRefundBusy] = useState(false);
  const [refundMsg, setRefundMsg] = useState<string | null>(null);
  const [delConfirm, setDelConfirm] = useState("");
  const [delBusy, setDelBusy] = useState(false);
  const [delMsg, setDelMsg] = useState<string | null>(null);

  async function toggleBan() {
    setBanBusy(true);
    setBanMsg(null);
    const response = await fetch(`/api/admin/users/${userId}/ban`, {
      method: banned ? "DELETE" : "POST",
      headers: { "content-type": "application/json" },
      body: banned ? undefined : JSON.stringify({ reason: banReason }),
    }).catch(() => null);
    setBanBusy(false);
    if (response?.ok) {
      setBanReason("");
      onChanged();
    } else {
      setBanMsg(`Ban action failed: ${(await response?.text().catch(() => "")) || "error"}`);
    }
  }

  async function refund() {
    setRefundBusy(true);
    setRefundMsg(null);
    const response = await fetch(`/api/admin/users/${userId}/refund`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reason: "customer_request" }),
    }).catch(() => null);
    setRefundBusy(false);
    const json = await response?.json().catch(() => null);
    if (response?.ok && json?.ok) {
      setRefundMsg(`Refunded ${((json.amount ?? 0) / 100).toFixed(2)} (order ${json.orderId}).`);
    } else {
      setRefundMsg(`Not refunded: ${json?.reason ?? "error"}.`);
    }
  }

  async function remove() {
    if (delConfirm.trim().toLowerCase() !== email.toLowerCase()) {
      setDelMsg("Type the exact email to confirm.");
      return;
    }
    setDelBusy(true);
    setDelMsg(null);
    const response = await fetch(`/api/admin/users/${userId}`, {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ confirmEmail: delConfirm.trim() }),
    }).catch(() => null);
    setDelBusy(false);
    if (response?.ok) {
      onDeleted();
    } else {
      setDelMsg(`Delete failed: ${(await response?.text().catch(() => "")) || "error"}`);
    }
  }

  return (
    <section className="rounded-2xl border border-[var(--color-danger)] bg-[var(--color-surface)] p-4">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[var(--color-danger)]">
        Danger zone
      </h3>

      {/* Ban / unban */}
      <div className="mb-4 border-b border-[var(--color-border)] pb-4">
        <p className="mb-2 text-sm font-medium">{banned ? "Lift suspension" : "Ban account"}</p>
        <div className="flex flex-wrap items-center gap-2">
          {!banned && (
            <input
              type="text"
              value={banReason}
              onChange={(event) => setBanReason(event.target.value)}
              placeholder="Reason (optional)"
              className="min-w-[12rem] flex-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-2)] px-3 py-2 text-sm"
            />
          )}
          <button
            type="button"
            onClick={toggleBan}
            disabled={banBusy}
            className="rounded-xl border border-[var(--color-danger)] px-4 py-2 text-sm font-semibold text-[var(--color-danger)] disabled:opacity-50"
          >
            {banBusy ? "Working…" : banned ? "Unban" : "Ban"}
          </button>
        </div>
        {banMsg && <p className="mt-2 text-xs text-[var(--color-danger)]">{banMsg}</p>}
        <p className="mt-2 text-[10px] text-[var(--color-fg-muted)]">
          Enforced at the session level — a banned user is signed out of every request immediately.
        </p>
      </div>

      {/* Refund */}
      <div className="mb-4 border-b border-[var(--color-border)] pb-4">
        <p className="mb-2 text-sm font-medium">Refund latest payment</p>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={refund}
            disabled={refundBusy || !hasPolarCustomer}
            className="rounded-xl border border-[var(--color-border)] px-4 py-2 text-sm font-semibold disabled:opacity-50"
          >
            {refundBusy ? "Refunding…" : "Refund latest order"}
          </button>
          {!hasPolarCustomer && (
            <span className="text-xs text-[var(--color-fg-muted)]">No Polar customer on file.</span>
          )}
          {refundMsg && <span className="text-xs text-[var(--color-fg-muted)]">{refundMsg}</span>}
        </div>
      </div>

      {/* Hard delete */}
      <div>
        <p className="mb-2 text-sm font-medium text-[var(--color-danger)]">Remove account</p>
        <p className="mb-2 text-xs text-[var(--color-fg-muted)]">
          Permanently deletes the user, all projects/renders/subscriptions, on-disk storage, and
          cancels any Polar subscription. Type <span className="font-mono">{email}</span> to
          confirm.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={delConfirm}
            onChange={(event) => setDelConfirm(event.target.value)}
            placeholder={email}
            className="min-w-[14rem] flex-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-2)] px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={remove}
            disabled={delBusy || delConfirm.trim().toLowerCase() !== email.toLowerCase()}
            className="rounded-xl bg-[var(--color-danger)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {delBusy ? "Deleting…" : "Delete permanently"}
          </button>
        </div>
        {delMsg && <p className="mt-2 text-xs text-[var(--color-danger)]">{delMsg}</p>}
      </div>
    </section>
  );
}

function ImpersonateButton({ userId, email }: { userId: string; email: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function go() {
    setBusy(true);
    setError(false);
    const response = await fetch("/api/admin/impersonate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ targetUserId: userId }),
    }).catch(() => null);
    if (response?.ok) {
      window.location.href = "/app/projects";
    } else {
      setBusy(false);
      setError(true);
    }
  }

  return (
    <span className="inline-flex items-center gap-1">
      <ConfirmButton
        label="Log in as"
        confirmLabel={`Log in as ${email}?`}
        onConfirm={go}
        busy={busy}
        className="rounded-lg border border-[var(--color-accent)] px-2.5 py-1 text-xs font-medium text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10 disabled:opacity-50"
      />
      {error && <span className="text-[10px] text-[var(--color-danger)]">failed</span>}
    </span>
  );
}
