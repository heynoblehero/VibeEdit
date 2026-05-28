"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signUp, useSession } from "@/lib/auth-client";

const PLAN_LABELS: Record<string, string> = {
  creator: "Creator · $19/mo",
  studio: "Studio · $49/mo",
};

function SignupForm() {
  const params = useSearchParams();
  const plan = params.get("plan");
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isPending && session) router.replace("/app/projects");
  }, [isPending, session, router]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const result = await signUp.email({ email, password, name });
    setBusy(false);
    if (result.error) {
      setError(result.error.message || "Sign up failed");
      return;
    }
    setSubmitted(true);
  }

  if (isPending || session) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--color-border)] border-t-[var(--color-accent)]" />
      </main>
    );
  }

  if (submitted) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-5 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] text-3xl">
            📬
          </div>
          <div>
            <h1 className="text-2xl font-bold">Check your inbox</h1>
            <p className="mt-2 text-sm text-[var(--color-fg-muted)]">
              We sent a verification link to{" "}
              <span className="font-medium text-[var(--color-fg)]">{email}</span>. Click it to
              activate your account.
            </p>
          </div>
          {plan && (
            <div className="rounded-lg border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/5 px-4 py-3 text-sm text-[var(--color-accent)]">
              After verifying, sign in and go to Billing to start your {PLAN_LABELS[plan] ?? plan}{" "}
              plan.
            </div>
          )}
          <p className="text-xs text-[var(--color-fg-muted)]">
            Not in inbox? Check spam — can take up to a minute.
          </p>
          <Link
            href="/app/login"
            className="block text-sm font-medium text-[var(--color-accent)] hover:underline"
          >
            Back to sign in →
          </Link>
        </div>
      </main>
    );
  }

  const planLabel = plan ? PLAN_LABELS[plan] : null;

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

        <div className="space-y-5">
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-[var(--color-accent)]">
              What you get
            </div>
            <PlanCompare />
          </div>
        </div>

        <p className="text-xs text-[var(--color-fg-muted)]">
          © 2026 VibeEdit · No credit card on free plan
        </p>
      </div>

      {/* Right panel */}
      <div className="flex flex-1 flex-col items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-sm">
          <div className="mb-8">
            <h1 className="text-2xl font-bold">
              {planLabel ? `Start ${planLabel}` : "Create your account"}
            </h1>
            <p className="mt-1 text-sm text-[var(--color-fg-muted)]">
              {planLabel
                ? "You'll be redirected to checkout after signup."
                : "Free plan — no credit card required."}
            </p>
          </div>

          {planLabel && (
            <div className="mb-5 flex items-center gap-3 rounded-lg border border-[var(--color-accent)]/40 bg-[var(--color-accent)]/8 px-4 py-3">
              <span className="text-lg">✦</span>
              <div className="text-sm">
                <div className="font-semibold text-[var(--color-accent)]">{planLabel}</div>
                <div className="text-xs text-[var(--color-fg-muted)]">
                  $1 trial · cancel anytime
                </div>
              </div>
            </div>
          )}

          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1">
              <label
                htmlFor="name"
                className="text-xs font-medium uppercase tracking-wider text-[var(--color-fg-muted)]"
              >
                Name
              </label>
              <input
                id="name"
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Your name"
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-2)] px-4 py-3 text-sm outline-none transition-colors placeholder:text-[var(--color-fg-muted)]/50 focus:border-[var(--color-accent)]"
              />
            </div>

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
                required
                minLength={6}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="6+ characters"
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
              {busy ? "Creating account…" : "Create account"}
            </button>
          </form>

          <p className="mt-5 text-center text-xs text-[var(--color-fg-muted)]">
            By signing up you agree to our{" "}
            <Link href="/legal/terms" className="underline hover:text-[var(--color-fg)]">
              Terms
            </Link>{" "}
            and{" "}
            <Link href="/legal/privacy" className="underline hover:text-[var(--color-fg)]">
              Privacy Policy
            </Link>
            .
          </p>

          <p className="mt-4 text-center text-sm text-[var(--color-fg-muted)]">
            Have an account?{" "}
            <Link
              href="/app/login"
              className="font-medium text-[var(--color-accent)] hover:underline"
            >
              Sign in
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

function PlanCompare() {
  const rows = [
    { feature: "Renders / month", free: "5 (watermarked)", creator: "100", studio: "Unlimited" },
    { feature: "Resolution", free: "720p", creator: "1080p", studio: "4K" },
    {
      feature: "Agent messages",
      free: "50 / mo",
      creator: "1,000 / mo",
      studio: "Unlimited",
    },
    { feature: "Brand kit", free: "—", creator: "—", studio: "✓" },
  ];

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--color-border)]">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-2)]">
            <th className="px-3 py-2 text-left font-medium text-[var(--color-fg-muted)]" />
            <th className="px-3 py-2 text-center font-medium text-[var(--color-fg-muted)]">Free</th>
            <th className="px-3 py-2 text-center font-semibold text-[var(--color-accent)]">
              Creator
            </th>
            <th className="px-3 py-2 text-center font-medium text-[var(--color-fg-muted)]">
              Studio
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.feature} className="border-b border-[var(--color-border)] last:border-0">
              <td className="px-3 py-2 text-[var(--color-fg-muted)]">{row.feature}</td>
              <td className="px-3 py-2 text-center text-[var(--color-fg-muted)]">{row.free}</td>
              <td className="bg-[var(--color-accent)]/5 px-3 py-2 text-center font-medium text-[var(--color-fg)]">
                {row.creator}
              </td>
              <td className="px-3 py-2 text-center text-[var(--color-fg-muted)]">{row.studio}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--color-border)] border-t-[var(--color-accent)]" />
        </main>
      }
    >
      <SignupForm />
    </Suspense>
  );
}
