import Link from "next/link";
import type { Metadata } from "next";
import { Wordmark } from "@/components/Wordmark";

const OG_IMAGE =
  "/og?title=" +
  encodeURIComponent("Start for free.") +
  "&subtitle=" +
  encodeURIComponent("Full AI video agent on every tier. $1 trial on paid plans.") +
  "&badge=" +
  encodeURIComponent("Pricing");

export const metadata: Metadata = {
  title: "Pricing — VibeEdit",
  description:
    "Free plan to start. $1 trial on paid plans. Full AI video editing agent on every tier.",
  alternates: { canonical: "/pricing" },
  openGraph: {
    title: "VibeEdit Pricing — Start for free",
    description:
      "Free plan to start. $1 trial on paid plans. Full AI video editing agent on every tier.",
    type: "website",
    url: "/pricing",
    siteName: "VibeEdit",
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: "VibeEdit pricing" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "VibeEdit Pricing — Start for free",
    description: "Free plan to start. $1 trial on paid plans.",
    images: [OG_IMAGE],
  },
};

const PLANS = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    sub: "Forever free",
    features: [
      "5 watermarked renders / month",
      "50 AI messages / month",
      "Cloud render, 720p",
      "All 8 niche style packs",
      "Footage editing (trim, grade, captions)",
      "Unlimited projects",
    ],
    cta: { label: "Sign up free", href: "/app/signup" },
    highlight: false,
  },
  {
    id: "creator",
    name: "Creator",
    price: "$19",
    sub: "per month · most popular",
    features: [
      "100 renders / month",
      "1,000 AI messages / month",
      "1080p · no watermark",
      "Auto color grade + loudness normalization",
      "Local render worker (faster renders)",
      "Email support",
    ],
    cta: { label: "Start $1 trial", href: "/app/signup?plan=creator" },
    highlight: true,
  },
  {
    id: "studio",
    name: "Studio",
    price: "$49",
    sub: "per month",
    features: [
      "Unlimited renders",
      "Unlimited AI messages",
      "4K · priority queue",
      "Brand kits (logo, colors, host)",
      "−14 LUFS loudness normalization",
      "Priority support",
    ],
    cta: { label: "Start $1 trial", href: "/app/signup?plan=studio" },
    highlight: false,
  },
];

const COMPARE_ROWS: Array<{
  feature: string;
  free: string;
  creator: string;
  studio: string;
}> = [
  { feature: "Renders / month", free: "5 (watermarked)", creator: "100", studio: "Unlimited" },
  { feature: "AI messages / month", free: "50", creator: "1,000", studio: "Unlimited" },
  { feature: "Max resolution", free: "720p", creator: "1080p", studio: "4K" },
  { feature: "Watermark", free: "Yes", creator: "No", studio: "No" },
  { feature: "Local render worker", free: "—", creator: "✓", studio: "✓" },
  { feature: "Brand kit", free: "—", creator: "—", studio: "✓" },
  { feature: "Loudness normalization", free: "—", creator: "✓", studio: "✓" },
  { feature: "Support", free: "Community", creator: "Email", studio: "Priority email" },
];

const FAQS = [
  {
    q: "Is there a free trial on paid plans?",
    a: "Yes — $1 for the first billing period on Creator and Studio. Cancel any time before renewal and you won't be charged again.",
  },
  {
    q: "What counts as a render?",
    a: "One Render MP4 job = one render. Preview renders in-browser don't count. Cancelled jobs don't count.",
  },
  {
    q: "What counts as an AI message?",
    a: "Each time you send a message to the agent and it responds counts as one turn. Longer conversations (with tool calls) still count as one message turn.",
  },
  {
    q: "Can I cancel any time?",
    a: "Yes. Cancel from the billing portal inside the app — your plan stays active until the end of the billing period.",
  },
  {
    q: "Do unused renders carry over?",
    a: "No — limits reset on the 1st of each month.",
  },
  {
    q: "Is there a team or agency plan?",
    a: "Not yet. Email support@vibeedit.video and we'll figure something out.",
  },
];

