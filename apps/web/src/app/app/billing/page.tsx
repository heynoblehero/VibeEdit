"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "@/lib/auth-client";

export default function BillingPageWrapper() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--color-border)] border-t-[var(--color-accent)]" />
        </main>
      }
    >
      <BillingPage />
    </Suspense>
  );
}

type Plan = {
  id: string;
  name: string;
  priceLabel: string;
  renderLimit: number;
  chatTurnLimit: number;
  resolution: string;
  watermark: boolean;
};

type Info = {
  plan: Plan;
  subscription: {
    plan: string;
    status: string;
    stripeCustomerId: string | null;
    polarCustomerId: string | null;
    currentPeriodEnd: string | null;
    trialEndsAt: string | null;
    cancelAtPeriodEnd: boolean;
  };
  usage: {
    renders: { used: number; limit: number };
    chatTurns: { used: number; limit: number };
  };
  availablePlans: Plan[];
};

const PLAN_FEATURES: Record<string, string[]> = {
  free: [
    "5 watermarked renders / month",
    "50 AI messages / month",
    "720p cloud render",
    "All niche style packs",
    "Footage editing tools",
  ],
  creator: [
    "100 renders / month",
    "1,000 AI messages / month",
    "1080p · no watermark",
    "Auto-grade + loudnorm",
    "Local render worker",
    "Email support",
  ],
  studio: [
    "Unlimited renders",
    "Unlimited AI messages",
    "4K · priority queue",
    "Brand kit (logo, colors, host)",
    "−14 LUFS loudness normalization",
    "Priority support",
  ],
};

const PLAN_PRICES: Record<string, string> = {
  free: "$0",
  creator: "$19",
  studio: "$49",
};

