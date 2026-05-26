"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { signUp } from "@/lib/auth-client";

function SignupForm() {
  const params = useSearchParams();
  const plan = params.get("plan");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const result = await signUp.email({ email, password, name });
    setBusy(false);
    if (result.error) {
      setError(result.error.message || "sign up failed");
      return;
    }
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <main className="flex min-h-screen items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-sm space-y-3 rounded-xl border border-neutral-800 p-6 text-center sm:p-8">
          <div className="text-4xl">📬</div>
          <h1 className="text-2xl font-bold">Check your inbox</h1>
          <p className="text-sm text-neutral-400">
            We sent a verification link to <strong className="text-white">{email}</strong>. Click it
            to confirm your email and unlock rendering. The link expires in 24 hours.
          </p>
          {plan && (
            <p className="text-xs text-[var(--color-accent)]">
              After verifying, sign in and go to Billing to start your {plan} plan.
            </p>
          )}
          <p className="text-xs text-neutral-500">
            Not in inbox? Check spam — verification can take up to a minute.
          </p>
          <Link
            href="/app/login"
            className="block pt-2 text-sm text-[var(--color-accent)] underline"
          >
            Back to sign in
          </Link>
        </div>
      </main>
    );
  }

  const planLabel =
    plan === "creator" ? "Creator · $19/mo" : plan === "studio" ? "Studio · $49/mo" : null;

  return (
    <main className="flex min-h-screen items-center justify-center p-4 sm:p-6">
      <form
        onSubmit={submit}
        className="w-full max-w-sm space-y-4 rounded-xl border border-neutral-800 p-6 sm:p-8"
      >
        <h1 className="text-2xl font-bold">Create account</h1>
        {planLabel && (
          <div className="rounded-md border border-[var(--color-accent)] bg-[var(--color-accent)]/10 px-3 py-2 text-sm text-[var(--color-accent)]">
            Starting {planLabel} — you'll be redirected to checkout after signup.
          </div>
        )}
        <input
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Name"
          className="w-full rounded-md border border-neutral-700 bg-transparent px-3 py-2 text-base"
        />
        <input
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="Email"
          className="w-full rounded-md border border-neutral-700 bg-transparent px-3 py-2 text-base"
        />
        <input
          type="password"
          required
          minLength={6}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Password (6+ chars)"
          className="w-full rounded-md border border-neutral-700 bg-transparent px-3 py-2 text-base"
        />
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-md bg-[var(--color-accent)] py-2 font-semibold text-black disabled:opacity-50"
        >
          {busy ? "Creating..." : "Create account"}
        </button>
        <p className="text-sm text-neutral-400">
          Have an account?{" "}
          <Link href="/app/login" className="underline">
            Sign in
          </Link>
        </p>
      </form>
    </main>
  );
}

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center text-[var(--color-fg-muted)]">
          Loading…
        </main>
      }
    >
      <SignupForm />
    </Suspense>
  );
}
