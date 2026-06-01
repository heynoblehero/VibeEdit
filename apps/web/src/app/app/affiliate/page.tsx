"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import { Wordmark } from "@/components/Wordmark";

type Stats = { clicks: number; link: string };

export default function AffiliatePage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [stats, setStats] = useState<Stats | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isPending && !session) router.replace("/app/login");
  }, [isPending, session, router]);

  useEffect(() => {
    if (!session) return;
    fetch("/api/affiliate/stats")
      .then((r) => r.json())
      .then(setStats);
  }, [session]);

  async function copy() {
    if (!stats) return;
    await navigator.clipboard.writeText(stats.link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (isPending || !session) return null;

  // Gate the page until payouts are wired. Operator flips the env to "1"
  // (or just "true") when Stripe Connect is ready and program goes live.
  const enabled =
    process.env.NEXT_PUBLIC_AFFILIATE_ENABLED === "1" ||
    process.env.NEXT_PUBLIC_AFFILIATE_ENABLED === "true";
  if (!enabled) {
    return (
      <main className="mx-auto max-w-2xl p-8">
        <header className="mb-6 flex items-center justify-between">
          <Link href="/app/projects">
            <Wordmark size="md" />
          </Link>
        </header>
        <h1 className="mb-3 text-2xl font-bold">Affiliate program — coming soon</h1>
        <p className="text-sm text-[var(--color-fg-muted)]">
          Payouts go live once Stripe Connect is integrated. Want to be notified the day it opens?{" "}
          <a
            href="mailto:affiliate@vibeedit.video"
            className="text-[var(--color-accent)] underline"
          >
            Email us
          </a>{" "}
          and we'll send your referral link the moment it's ready.
        </p>
      </main>
    );
  }

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
          <Link href="/app/affiliate" className="text-[var(--color-accent)]">
            Affiliate
          </Link>
        </nav>
      </header>

      <h1 className="mb-2 text-2xl font-bold sm:text-3xl">Refer + earn</h1>
      <p className="mb-8 max-w-2xl text-[var(--color-fg-muted)]">
        Share VibeEdit Video. Earn <strong>30% recurring</strong> on every paid signup that comes
        from your link, for as long as they're subscribed.
      </p>

      {stats && (
        <>
          <section className="mb-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:p-6">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider">Your link</h2>
            <div className="flex flex-wrap items-center gap-2">
              <code className="flex-1 break-all rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 font-mono text-sm">
                {stats.link}
              </code>
              <button
                onClick={copy}
                className="rounded-md bg-[var(--color-accent)] px-4 py-2 font-semibold text-black"
              >
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          </section>

          <section className="mb-8 grid grid-cols-2 gap-4">
            <Stat label="Clicks" value={stats.clicks.toLocaleString()} />
            <Stat
              label="Earnings (pending)"
              value="—"
              hint="Payouts go live with Stripe Connect — you'll see accrued earnings here once a referral pays."
            />
          </section>
        </>
      )}

      <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:p-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider">How it works</h2>
        <ol className="space-y-2 text-sm text-[var(--color-fg-muted)]">
          <li>1. Share your link in your YouTube descriptions, Twitter bio, Discord.</li>
          <li>2. When someone subscribes via your link, you earn 30% recurring.</li>
          <li>3. Payouts via Stripe Connect on the 1st of each month, min $20.</li>
        </ol>
      </section>
    </main>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:p-6">
      <div className="mb-1 text-xs uppercase tracking-wider text-[var(--color-fg-muted)]">
        {label}
      </div>
      <div className="text-2xl font-black sm:text-3xl">{value}</div>
      {hint && <div className="mt-1 text-xs text-[var(--color-fg-muted)]">{hint}</div>}
    </div>
  );
}