export default function PricingPage() {
  return (
    <div className="min-h-screen">
      {/* Nav */}
      <header className="border-b border-[var(--color-border)]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <Wordmark size="md" />
          <div className="flex items-center gap-4 text-sm">
            <Link href="/" className="text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]">
              ← Home
            </Link>
            <Link
              href="/app/signup"
              className="rounded-md bg-[var(--color-accent)] px-4 py-1.5 font-semibold text-black hover:opacity-90"
            >
              Sign up free
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="border-b border-[var(--color-border)] bg-[var(--color-surface)]/40 px-4 py-16 text-center sm:px-6 sm:py-24">
        <div className="mb-3 text-xs uppercase tracking-wider text-[var(--color-accent)]">
          Pricing
        </div>
        <h1 className="text-4xl font-black tracking-tight sm:text-5xl md:text-6xl">
          Start for free.
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-lg text-[var(--color-fg-muted)]">
          Every plan includes the full AI video agent — edit footage or build from scratch. No
          feature gates, no upsells mid-edit.
        </p>
        <p className="mt-3 text-sm text-[var(--color-fg-muted)]">
          $1 trial on paid plans · no credit card on Free · cancel any time
        </p>
      </section>

      {/* Plan cards */}
      <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className={`rounded-2xl border p-6 sm:p-7 ${
                plan.highlight
                  ? "border-[var(--color-accent)] shadow-lg shadow-[var(--color-accent)]/10"
                  : "border-[var(--color-border)] bg-[var(--color-surface)]"
              }`}
            >
              <div className="mb-3 flex items-baseline justify-between">
                <h2 className="text-lg font-bold sm:text-xl">{plan.name}</h2>
                {plan.highlight && (
                  <span className="rounded-full bg-[var(--color-accent)] px-2 py-0.5 text-xs font-semibold text-black">
                    Popular
                  </span>
                )}
              </div>
              <div className="mb-1 text-4xl font-black">{plan.price}</div>
              <div className="mb-6 text-sm text-[var(--color-fg-muted)]">{plan.sub}</div>
              <ul className="mb-6 space-y-2 text-sm">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <span className="mt-0.5 text-[var(--color-accent)]">→</span>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <Link
                href={plan.cta.href}
                className={`block rounded-md py-2.5 text-center font-semibold transition-opacity ${
                  plan.highlight
                    ? "bg-[var(--color-accent)] text-black hover:opacity-90"
                    : "border border-[var(--color-border)] hover:bg-[var(--color-bg)]"
                }`}
              >
                {plan.cta.label}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* Comparison table */}
      <section className="border-t border-[var(--color-border)] bg-[var(--color-surface)]/30 px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-8 text-center text-2xl font-bold sm:text-3xl">Compare plans</h2>
          <div className="overflow-x-auto rounded-2xl border border-[var(--color-border)]">
            <table className="w-full min-w-[34rem] text-sm">
              <caption className="sr-only">
                Feature comparison across Free, Creator, and Studio plans
              </caption>
              <thead>
                <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-2)]">
                  <th
                    scope="col"
                    className="px-4 py-3 text-left font-medium text-[var(--color-fg-muted)]"
                  >
                    <span className="sr-only">Feature</span>
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-center font-medium text-[var(--color-fg-muted)]"
                  >
                    Free
                  </th>
                  <th
                    scope="col"
                    className="bg-[var(--color-accent)]/5 px-4 py-3 text-center font-semibold text-[var(--color-accent)]"
                  >
                    Creator
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-center font-medium text-[var(--color-fg-muted)]"
                  >
                    Studio
                  </th>
                </tr>
              </thead>
              <tbody>
                {COMPARE_ROWS.map((row) => (
                  <tr
                    key={row.feature}
                    className="border-b border-[var(--color-border)] last:border-0"
                  >
                    <th
                      scope="row"
                      className="px-4 py-3 text-left font-normal text-[var(--color-fg-muted)]"
                    >
                      {row.feature}
                    </th>
                    <td className="px-4 py-3 text-center text-[var(--color-fg-muted)]">
                      {row.free}
                    </td>
                    <td className="bg-[var(--color-accent)]/5 px-4 py-3 text-center font-medium text-[var(--color-fg)]">
                      {row.creator}
                    </td>
                    <td className="px-4 py-3 text-center text-[var(--color-fg-muted)]">
                      {row.studio}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
        <h2 className="mb-8 text-center text-2xl font-bold sm:text-3xl">Billing FAQ</h2>
        <div className="space-y-3">
          {FAQS.map((faq) => (
            <details
              key={faq.q}
              className="group rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-4"
            >
              <summary className="cursor-pointer list-none text-base font-semibold">
                <span className="float-right text-[var(--color-fg-muted)] transition-transform group-open:rotate-45">
                  +
                </span>
                {faq.q}
              </summary>
              <p className="mt-3 text-[var(--color-fg-muted)]">{faq.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-[var(--color-border)] px-4 py-16 text-center sm:px-6 sm:py-20">
        <h2 className="text-2xl font-bold sm:text-3xl">Ready to start?</h2>
        <p className="mt-3 text-[var(--color-fg-muted)]">
          Free plan, no credit card. $1 trial on paid. Cancel any time.
        </p>
        <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/app/signup"
            className="rounded-md bg-[var(--color-accent)] px-7 py-3 font-semibold text-black hover:opacity-90"
          >
            Start editing free
          </Link>
          <Link
            href="/app/signup?plan=creator"
            className="rounded-md border border-[var(--color-border)] px-7 py-3 hover:bg-[var(--color-surface)]"
          >
            Start $1 Creator trial
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[var(--color-border)] px-4 py-8 text-center text-sm text-[var(--color-fg-muted)] sm:px-6">
        <Link href="/" className="hover:text-[var(--color-fg)]">
          ← Back to vibeedit.video
        </Link>
      </footer>
    </div>
  );
}
