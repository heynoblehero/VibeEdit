"use client";

import { useState } from "react";

export function WaitlistForm({ placement = "hero" }: { placement?: "hero" | "footer" }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "ok" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (state === "busy") return;
    if (!email.trim()) return;
    setState("busy");
    setError(null);
    try {
      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          referrer: typeof window !== "undefined" ? document.referrer : undefined,
        }),
      });
      if (response.ok) {
        setState("ok");
      } else {
        const text = await response.text().catch(() => "");
        setError(text || "Couldn't sign up — try again?");
        setState("error");
      }
    } catch (caught) {
      setError((caught as Error).message);
      setState("error");
    }
  }

  if (state === "ok") {
    return (
      <div
        className={
          placement === "hero"
            ? "mx-auto mt-6 max-w-md rounded-md border border-[var(--color-success)] bg-[var(--color-surface)] px-4 py-3 text-sm text-[var(--color-fg)]"
            : "rounded-md border border-[var(--color-success)] bg-[var(--color-surface)] px-4 py-3 text-sm text-[var(--color-fg)]"
        }
        role="status"
      >
        You're on the list. We'll email you on launch day.
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      className={
        placement === "hero"
          ? "mx-auto mt-6 flex max-w-md flex-col gap-2 sm:flex-row"
          : "flex w-full max-w-md flex-col gap-2 sm:flex-row"
      }
    >
      <input
        type="email"
        required
        autoComplete="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="your@email.com"
        className="flex-1 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
      />
      <button
        type="submit"
        disabled={state === "busy" || !email.trim()}
        className="rounded-md bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-black disabled:opacity-50"
      >
        {state === "busy" ? "…" : "Join waitlist"}
      </button>
      {state === "error" && error && (
        <p className="basis-full text-xs text-[var(--color-danger)]">{error}</p>
      )}
    </form>
  );
}