function BillingPage() {
  const router = useRouter();
  const params = useSearchParams();
  const { data: session, isPending } = useSession();
  const [info, setInfo] = useState<Info | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!isPending && !session) router.replace("/app/login");
  }, [isPending, session, router]);

  async function refresh() {
    const r = await fetch("/api/billing/me");
    if (!r.ok) return;
    setInfo(await r.json());
  }

  useEffect(() => {
    if (session) refresh();
  }, [session]);

  async function startCheckout(planId: string) {
    setBusy(planId);
    const result = await fetch("/api/billing/checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ plan: planId }),
    });
    setBusy(null);
    if (!result.ok) {
      alert(`Checkout failed: ${await result.text()}`);
      return;
    }
    const data = (await result.json()) as { url: string; devMode?: boolean };
    if (data.devMode) {
      alert("Polar is not configured — plan switched in dev mode for testing.");
      refresh();
      return;
    }
    window.location.href = data.url;
  }

  async function openPortal() {
    setBusy("portal");
    const result = await fetch("/api/billing/portal", { method: "POST" });
    setBusy(null);
    if (!result.ok) {
      alert("No billing account yet — subscribe first to access the portal.");
      return;
    }
    const data = (await result.json()) as { url: string };
    window.location.href = data.url;
  }

  if (isPending || !session || !info) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--color-border)] border-t-[var(--color-accent)]" />
      </main>
    );
  }

  const status = params.get("status");
  const onFree = info.plan.id === "free";

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-[var(--color-border)] bg-[var(--color-bg)]/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
          <Link
            href="/app/projects"
            className="text-base font-black tracking-tight text-[var(--color-fg)]"
          >
            VibeEdit
          </Link>
          <nav className="hidden items-center gap-1 text-sm sm:flex">
            <Link
              href="/app/projects"
              className="rounded-md px-3 py-1.5 text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
            >
              Projects
            </Link>
            <Link
              href="/app/renders"
              className="rounded-md px-3 py-1.5 text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
            >
              Renders
            </Link>
            <Link
              href="/app/billing"
              className="rounded-md px-3 py-1.5 font-medium text-[var(--color-accent)]"
            >
              Billing
            </Link>
          </nav>
          <Link
            href="/app/projects"
            className="text-sm text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
          >
            ← Back
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
        {/* Status banners */}
        {status === "success" && (
          <div className="mb-6 flex items-center gap-3 rounded-xl border border-[var(--color-success)]/40 bg-[var(--color-success)]/8 px-4 py-3 text-sm text-[var(--color-success)]">
            <span className="text-base">✓</span>
            Subscription activated — welcome aboard.
          </div>
        )}
        {status === "cancelled" && (
          <div className="mb-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm text-[var(--color-fg-muted)]">
            Checkout cancelled. No charge was made.
          </div>
        )}

        {/* Current plan card */}
        <section className="mb-8">
          <h1 className="mb-4 text-xl font-bold">Billing</h1>

          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-[var(--color-fg-muted)]">
                  Current plan
                </div>
                <div className="mt-1 flex flex-wrap items-baseline gap-2">
                  <span className="text-3xl font-black">{info.plan.name}</span>
                  <span className="text-lg text-[var(--color-fg-muted)]">
                    {PLAN_PRICES[info.plan.id] ?? info.plan.priceLabel}
                    <span className="text-sm">/mo</span>
                  </span>
                  {info.subscription.status === "trialing" && (
                    <span className="rounded-full bg-[var(--color-accent)] px-2 py-0.5 text-xs font-semibold text-black">
                      Trial
                    </span>
                  )}
                  {info.subscription.cancelAtPeriodEnd && (
                    <span className="rounded-full border border-[var(--color-accent-2)]/40 bg-[var(--color-accent-2)]/10 px-2 py-0.5 text-xs text-[var(--color-accent-2)]">
                      Cancels
                    </span>
                  )}
                </div>
                {info.subscription.currentPeriodEnd && (
                  <div className="mt-1 text-xs text-[var(--color-fg-muted)]">
                    {info.subscription.cancelAtPeriodEnd ? "Ends" : "Renews"}{" "}
                    {new Date(info.subscription.currentPeriodEnd).toLocaleDateString()}
                  </div>
                )}
              </div>

              {(info.subscription.polarCustomerId || info.subscription.stripeCustomerId) && (
                <button
                  onClick={openPortal}
                  disabled={busy === "portal"}
                  className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm hover:bg-[var(--color-bg)] disabled:opacity-50"
                >
                  {busy === "portal" ? "Opening…" : "Manage subscription ↗"}
                </button>
              )}
            </div>

            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <UsageBar
                label="Renders this month"
                used={info.usage.renders.used}
                limit={info.usage.renders.limit}
              />
              <UsageBar
                label="Agent messages this month"
                used={info.usage.chatTurns.used}
                limit={info.usage.chatTurns.limit}
              />
            </div>

            {onFree && (
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/5 p-4">
                <div>
                  <div className="text-sm font-medium text-[var(--color-fg)]">
                    Remove watermark + unlock 1080p
                  </div>
                  <div className="mt-0.5 text-xs text-[var(--color-fg-muted)]">
                    Creator plan — $1 trial, then $19/mo. Cancel any time.
                  </div>
                </div>
                <button
                  onClick={() => startCheckout("creator")}
                  disabled={busy === "creator"}
                  className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-black hover:opacity-90 disabled:opacity-50"
                >
                  {busy === "creator" ? "Redirecting…" : "Upgrade · $19/mo"}
                </button>
              </div>
            )}
          </div>
        </section>

        {/* Plan grid */}
        <section>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-[var(--color-fg-muted)]">
            All plans
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {info.availablePlans.map((plan) => {
              const isCurrent = plan.id === info.plan.id;
              const features = PLAN_FEATURES[plan.id] ?? [];
              return (
                <div
                  key={plan.id}
                  className={`relative flex flex-col rounded-2xl border p-5 transition-colors ${
                    isCurrent
                      ? "border-[var(--color-accent)] bg-[var(--color-accent)]/4"
                      : "border-[var(--color-border)] bg-[var(--color-surface)]"
                  }`}
                >
                  {isCurrent && (
                    <div className="absolute -top-px left-4 rounded-b-md bg-[var(--color-accent)] px-2 py-0.5 text-xs font-semibold text-black">
                      Current
                    </div>
                  )}
                  {plan.id === "creator" && !isCurrent && (
                    <div className="absolute -top-px left-4 rounded-b-md bg-[var(--color-fg-muted)] px-2 py-0.5 text-xs font-semibold text-black">
                      Popular
                    </div>
                  )}

                  <div className="mb-1 text-base font-bold">{plan.name}</div>
                  <div className="mb-5 flex items-baseline gap-1">
                    <span className="text-3xl font-black">
                      {PLAN_PRICES[plan.id] ?? plan.priceLabel}
                    </span>
                    <span className="text-sm text-[var(--color-fg-muted)]">/mo</span>
                  </div>

                  <ul className="mb-6 flex-1 space-y-2">
                    {features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2 text-sm">
                        <span className="mt-0.5 text-[var(--color-accent)]">→</span>
                        <span className="text-[var(--color-fg-muted)]">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  {isCurrent ? (
                    <div className="rounded-lg border border-[var(--color-border)] py-2 text-center text-sm text-[var(--color-fg-muted)]">
                      Your plan
                    </div>
                  ) : plan.id === "free" ? (
                    <button
                      disabled
                      className="cursor-not-allowed rounded-lg border border-[var(--color-border)] py-2 text-sm text-[var(--color-fg-muted)]"
                    >
                      Downgrade via portal
                    </button>
                  ) : (
                    <button
                      onClick={() => startCheckout(plan.id)}
                      disabled={busy === plan.id}
                      className="rounded-lg bg-[var(--color-accent)] py-2.5 text-sm font-semibold text-black hover:opacity-90 disabled:opacity-50"
                    >
                      {busy === plan.id
                        ? "Redirecting…"
                        : onFree
                          ? `Start $1 trial → ${plan.name}`
                          : `Switch to ${plan.name}`}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}

function UsageBar({ label, used, limit }: { label: string; used: number; limit: number }) {
  const pct = limit === -1 ? 0 : Math.min(100, (used / limit) * 100);
  const warn = pct >= 80 && limit !== -1;
  const crit = pct >= 95 && limit !== -1;
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-xs">
        <span className="text-[var(--color-fg-muted)]">{label}</span>
        <span
          className={
            crit
              ? "font-semibold text-[var(--color-accent-2)]"
              : warn
                ? "font-medium text-[var(--color-accent)]"
                : "text-[var(--color-fg-muted)]"
          }
        >
          {used} / {limit === -1 ? "∞" : limit}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--color-bg)]">
        <div
          className={`h-full rounded-full transition-all ${
            crit
              ? "bg-[var(--color-accent-2)]"
              : warn
                ? "bg-[var(--color-accent)]"
                : "bg-[var(--color-accent)]"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
