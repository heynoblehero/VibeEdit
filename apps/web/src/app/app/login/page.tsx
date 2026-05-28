"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn, useSession } from "@/lib/auth-client";

export default function LoginPage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isPending && session) router.replace("/app/projects");
  }, [isPending, session, router]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const result = await signIn.email({ email, password });
    setBusy(false);
    if (result.error) {
      setError(result.error.message || "Sign in failed");
      return;
    }
    router.push("/app/projects");
  }

  if (isPending || session) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--color-border)] border-t-[var(--color-accent)]" />
      </main>
    );
  }

  return (
    <main className="flex min-h-screen">
      {/* Left panel */}
      <div className="hidden flex-col justify-between border-r border-[var(--color-border)] bg-[var(--color-surface)] p-10 lg:flex lg:w-[420px] xl:w-[480px]">
        <div>
          <div className="mb-2 text-xl font-black tracking-tight text-[var(--color-fg)]">
            VibeEdit
          </div>
          <div className="text-xs text-[var(--color-fg-muted)]">AI video editing agent</div>
        </div>
        <div className="space-y-6">
          <Testimonial
            quote="I shipped my first 10 videos in a week. The agent handles everything — I just describe what I want."
            author="Finance creator, 140K subs"
          />
          <div className="space-y-3">
            <Feature icon="✂" text="Trim footage to word boundaries, auto-grade, burn captions" />
            <Feature icon="✦" text="Build motion-graphic scenes from a single text description" />
            <Feature
              icon="🎙"
              text="ElevenLabs voiceover with word-highlight captions, no timeline"
            />
            <Feature icon="📦" text="Export MP4 — h.264, −14 LUFS, YouTube-ready" />
          </div>
        </div>
        <p className="text-xs text-[var(--color-fg-muted)]">© 2026 VibeEdit · Made for creators</p>
      </div>

      {/* Right panel — form */}
      <div className="flex flex-1 flex-col items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-sm">
          <div className="mb-8">
            <h1 className="text-2xl font-bold">Welcome back</h1>
            <p className="mt-1 text-sm text-[var(--color-fg-muted)]">
              Sign in to your VibeEdit account
            </p>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1">
              <label
                htmlFor="email"
                className="text-xs font-medium uppercase tracking-wider text-[var(--color-fg-muted)]"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-2)] px-4 py-3 text-sm outline-none transition-colors placeholder:text-[var(--color-fg-muted)]/50 focus:border-[var(--color-accent)]"
              />
            </div>

            <div className="space-y-1">
              <label
                htmlFor="password"
                className="text-xs font-medium uppercase tracking-wider text-[var(--color-fg-muted)]"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-2)] px-4 py-3 text-sm outline-none transition-colors placeholder:text-[var(--color-fg-muted)]/50 focus:border-[var(--color-accent)]"
              />
            </div>

            {error && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-lg bg-[var(--color-accent)] py-3 text-sm font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-[var(--color-fg-muted)]">
            No account?{" "}
            <Link
              href="/app/signup"
              className="font-medium text-[var(--color-accent)] hover:underline"
            >
              Create one free
            </Link>
          </p>

          <div className="mt-8 border-t border-[var(--color-border)] pt-6 text-center">
            <Link
              href="/"
              className="text-xs text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
            >
              ← Back to vibeedit.video
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}

function Feature({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 text-base" aria-hidden="true">
        {icon}
      </span>
      <span className="text-sm text-[var(--color-fg-muted)]">{text}</span>
    </div>
  );
}

function Testimonial({ quote, author }: { quote: string; author: string }) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-2)] p-4">
      <p className="text-sm leading-relaxed text-[var(--color-fg)]">"{quote}"</p>
      <p className="mt-2 text-xs text-[var(--color-fg-muted)]">— {author}</p>
    </div>
  );
}
