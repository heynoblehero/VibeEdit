import Link from "next/link";
import type { Metadata } from "next";
import { Wordmark } from "@/components/Wordmark";
import { PLANS } from "@/lib/billing/plans";
import { DEFAULT_CREDIT_COSTS } from "@/lib/billing/credits";

const OG_IMAGE =
  "/og?title=" +
  encodeURIComponent("Every tool. Every tier.") +
  "&subtitle=" +
  encodeURIComponent("Pick your volume. 7-day trial on every plan.") +
  "&badge=" +
  encodeURIComponent("Pricing");

export const metadata: Metadata = {
  title: "Pricing — VibeEdit",
  description:
    "One credit currency, the full AI video editor on every plan. Pick your monthly volume. 7-day trial on all plans.",
  alternates: { canonical: "/pricing" },
  openGraph: {
    title: "VibeEdit Pricing — Every tool, every tier",
    description:
      "The full AI video editor on every plan. Credits power every action. 7-day trial on all plans.",
    type: "website",
    url: "/pricing",
    siteName: "VibeEdit",
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: "VibeEdit pricing" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "VibeEdit Pricing — Every tool, every tier",
    description: "The full AI editor on every plan. Credits power every action. 7-day trial.",
    images: [OG_IMAGE],
  },
};

// ~credits a typical 60s video costs (1 edit + 60s render + 3 images + 60s VO).
const CREDITS_PER_VIDEO = 56;

const PLAN_CARDS = [
  {
    id: "creator",
    plan: PLANS.creator,
    sub: "per month · 7-day trial",
    highlight: false,
  },
  {
    id: "pro",
    plan: PLANS.pro,
    sub: "per month · most popular",
    highlight: true,
  },
  {
    id: "studio",
    plan: PLANS.studio,
    sub: "per month · 7-day trial",
    highlight: false,
  },
];

// What each action spends. Sourced from the live cost table so it never drifts.
const COST_ROWS: Array<{ action: string; cost: string }> = [
  { action: "AI edit (per request)", cost: `${DEFAULT_CREDIT_COSTS.edit} credits` },
  { action: "Final render (per 30s)", cost: `${DEFAULT_CREDIT_COSTS.render_30s} credits` },
  { action: "Draft render / preview", cost: "Free" },
  { action: "AI image", cost: `${DEFAULT_CREDIT_COSTS.image} credits` },
  { action: "AI b-roll clip (video gen)", cost: `${DEFAULT_CREDIT_COSTS.broll} credits` },
  { action: "AI voiceover (per 30s)", cost: `${DEFAULT_CREDIT_COSTS.voiceover_30s} credits` },
  { action: "AI music track", cost: `${DEFAULT_CREDIT_COSTS.music} credits` },
  { action: "Auto-captions & transcription", cost: "Free" },
];

const FAQS = [
  {
    q: "How does the 7-day trial work?",
    a: "Every plan starts with a 7-day trial. You add a card up front and aren't charged until day 7 — cancel any time before then and you pay nothing.",
  },
  {
    q: "What's a credit?",
    a: "One currency for everything. Each action — an AI edit, a render, an image, a voiceover — spends credits from your monthly balance. See the table above for exact costs.",
  },
  {
    q: "What happens when I run out of credits?",
    a: "You can upgrade your plan or buy a top-up pack. Top-up credits carry over; your monthly allowance resets on the 1st.",
  },
  {
    q: "Do unused monthly credits carry over?",
    a: "Monthly credits reset on the 1st of each month. Purchased top-up credits carry over until you use them.",
  },
  {
    q: "Is every feature on every plan?",
    a: "Yes. The entire editor — 4K exports, every AI tool, no watermark — is unlocked on all three plans. The only difference is how many credits you get each month.",
  },
  {
    q: "Can I cancel any time?",
    a: "Yes. Cancel from the billing portal inside the app — your plan stays active until the end of the billing period.",
  },
];

