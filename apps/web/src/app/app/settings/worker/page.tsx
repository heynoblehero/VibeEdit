"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import { Wordmark } from "@/components/Wordmark";

type TokenRow = {
  token: string;
  name: string;
  lastSeenAt: string | null;
  createdAt: string;
};

type Status = {
  hasWorker: boolean;
  cloudSecondsUsed: number;
  cloudSecondsLimit: number;
  blocked: boolean;
};

export default function WorkerSettingsPage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [tokens, setTokens] = useState<TokenRow[]>([]);
  const [showToken, setShowToken] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);

  useEffect(() => {
    if (!isPending && !session) router.replace("/app/login");
  }, [isPending, session, router]);

  async function refresh() {
    const [tokensRes, statusRes] = await Promise.all([
      fetch("/api/worker/tokens"),
      fetch("/api/worker/status"),
    ]);
    if (tokensRes.ok) {
      setTokens(((await tokensRes.json()) as { tokens: TokenRow[] }).tokens);
    }
    if (statusRes.ok) {
      setStatus((await statusRes.json()) as Status);
    }
  }

  useEffect(() => {
    if (session) refresh();
  }, [session]);

  useEffect(() => {
    if (!session) return;
    const id = setInterval(refresh, 15_000);
    return () => clearInterval(id);
  }, [session]);

  async function create() {
    setCreating(true);
    const name = window.prompt("Name this worker (e.g. 'my mac')", "default");
    if (!name) {
      setCreating(false);
      return;
    }
    const r = await fetch("/api/worker/tokens", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setCreating(false);
    if (!r.ok) return;
    const data = (await r.json()) as { token: string };
    setShowToken(data.token);
    refresh();
  }

  async function revoke(prefix: string) {
    if (!confirm("Revoke this worker token? The worker will stop polling.")) return;
    await fetch(`/api/worker/tokens?prefix=${encodeURIComponent(prefix)}`, {
      method: "DELETE",
    });
    refresh();
  }

  if (isPending || !session) return null;

  return (
    <main className="mx-auto max-w-3xl p-4 sm:p-8">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-3 sm:mb-10">
        <Link href="/app/projects">
          <Wordmark size="md" />
        </Link>
        <nav className="flex flex-wrap gap-3 text-sm">
          <Link
            href="/app/settings/brand"
            className="text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
          >
            Brand
          </Link>
          <Link href="/app/settings/worker" className="text-[var(--color-accent)]">
            Render worker
          </Link>
          <Link
            href="/app/settings/api-keys"
            className="text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
          >
            API keys
          </Link>
          <Link
            href="/app/settings/account"
            className="text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
          >
            Account
          </Link>
        </nav>
      </header>

      <h1 className="mb-2 text-2xl font-bold sm:text-3xl">Render worker</h1>
      <p className="mb-6 max-w-2xl text-[var(--color-fg-muted)]">
        Install the worker binary on your Mac, Windows, or Linux machine. Renders run locally — 2–5×
        faster than cloud, no queue waits.
      </p>

      {status && <StatusBanner status={status} />}

      <section className="mb-8 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:p-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider">
          1 · Get a worker token
        </h2>
        <p className="mb-3 text-sm text-[var(--color-fg-muted)]">
          Create a token below. Copy it once — it won't be shown again.
        </p>
        <button
          onClick={create}
          disabled={creating}
          className="rounded-md bg-[var(--color-accent)] px-4 py-2 font-semibold text-black disabled:opacity-50"
        >
          {creating ? "Creating..." : "Create worker token"}
        </button>
        {showToken && (
          <div className="mt-4 rounded-md border border-[var(--color-accent)] bg-[var(--color-bg-2)] p-3">
            <div className="mb-2 text-xs text-[var(--color-fg-muted)]">
              Copy this — it won't be shown again:
            </div>
            <code className="block break-all font-mono text-sm text-[var(--color-accent)]">
              {showToken}
            </code>
            <button
              onClick={() => {
                navigator.clipboard.writeText(showToken);
                setShowToken(null);
              }}
              className="mt-3 rounded-md border border-[var(--color-border)] px-3 py-1 text-xs hover:bg-[var(--color-bg)]"
            >
              Copy and dismiss
            </button>
          </div>
        )}
      </section>

      <section className="mb-8 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:p-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider">
          2 · Install the worker
        </h2>
        <p className="mb-3 text-sm text-[var(--color-fg-muted)]">
          Binary downloads are in beta. For now:
        </p>
        <pre className="overflow-x-auto rounded-md bg-[var(--color-bg)] p-3 font-mono text-xs">{`# Quick start (any platform, requires node + the hyperframes CLI):
git clone https://github.com/vibeedit-video/worker.git
cd worker && npm install
VIBEEDIT_TOKEN=vewk_... VIBEEDIT_URL=https://vibeedit.video npm start`}</pre>
        <p className="mt-3 text-xs text-[var(--color-fg-muted)]">
          Pre-built signed binaries for Mac / Win / Linux ship in week 4. See{" "}
          <Link href="/help/install-render-worker" className="underline">
            the docs
          </Link>
          .
        </p>
      </section>

      <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:p-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider">Your worker tokens</h2>
        {tokens.length === 0 ? (
          <p className="text-sm text-[var(--color-fg-muted)]">No tokens yet.</p>
        ) : (
          <ul className="space-y-2">
            {tokens.map((t) => (
              <li
                key={t.token}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-[var(--color-border)] p-3"
              >
                <div className="min-w-0 flex-1 text-sm">
                  <div className="font-semibold">{t.name}</div>
                  <div className="break-all font-mono text-xs text-[var(--color-fg-muted)]">
                    {t.token}
                  </div>
                  <div className="mt-1 text-xs text-[var(--color-fg-muted)]">
                    {t.lastSeenAt
                      ? `Last seen ${new Date(t.lastSeenAt).toLocaleString()}`
                      : "Never connected"}
                  </div>
                </div>
                <button
                  onClick={() => revoke(t.token.split("…")[0])}
                  className="rounded-md border border-[var(--color-border)] px-3 py-1 text-xs text-[var(--color-danger)] hover:bg-[var(--color-danger)] hover:text-white"
                >
                  Revoke
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function StatusBanner({ status }: { status: Status }) {
  const { hasWorker, cloudSecondsUsed, cloudSecondsLimit, blocked } = status;
  const unlimited = cloudSecondsLimit < 0;
  const percent = unlimited
    ? 0
    : Math.min(100, Math.round((cloudSecondsUsed / cloudSecondsLimit) * 100));
  const tone = blocked
    ? "border-[var(--color-danger)] bg-[var(--color-bg-2)]"
    : hasWorker
      ? "border-[var(--color-success)] bg-[var(--color-bg-2)]"
      : "border-[var(--color-border)] bg-[var(--color-surface)]";
  return (
    <section className={`mb-8 rounded-xl border p-5 ${tone}`}>
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="mb-1 flex items-center gap-2 text-sm font-semibold">
            <span
              className={`inline-block h-2.5 w-2.5 rounded-full ${
                hasWorker ? "bg-[var(--color-success)]" : "bg-[var(--color-fg-muted)]"
              }`}
            />
            {hasWorker
              ? "Worker online — renders route to your machine"
              : "No worker online — renders use the cloud"}
          </div>
          {!hasWorker && !unlimited && (
            <div className="text-xs text-[var(--color-fg-muted)]">
              Cloud render time used: {cloudSecondsUsed}/{cloudSecondsLimit} seconds
            </div>
          )}
          {blocked && (
            <div className="mt-2 text-xs text-[var(--color-danger)]">
              Cap reached. Install the worker below to keep rendering, or upgrade your plan.
            </div>
          )}
        </div>
        {!hasWorker && !unlimited && (
          <div className="hidden flex-1 max-w-[180px] sm:block">
            <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--color-bg)]">
              <div
                className={`h-full ${
                  blocked ? "bg-[var(--color-danger)]" : "bg-[var(--color-accent)]"
                }`}
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
