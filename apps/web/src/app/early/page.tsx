"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Wordmark } from "@/components/Wordmark";

export default function WaitlistPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/waitlist")
      .then((r) => r.json())
      .then((j) => setCount(j.count));
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    const ref = typeof document !== "undefined" ? document.referrer || null : null;
    const result = await fetch("/api/waitlist", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, referrer: ref }),
    });
    setBusy(false);
    if (result.ok) setDone(true);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center p-4 text-center sm:p-8">
      <Wordmark size="lg" />
      <h1 className="mt-10 max-w-2xl text-3xl font-black leading-tight sm:mt-12 sm:text-5xl md:text-6xl">
        Get early access.
      </h1>
      <p className="mt-4 max-w-xl text-base text-[var(--color-fg-muted)] sm:text-lg">
        VibeEdit Video is Claude Code for video — prompt the AI, get an MP4. We're inviting our
        waitlist first when public launch goes live.
      </p>

      {!done ? (
        <form onSubmit={submit} className="mt-10 flex w-full max-w-md flex-col gap-3 sm:flex-row">
          <input
            required
            type="email"
            placeholder="you@email.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="flex-1 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-base outline-none focus:border-[var(--color-accent)]"
          />
          <button
            type="submit"
            disabled={busy}
            className="rounded-md bg-[var(--color-accent)] px-6 py-3 font-semibold text-black hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "Adding..." : "Get notified"}
          </button>
        </form>
      ) : (
        <div className="mt-10 rounded-xl border border-[var(--color-success)] bg-[var(--color-success)]/10 px-6 py-4">
          You're on the list. We'll email you when we open the doors.
        </div>
      )}

      {count !== null && count > 0 && (
        <p className="mt-6 text-xs text-[var(--color-fg-muted)]">
          {count.toLocaleString()} creators on the waitlist so far.
        </p>
      )}

      <div className="mt-16 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Bullet>Prompt → MP4 in minutes</Bullet>
        <Bullet>16:9 and 9:16 supported</Bullet>
        <Bullet>Renders on your machine</Bullet>
      </div>

      <Link
        href="/"
        className="mt-16 text-sm text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
      >
        ← Back home
      </Link>
    </main>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-sm text-[var(--color-fg-muted)]">
      {children}
    </div>
  );
}
