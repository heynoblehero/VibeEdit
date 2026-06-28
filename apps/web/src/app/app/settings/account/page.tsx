"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "@/lib/auth-client";
import { Wordmark } from "@/components/Wordmark";

export default function AccountPage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState<"ok" | "error" | null>(null);

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
    } catch {
      setResent("error");
    } finally {
      setResending(false);
    }
  }

  useEffect(() => {
    if (!isPending && !session) router.replace("/app/login");
  }, [isPending, session, router]);

  async function exportData() {
    setExporting(true);
    setExportError(null);
    try {
      const response = await fetch("/api/account/export");
      if (!response.ok) {
        setExportError("Export failed — please try again.");
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
    } catch {
      setExportError("Export failed — please try again.");
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
    await fetch("/api/account", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ confirmEmail: session.user.email }),
    });
    await signOut();
    setDeleting(false);
    router.push("/");
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
            href="/app/projects"
            className="text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
          >
            Projects
          </Link>
          <Link
            href="/app/settings/brand"
            className="text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
          >
            Brand kit
          </Link>
          <Link href="/app/settings/account" className="text-[var(--color-accent)]">
            Account
          </Link>
        </nav>
      </header>

      <h1 className="mb-6 text-2xl font-bold sm:text-3xl">Account</h1>

      {!session.user.emailVerified && (
        <section className="mb-6 rounded-xl border border-[var(--color-accent)] bg-[var(--color-bg-2)] p-4 sm:p-6">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-[var(--color-accent)]">
            Email not verified
          </h2>
          <p className="mb-3 text-sm text-[var(--color-fg-muted)]">
            You can use the editor, but rendering is locked until you click the verification link.
            Check your inbox at{" "}
            <strong className="text-[var(--color-fg)]">{session.user.email}</strong>.
          </p>
          <button
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

      <section className="mb-8 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:p-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider">Profile</h2>
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

      <section className="mb-8 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:p-6">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider">Your data</h2>
        <p className="mb-4 text-sm text-[var(--color-fg-muted)]">
          Download a copy of everything we hold for your account — profile, projects (including
          composition HTML), render history, support threads, brand kit, and a usage summary. The
          export is JSON and never contains your API keys or passwords.
        </p>
        <button
          onClick={exportData}
          disabled={exporting}
          className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-2)] px-4 py-2 text-sm text-[var(--color-fg)] hover:border-[var(--color-accent)] disabled:opacity-50"
        >
          {exporting ? "Preparing export…" : "Export my data"}
        </button>
        {exportError && (
          <span className="ml-3 text-xs text-[var(--color-danger)]">✗ {exportError}</span>
        )}
      </section>

      <section className="rounded-xl border border-[var(--color-danger)] bg-[var(--color-surface)] p-4 sm:p-6">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-[var(--color-danger)]">
          Danger zone
        </h2>
        <p className="mb-4 text-sm text-[var(--color-fg-muted)]">
          Delete your account, all projects, all renders, all chat history. Any active subscription
          is cancelled. This cannot be undone — export your data first if you want a copy.
        </p>
        <button
          onClick={deleteAccount}
          disabled={deleting}
          className="rounded-md border border-[var(--color-danger)] px-4 py-2 text-sm text-[var(--color-danger)] hover:bg-[var(--color-danger)] hover:text-white disabled:opacity-50"
        >
          {deleting ? "Deleting..." : "Delete my account"}
        </button>
      </section>
    </main>
  );
}
