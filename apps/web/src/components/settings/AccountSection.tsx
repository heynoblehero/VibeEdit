"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "@/lib/auth-client";
import { useToast } from "@/components/Toast";

type BillingSummary = {
  plan: { id: string; name: string };
  credits?: { monthly: number; used: number; total: number };
};

/**
 * Account settings rendered inline in the Settings modal. Same data/logic as
 * the /app/settings/account page, minus the page chrome (wordmark header, nav,
 * auth redirect) so it fits inside the modal panel.
 */
export function AccountSection() {
  const router = useRouter();
  const toast = useToast();
  const { data: session, isPending } = useSession();
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState<"ok" | "error" | null>(null);
  const [billing, setBilling] = useState<BillingSummary | null>(null);

  useEffect(() => {
    if (!session) return;
    fetch("/api/billing/me")
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => data && setBilling(data as BillingSummary));
  }, [session]);

  async function resendVerification() {
    if (!session?.user.email) return;
    setResending(true);
    setResent(null);
    try {
      const response = await fetch("/api/auth/send-verification-email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: session.user.email,
          callbackURL: "/app/projects",
        }),
      });
      setResent(response.ok ? "ok" : "error");
      if (response.ok) toast.success("Verification email sent — check your inbox.");
      else toast.error("Couldn't send verification email. Try again in a minute.");
    } catch {
      setResent("error");
      toast.error("Couldn't send verification email. Try again in a minute.");
    } finally {
      setResending(false);
    }
  }

  async function exportData() {
    setExporting(true);
    setExportError(null);
    try {
      const response = await fetch("/api/account/export");
      if (!response.ok) {
        setExportError("Export failed — please try again.");
        toast.error("Export failed — please try again.");
        return;
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const date = new Date().toISOString().slice(0, 10);
      link.download = `vibeedit-export-${date}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast.success("Your data export has downloaded.");
    } catch {
      setExportError("Export failed — please try again.");
      toast.error("Export failed — please try again.");
    } finally {
      setExporting(false);
    }
  }

  async function deleteAccount() {
    if (!session?.user.email) return;
    const confirmation = window.prompt(
      "This will permanently delete your account, all projects, all renders, and all chat history. It also cancels any active subscription. Type your email to confirm:",
    );
    if (confirmation?.trim().toLowerCase() !== session.user.email.toLowerCase()) return;
    setDeleting(true);
    try {
      const response = await fetch("/api/account", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ confirmEmail: session.user.email }),
      });
      if (!response.ok) throw new Error(`Server error ${response.status}`);
      await signOut();
      router.push("/");
    } catch {
      toast.error("Couldn't delete your account. Please try again or contact support.");
      setDeleting(false);
    }
  }

  if (isPending || !session) {
    return <p className="text-sm text-[var(--color-fg-muted)]">Loading…</p>;
  }

  return (
    <div>
      {/* Plan & credits summary */}
      <section className="mb-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-2)] p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wider">Plan &amp; credits</h3>
          <Link
            href="/app/billing"
            className="rounded-md bg-[var(--color-accent)] px-3 py-1.5 text-xs font-semibold text-black hover:opacity-90"
          >
            {billing && billing.plan.id !== "free" ? "Manage plan" : "Upgrade"}
          </Link>
        </div>
        {billing ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <div className="text-xs text-[var(--color-fg-muted)]">Plan</div>
              <div className="mt-0.5 text-lg font-bold">{billing.plan.name}</div>
            </div>
            <div>
              <div className="text-xs text-[var(--color-fg-muted)]">Credits left</div>
              <div className="mt-0.5 text-lg font-bold">
                {billing.credits
                  ? billing.credits.total === -1
                    ? "∞"
                    : billing.credits.total.toLocaleString()
                  : "—"}
              </div>
            </div>
            <div>
              <div className="text-xs text-[var(--color-fg-muted)]">Used this month</div>
              <div className="mt-0.5 text-lg font-bold">
                {billing.credits
                  ? `${billing.credits.used.toLocaleString()} / ${
                      billing.credits.monthly === -1
                        ? "∞"
                        : billing.credits.monthly.toLocaleString()
                    }`
                  : "—"}
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-[var(--color-fg-muted)]">Loading…</p>
        )}
      </section>

      <StoragePanel />

      {!session.user.emailVerified && (
        <section className="mb-6 rounded-xl border border-[var(--color-accent)] bg-[var(--color-bg-2)] p-4">
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-[var(--color-accent)]">
            Email not verified
          </h3>
          <p className="mb-3 text-sm text-[var(--color-fg-muted)]">
            You can use the editor, but rendering is locked until you click the verification link.
            Check your inbox at{" "}
            <strong className="text-[var(--color-fg)]">{session.user.email}</strong>.
          </p>
          <button
            type="button"
            onClick={resendVerification}
            disabled={resending}
            className="rounded-md bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-black hover:opacity-90 disabled:opacity-50"
          >
            {resending ? "Sending…" : "Resend verification email"}
          </button>
          {resent === "ok" && (
            <span className="ml-3 text-xs text-[var(--color-success)]">
              ✓ Sent — check your inbox
            </span>
          )}
          {resent === "error" && (
            <span className="ml-3 text-xs text-[var(--color-danger)]">
              ✗ Couldn't send — try again in a minute
            </span>
          )}
        </section>
      )}

      <section className="mb-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-2)] p-4">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider">Profile</h3>
        <dl className="space-y-2 text-sm">
          <div className="flex flex-wrap justify-between gap-2">
            <dt className="text-[var(--color-fg-muted)]">Name</dt>
            <dd className="break-all">{session.user.name}</dd>
          </div>
          <div className="flex flex-wrap justify-between gap-2">
            <dt className="text-[var(--color-fg-muted)]">Email</dt>
            <dd className="flex items-center gap-2 break-all">
              {session.user.email}
              {session.user.emailVerified ? (
                <span className="rounded bg-[var(--color-success)]/15 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-[var(--color-success)]">
                  Verified
                </span>
              ) : (
                <span className="rounded bg-[var(--color-accent)]/15 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-[var(--color-accent)]">
                  Unverified
                </span>
              )}
            </dd>
          </div>
        </dl>
      </section>

      <section className="mb-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-2)] p-4">
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider">Your data</h3>
        <p className="mb-4 text-sm text-[var(--color-fg-muted)]">
          Download a copy of everything we hold for your account — profile, projects (including
          composition HTML), render history, support threads, brand kit, and a usage summary. The
          export is JSON and never contains your API keys or passwords.
        </p>
        <button
          type="button"
          onClick={exportData}
          disabled={exporting}
          className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-2 text-sm text-[var(--color-fg)] hover:border-[var(--color-accent)] disabled:opacity-50"
        >
          {exporting ? "Preparing export…" : "Export my data"}
        </button>
        {exportError && (
          <span className="ml-3 text-xs text-[var(--color-danger)]">✗ {exportError}</span>
        )}
      </section>

      <section className="rounded-xl border border-[var(--color-danger)] bg-[var(--color-bg-2)] p-4">
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-[var(--color-danger)]">
          Danger zone
        </h3>
        <p className="mb-4 text-sm text-[var(--color-fg-muted)]">
          Delete your account, all projects, all renders, all chat history. Any active subscription
          is cancelled. This cannot be undone — export your data first if you want a copy.
        </p>
        <button
          type="button"
          onClick={deleteAccount}
          disabled={deleting}
          className="rounded-md border border-[var(--color-danger)] px-4 py-2 text-sm text-[var(--color-danger)] hover:bg-[var(--color-danger)] hover:text-white disabled:opacity-50"
        >
          {deleting ? "Deleting..." : "Delete my account"}
        </button>
      </section>
    </div>
  );
}

type StorageData = {
  usedBytes: number;
  limitBytes: number;
  fraction: number;
  projects: Array<{ id: string; name: string; bytes: number }>;
};

function formatSize(bytes: number): string {
  if (bytes <= 0) return "0 MB";
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) return `${gb.toFixed(2)} GB`;
  return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
}

function StoragePanel() {
  const [data, setData] = useState<StorageData | null>(null);

  useEffect(() => {
    fetch("/api/storage")
      .then((response) => (response.ok ? response.json() : null))
      .then((value) => value && setData(value as StorageData))
      .catch(() => {});
  }, []);

  const unlimited = !data || data.limitBytes < 0;
  const pct = data && data.limitBytes > 0 ? Math.round(data.fraction * 100) : 0;
  const near = pct >= 80;

  return (
    <section className="mb-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-2)] p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wider">Storage</h3>
        <Link href="/app/projects" className="text-xs text-[var(--color-accent)] hover:underline">
          Manage projects →
        </Link>
      </div>

      {!data ? (
        <p className="text-sm text-[var(--color-fg-muted)]">Loading…</p>
      ) : (
        <>
          <div className="mb-1 flex items-baseline justify-between text-sm">
            <span className="font-medium">
              {formatSize(data.usedBytes)}{" "}
              <span className="text-[var(--color-fg-muted)]">
                of {unlimited ? "unlimited" : formatSize(data.limitBytes)}
              </span>
            </span>
            {!unlimited && (
              <span
                className={`text-xs ${near ? "text-[var(--color-danger)]" : "text-[var(--color-fg-muted)]"}`}
              >
                {pct}% used
              </span>
            )}
          </div>
          {!unlimited && (
            <div className="mb-4 h-2 overflow-hidden rounded-full bg-[var(--color-bg)]">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.min(100, pct)}%`,
                  backgroundColor: near ? "var(--color-danger)" : "var(--color-accent)",
                }}
              />
            </div>
          )}
          <p className="mb-3 text-xs text-[var(--color-fg-muted)]">
            Your uploaded footage, images and audio count toward this. Open a project and delete
            assets from the Files drawer to free space.
          </p>
          {data.projects.filter((project) => project.bytes > 0).length === 0 ? (
            <p className="text-sm text-[var(--color-fg-muted)]">No stored assets yet.</p>
          ) : (
            <ul className="divide-y divide-[var(--color-border)] text-sm">
              {data.projects
                .filter((project) => project.bytes > 0)
                .slice(0, 12)
                .map((project) => (
                  <li key={project.id} className="flex items-center justify-between py-2">
                    <Link
                      href={`/app/projects/${project.id}/edit`}
                      className="truncate pr-3 hover:text-[var(--color-accent)] hover:underline"
                    >
                      {project.name || "Untitled"}
                    </Link>
                    <span className="shrink-0 text-xs text-[var(--color-fg-muted)]">
                      {formatSize(project.bytes)}
                    </span>
                  </li>
                ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