function creditsPerVideo(credits: number): string {
  return `≈ ${Math.floor(credits / CREDITS_PER_VIDEO)} videos / mo`;
}

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
              href="/app/signup?plan=pro"
              className="rounded-md bg-[var(--color-accent)] px-4 py-1.5 font-semibold text-black hover:opacity-90"
            >
              Start free trial
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
          Every tool. Every tier.
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-lg text-[var(--color-fg-muted)]">
          The full AI video editor is unlocked on every plan — 4K, no watermark, every tool. One
          credit currency powers every action. Just pick your monthly volume.
        </p>
        <p className="mt-3 text-sm text-[var(--color-fg-muted)]">
          7-day trial on every plan · cancel any time
        </p>
      </section>

      {/* Plan cards */}
      <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {PLAN_CARDS.map(({ id, plan, sub, highlight }) => (
            <div
              key={id}
              className={`rounded-2xl border p-6 sm:p-7 ${
                highlight
                  ? "border-[var(--color-accent)] shadow-lg shadow-[var(--color-accent)]/10"
                  : "border-[var(--color-border)] bg-[var(--color-surface)]"
              }`}
            >
              <div className="mb-3 flex items-baseline justify-between">
                <h2 className="text-lg font-bold sm:text-xl">{plan.name}</h2>
                {highlight && (
                  <span className="rounded-full bg-[var(--color-accent)] px-2 py-0.5 text-xs font-semibold text-black">
                    Popular
                  </span>
                )}
              </div>
              <div className="mb-1 text-4xl font-black">{plan.priceLabel}</div>
              <div className="mb-5 text-sm text-[var(--color-fg-muted)]">{sub}</div>
              <div className="mb-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-2)] px-4 py-3">
                <div className="text-2xl font-black text-[var(--color-accent)]">
                  {plan.creditsPerMonth.toLocaleString()}
                </div>
                <div className="text-xs text-[var(--color-fg-muted)]">
                  credits / month · {creditsPerVideo(plan.creditsPerMonth)}
                </div>
              </div>
              <ul className="mb-6 space-y-2 text-sm">
                {[
                  "The complete AI editor — nothing gated",
                  "4K exports · no watermark",
                  "AI edits, images, b-roll, voiceover & music",
                  "Auto-captions, film looks, transitions",
                  "Top-up credits any time",
                ].map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <span className="mt-0.5 text-[var(--color-accent)]">→</span>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <Link
                href={`/app/signup?plan=${id}`}
                className={`block rounded-md py-2.5 text-center font-semibold transition-opacity ${
                  highlight
                    ? "bg-[var(--color-accent)] text-black hover:opacity-90"
                    : "border border-[var(--color-border)] hover:bg-[var(--color-bg)]"
                }`}
              >
                Start 7-day trial
              </Link>
            </div>
          ))}
        </div>
        <p className="mt-6 text-center text-sm text-[var(--color-fg-muted)]">
          Same editor on every plan. The only difference is how many credits you get each month.
        </p>
      </section>

      {/* What credits buy */}
      <section className="border-t border-[var(--color-border)] bg-[var(--color-surface)]/30 px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-2xl">
          <h2 className="mb-3 text-center text-2xl font-bold sm:text-3xl">What credits buy</h2>
          <p className="mb-8 text-center text-sm text-[var(--color-fg-muted)]">
            Credits are the one currency for every action. Drafts and captions are free — you only
            spend on the work that ships.
          </p>
          <div className="overflow-x-auto rounded-2xl border border-[var(--color-border)]">
            <table className="w-full min-w-[24rem] text-sm">
              <caption className="sr-only">Credit cost per action</caption>
              <thead>
                <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-2)]">
                  <th
                    scope="col"
                    className="px-4 py-3 text-left font-medium text-[var(--color-fg-muted)]"
                  >
                    Action
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-right font-medium text-[var(--color-fg-muted)]"
                  >
                    Cost
                  </th>
                </tr>
              </thead>
              <tbody>
                {COST_ROWS.map((row) => (
                  <tr
                    key={row.action}
                    className="border-b border-[var(--color-border)] last:border-0"
                  >
                    <th
                      scope="row"
                      className="px-4 py-3 text-left font-normal text-[var(--color-fg)]"
                    >
                      {row.action}
                    </th>
                    <td
                      className={`px-4 py-3 text-right font-medium ${
                        row.cost === "Free"
                          ? "text-[var(--color-accent)]"
                          : "text-[var(--color-fg)]"
                      }`}
                    >
                      {row.cost}
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
          7-day trial on every plan. Cancel any time before it ends.
        </p>
        <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/app/signup?plan=pro"
            className="rounded-md bg-[var(--color-accent)] px-7 py-3 font-semibold text-black hover:opacity-90"
          >
            Start your free trial
          </Link>
          <Link
            href="/app/signup?plan=creator"
            className="rounded-md border border-[var(--color-border)] px-7 py-3 hover:bg-[var(--color-surface)]"
          >
            See Starter
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
