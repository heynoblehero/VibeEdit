import Link from "next/link";
import { Wordmark } from "@/components/Wordmark";
import { MarketingNav } from "@/components/MarketingNav";
import { WaitlistForm } from "@/components/WaitlistForm";
import { HeroSandbox } from "@/components/landing/HeroSandbox";
import { HowItWorksTabs } from "@/components/landing/HowItWorksTabs";
import { NichePicker } from "@/components/landing/NichePicker";
import { StatsBar } from "@/components/landing/StatsBar";

export default function Home() {
  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <MarketingNav />

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section className="relative mx-auto max-w-7xl px-4 pt-8 pb-24 sm:px-6 sm:pt-14 sm:pb-32 lg:pt-20 lg:pb-40">
        {/* Background orbs */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          <div
            className="absolute -top-32 left-1/2 h-[600px] w-[600px] -translate-x-1/2 rounded-full opacity-[0.07]"
            style={{
              background: "radial-gradient(circle, #d4ff3a 0%, transparent 70%)",
              animation: "orb-drift 14s ease-in-out infinite",
            }}
          />
          <div
            className="absolute top-40 -right-40 h-[400px] w-[400px] rounded-full opacity-[0.05]"
            style={{
              background: "radial-gradient(circle, #60a5fa 0%, transparent 70%)",
              animation: "orb-drift 18s ease-in-out infinite reverse",
            }}
          />
          {/* Subtle grid */}
          <div
            className="absolute inset-0 opacity-[0.018]"
            style={{
              backgroundImage:
                "linear-gradient(var(--color-fg) 1px, transparent 1px), linear-gradient(90deg, var(--color-fg) 1px, transparent 1px)",
              backgroundSize: "60px 60px",
            }}
          />
        </div>

        <div className="relative grid gap-12 lg:grid-cols-[1fr_1.15fr] lg:items-center lg:gap-20">
          {/* Left col */}
          <div className="animate-slide-up">
            {/* Badge */}
            <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-[var(--color-border-2)] bg-[var(--color-surface)] px-3.5 py-1.5 text-xs font-medium text-[var(--color-fg-muted)]">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--color-accent)] opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--color-accent)]" />
              </span>
              AI video editing agent · now in early access
            </div>

            <h1 className="text-[clamp(2.6rem,6vw,4.5rem)] font-black leading-[1.04] tracking-[-0.03em] text-[var(--color-fg)]">
              Describe the edit.
              <br />
              <span className="text-[var(--color-accent)]">Get the MP4.</span>
            </h1>

            <p className="mt-6 max-w-[440px] text-[1.05rem] leading-[1.7] text-[var(--color-fg-muted)]">
              Upload footage and tell the agent what you want. It trims, grades, captions, and
              exports — no timeline, no settings panels. Just chat.
            </p>

            <p className="mt-5 flex items-center gap-2 text-sm font-medium text-[var(--color-accent)]">
              <svg
                width="14"
                height="14"
                viewBox="0 0 14 14"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M7 0l1.8 5.5H14l-4.6 3.4 1.8 5.5L7 11 2.8 14.4l1.8-5.5L0 5.5h5.2z" />
              </svg>
              Try it live — type a prompt in the sandbox →
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                href="/app/signup"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--color-accent)] px-7 py-3.5 font-semibold text-black shadow-lg shadow-[var(--color-accent)]/20 transition-all hover:opacity-90 hover:shadow-[var(--color-accent)]/30"
              >
                Start editing free
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 14 14"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M2 7h10M8 3l4 4-4 4" />
                </svg>
              </Link>
              <Link
                href="#how"
                className="inline-flex items-center justify-center rounded-xl border border-[var(--color-border-2)] bg-[var(--color-surface)] px-7 py-3.5 font-medium text-[var(--color-fg)] transition-colors hover:border-[var(--color-border-2)] hover:bg-[var(--color-surface-2)]"
              >
                See how it works
              </Link>
            </div>
            <p className="mt-4 text-xs text-[var(--color-fg-subtle)]">
              Free plan available · $1 trial on paid plans · no credit card required
            </p>
          </div>

          {/* Right col — sandbox */}
          <div className="animate-slide-up delay-150">
            <HeroSandbox />
          </div>
        </div>
      </section>

      <StatsBar />

      {/* ── THE BIG IDEA ──────────────────────────────────────────────────── */}
      <section className="border-y border-[var(--color-border)] bg-[var(--color-surface)]/50">
        <div className="mx-auto max-w-3xl px-4 py-20 text-center sm:px-6 sm:py-28">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.15em] text-[var(--color-accent)]">
            The core idea
          </p>
          <h2 className="text-[clamp(1.8rem,4vw,3rem)] font-bold leading-[1.15] tracking-tight">
            An agent, not a tool.
          </h2>
          <p className="mx-auto mt-6 max-w-lg text-[1rem] leading-[1.8] text-[var(--color-fg-muted)]">
            Traditional editors wait for you to drag clips and turn dials. VibeEdit reads your
            message, plans the edit, runs the tools, checks its own work, and hands you an MP4. You
            direct. It executes.
          </p>
        </div>
      </section>

      {/* ── HOW IT WORKS ──────────────────────────────────────────────────── */}
      <section id="how" className="mx-auto max-w-4xl px-4 py-20 sm:px-6 sm:py-28">
        <div className="mb-14 text-center">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.15em] text-[var(--color-accent)]">
            How it works
          </p>
          <h2 className="text-[clamp(1.8rem,4vw,3rem)] font-bold tracking-tight">
            Two workflows. One chat.
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-[var(--color-fg-muted)]">
            Edit real footage or build a video from scratch — same agent, same chat window.
          </p>
        </div>
        <HowItWorksTabs />
      </section>

      {/* ── CAPABILITIES ──────────────────────────────────────────────────── */}
      <section className="border-y border-[var(--color-border)] bg-[var(--color-surface)]/30">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
          <div className="mb-14 text-center">
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.15em] text-[var(--color-accent)]">
              Capabilities
            </p>
            <h2 className="text-[clamp(1.8rem,4vw,3rem)] font-bold tracking-tight">
              What the agent can do.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-[var(--color-fg-muted)]">
              Every operation triggered from chat. No menus, no settings panels.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <FeatureChip
              icon={<IconScissors />}
              title="Word-boundary cuts"
              body="Never cuts mid-phoneme — snaps to transcript word edges with a 50ms silence pad."
            />
            <FeatureChip
              icon={<IconPalette />}
              title="Auto color grade"
              body="Analyzes each clip's luma and saturation, applies subtle ±8% corrections per segment."
            />
            <FeatureChip
              icon={<IconWaveform />}
              title="Loudness normalization"
              body="2-pass −14 LUFS on the final output — broadcast-ready, no volume jumps between clips."
            />
            <FeatureChip
              icon={<IconCaptions />}
              title="Sync'd captions"
              body="Word-level output-timeline offsets, 2-word UPPERCASE chunks, burned after all overlays."
            />
            <FeatureChip
              icon={<IconFilm />}
              title="Motion graphics"
              body="Describe a scene from scratch and the agent builds it — titles, ken-burns, transitions, music."
            />
            <FeatureChip
              icon={<IconBolt />}
              title="Speed ramp + chroma key"
              body="0.25×–4.0× speed with pitch-correct audio. Green/blue screen removal per segment."
            />
          </div>
        </div>
      </section>

      {/* ── NICHE PICKER ──────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
        <div className="mb-14 text-center">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.15em] text-[var(--color-accent)]">
            Built for your content
          </p>
          <h2 className="text-[clamp(1.8rem,4vw,3rem)] font-bold tracking-tight">
            Knows your niche.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-[var(--color-fg-muted)]">
            The agent understands style conventions across content types — tap one to see what it
            produces by default.
          </p>
        </div>
        <NichePicker />
      </section>

      {/* ── DEMO VIDEO ────────────────────────────────────────────────────── */}
      <section className="border-t border-[var(--color-border)] bg-[var(--color-surface)]/30">
        <div className="mx-auto max-w-4xl px-4 py-20 sm:px-6 sm:py-28">
          <div className="mb-12 text-center">
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.15em] text-[var(--color-accent)]">
              Watch a real render
            </p>
            <h2 className="text-[clamp(1.8rem,4vw,3rem)] font-bold tracking-tight">
              60 seconds. Start to MP4.
            </h2>
          </div>
          <div className="relative overflow-hidden rounded-2xl border border-[var(--color-border)] bg-black shadow-2xl">
            {/* Accent glow ring */}
            <div className="pointer-events-none absolute inset-0 z-10 rounded-2xl ring-1 ring-inset ring-white/5" />
            <div className="aspect-video w-full">
              <video
                className="h-full w-full object-cover"
                src="/demo.mp4"
                poster="/demo-poster.jpg"
                controls
                autoPlay
                loop
                muted
                preload="metadata"
                playsInline
                aria-label="VibeEdit demo: prompt to MP4 in 60 seconds"
              />
            </div>
          </div>
          <p className="mt-5 text-center text-sm text-[var(--color-fg-muted)]">
            Prompt → preview → render → download · all in one window
          </p>
        </div>
      </section>

      {/* ── PRICING ───────────────────────────────────────────────────────── */}
      <section id="pricing" className="border-t border-[var(--color-border)]">
        <div className="mx-auto max-w-5xl px-4 py-20 sm:px-6 sm:py-28">
          <div className="mb-14 text-center">
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.15em] text-[var(--color-accent)]">
              Pricing
            </p>
            <h2 className="text-[clamp(1.8rem,4vw,3rem)] font-bold tracking-tight">
              Start for free.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-[var(--color-fg-muted)]">
              Every plan includes the full agent — edit footage or build from scratch.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <PricingCard
              name="Free"
              price="$0"
              sub="Forever free"
              features={[
                "5 renders / month",
                "50 AI messages / month",
                "Cloud render · 720p",
                "All niche style packs",
                "Footage editing (trim, grade, captions)",
              ]}
              cta={{ label: "Sign up free", href: "/app/signup" }}
            />
            <PricingCard
              name="Creator"
              price="$19"
              sub="per month · most popular"
              highlight
              features={[
                "100 renders / month",
                "1,000 AI messages / month",
                "1080p · no watermark",
                "Full footage editing + auto-grade",
                "Local render worker (faster)",
                "Email support",
              ]}
              cta={{ label: "Start $1 trial", href: "/app/signup?plan=creator" }}
            />
            <PricingCard
              name="Studio"
              price="$49"
              sub="per month"
              features={[
                "Unlimited renders",
                "Unlimited AI messages",
                "4K · priority queue",
                "Brand kits (logo, colors, host)",
                "−14 LUFS loudness normalization",
                "Priority support",
              ]}
              cta={{ label: "Start $1 trial", href: "/app/signup?plan=studio" }}
            />
          </div>
        </div>
      </section>

      {/* ── WAITLIST ──────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-20">
        <div className="relative overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8 text-center sm:p-12">
          {/* Background glow */}
          <div className="pointer-events-none absolute inset-0" aria-hidden="true">
            <div className="absolute left-1/2 top-0 h-40 w-80 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--color-accent)] opacity-[0.04] blur-3xl" />
          </div>
          <p className="relative mb-2 text-xs font-semibold uppercase tracking-[0.15em] text-[var(--color-fg-muted)]">
            Not ready to sign up?
          </p>
          <h3 className="relative mb-6 text-xl font-bold sm:text-2xl">
            Get an email when we launch publicly.
          </h3>
          <div className="relative mx-auto max-w-md">
            <WaitlistForm placement="hero" />
          </div>
        </div>
      </section>

      {/* ── FAQ ───────────────────────────────────────────────────────────── */}
      <section id="faq" className="mx-auto max-w-3xl px-4 py-20 sm:px-6 sm:py-28">
        <div className="mb-12 text-center">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.15em] text-[var(--color-accent)]">
            Common questions
          </p>
          <h2 className="text-[clamp(1.8rem,4vw,3rem)] font-bold tracking-tight">Quick answers.</h2>
        </div>

        <div className="space-y-2">
          <Faq
            q="How do I edit my footage?"
            a="Upload any .mp4 or .mov, then describe the edit in chat. 'Trim the filler words, warm grade, burn captions' is enough. The agent transcribes, cuts on word boundaries, grades, syncs captions, and normalizes loudness — no timeline needed."
          />
          <Faq
            q="What can the agent actually do?"
            a="Trim to word boundaries, auto color-grade each segment, burn sync'd captions, normalize loudness (−14 LUFS), chroma key, speed ramp, mix audio tracks, create motion-graphic scenes from a text description, and layer overlays on top of real footage."
          />
          <Faq
            q="Can it create videos from scratch?"
            a="Yes. Describe a scene — '30s finance hook, black and neon green, animated counter' — and the agent builds every scene as motion graphics. Same chat, same project, same export."
          />
          <Faq
            q="Is the output a real YouTube-ready MP4?"
            a="Yes — h.264 with normalized audio. Drag it straight into your CMS or publishing tool."
          />
          <Faq
            q="How does auto-grade work?"
            a="The agent samples each clip's luma and saturation, then applies subtle ±8% corrections so segments look balanced. Override with 'warm cinematic' or 'skip grade' in chat."
          />
          <Faq
            q="How is this different from Sora or Runway?"
            a="They generate raw pixels you can't edit. VibeEdit edits real footage and builds compositions that render deterministically — same prompt, same MP4, every time. You can also refine anything by chat."
          />
          <Faq
            q="Do I have to install anything?"
            a="No. Free tier renders in the cloud. Paid plans add an optional local worker for faster renders."
          />
          <Faq
            q="What if the AI gets it wrong?"
            a="Tell it. 'Tighten the cut at 0:42.' 'Drop the white flash.' Shift-click any preview frame to edit at that timestamp."
          />
          <Faq
            q="Can I use my own brand assets?"
            a="Yes. Drop images, video, and audio into the project. Brand kits (Studio plan) apply your logo, colors, and host identity across every new project."
          />
          <Faq
            q="Will TTS / voiceover be added?"
            a="Yes — v1.1, ~4–6 weeks after launch. For now upload your own voiceover and the agent times scenes to it."
          />
        </div>
      </section>

      {/* ── FINAL CTA ─────────────────────────────────────────────────────── */}
      <section className="relative border-t border-[var(--color-border)] overflow-hidden">
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <div className="absolute left-1/2 top-1/2 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--color-accent)] opacity-[0.04] blur-[80px]" />
        </div>
        <div className="relative mx-auto max-w-3xl px-4 py-24 text-center sm:px-6 sm:py-32">
          <h2 className="text-[clamp(2rem,5vw,3.5rem)] font-black leading-[1.08] tracking-[-0.02em]">
            Your next video is <span className="text-[var(--color-accent)]">one message away.</span>
          </h2>
          <p className="mx-auto mt-5 max-w-md text-[var(--color-fg-muted)]">
            No timeline to learn. No settings to configure. Just describe what you want — the agent
            handles the rest.
          </p>
          <Link
            href="/app/signup"
            className="mt-10 inline-flex items-center gap-2 rounded-xl bg-[var(--color-accent)] px-8 py-4 text-base font-semibold text-black shadow-xl shadow-[var(--color-accent)]/20 transition-all hover:opacity-90 hover:shadow-[var(--color-accent)]/30 sm:text-lg"
          >
            Start editing free
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M3 8h10M9 4l4 4-4 4" />
            </svg>
          </Link>
        </div>
      </section>

      {/* ── FOOTER ────────────────────────────────────────────────────────── */}
      <footer className="border-t border-[var(--color-border)] px-4 py-12 text-sm text-[var(--color-fg-muted)] sm:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="mb-8 grid grid-cols-2 gap-8 md:grid-cols-4">
            <FooterCol
              title="Product"
              links={[
                { href: "/pricing", label: "Pricing" },
                { href: "/showcase", label: "Showcase" },
                { href: "/changelog", label: "Changelog" },
                { href: "/early", label: "Waitlist" },
              ]}
            />
            <FooterCol
              title="Resources"
              links={[
                { href: "/help", label: "Help docs" },
                { href: "/status", label: "Status" },
                { href: "mailto:support@vibeedit.video", label: "support@vibeedit.video" },
              ]}
            />
            <FooterCol
              title="Legal"
              links={[
                { href: "/legal/terms", label: "Terms" },
                { href: "/legal/privacy", label: "Privacy" },
                { href: "/legal/refunds", label: "Refunds" },
              ]}
            />
            <FooterCol
              title="Account"
              links={[
                { href: "/app/login", label: "Sign in" },
                { href: "/app/signup", label: "Sign up" },
                { href: "/app/affiliate", label: "Affiliate (30%)" },
              ]}
            />
          </div>
          <div className="flex flex-col items-start justify-between gap-3 border-t border-[var(--color-border)] pt-6 sm:flex-row sm:items-center">
            <Wordmark size="sm" />
            <span className="text-xs text-[var(--color-fg-subtle)]">
              © 2026 VibeEdit. Made for creators.
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ── Feature chip ─────────────────────────────────────────────────────────── */
function FeatureChip({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="group relative flex flex-col gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 transition-all hover:border-[var(--color-border-2)] hover:bg-[var(--color-surface-2)] sm:p-6">
      {/* Left accent bar */}
      <div className="absolute left-0 top-6 bottom-6 w-0.5 rounded-full bg-[var(--color-accent)] opacity-0 transition-opacity group-hover:opacity-100" />
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-bg-2)] text-[var(--color-accent)]">
        {icon}
      </div>
      <div>
        <h3 className="mb-1 font-semibold text-[var(--color-fg)]">{title}</h3>
        <p className="text-sm leading-relaxed text-[var(--color-fg-muted)]">{body}</p>
      </div>
    </div>
  );
}

/* ── Pricing card ─────────────────────────────────────────────────────────── */
function PricingCard({
  name,
  price,
  sub,
  features,
  cta,
  highlight,
}: {
  name: string;
  price: string;
  sub: string;
  features: string[];
  cta: { label: string; href: string };
  highlight?: boolean;
}) {
  return (
    <div
      className={`relative flex flex-col rounded-2xl p-6 sm:p-8 ${
        highlight
          ? "border-2 border-[var(--color-accent)] bg-[var(--color-surface)] shadow-2xl shadow-[var(--color-accent)]/10"
          : "border border-[var(--color-border)] bg-[var(--color-surface)]"
      }`}
    >
      {highlight && (
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
          <span className="rounded-full bg-[var(--color-accent)] px-3 py-1 text-xs font-bold text-black tracking-wide">
            MOST POPULAR
          </span>
        </div>
      )}
      <div className="mb-1 flex items-baseline justify-between">
        <h3 className="text-base font-semibold text-[var(--color-fg-muted)]">{name}</h3>
      </div>
      <div className="mb-1 text-[2.8rem] font-black leading-none tracking-tight">{price}</div>
      <div className="mb-7 text-sm text-[var(--color-fg-muted)]">{sub}</div>
      <ul className="mb-8 flex-1 space-y-2.5 text-sm">
        {features.map((feature) => (
          <li key={feature} className="flex items-start gap-2.5">
            <svg
              className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-accent)]"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M3 8l3.5 3.5L13 4" />
            </svg>
            <span className="text-[var(--color-fg)]">{feature}</span>
          </li>
        ))}
      </ul>
      <Link
        href={cta.href}
        className={`block rounded-xl py-3 text-center text-sm font-semibold transition-all ${
          highlight
            ? "bg-[var(--color-accent)] text-black shadow-lg shadow-[var(--color-accent)]/20 hover:opacity-90"
            : "border border-[var(--color-border-2)] text-[var(--color-fg)] hover:bg-[var(--color-surface-2)] hover:border-[var(--color-fg-muted)]"
        }`}
      >
        {cta.label}
      </Link>
    </div>
  );
}

/* ── FAQ ──────────────────────────────────────────────────────────────────── */
function Faq({ q, a }: { q: string; a: string }) {
  return (
    <details className="group rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] transition-colors open:border-[var(--color-border-2)]">
      <summary className="flex cursor-pointer select-none items-center justify-between gap-4 px-5 py-4 text-[0.95rem] font-semibold text-[var(--color-fg)] list-none">
        <span>{q}</span>
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-[var(--color-border)] text-[var(--color-fg-muted)] transition-all group-open:rotate-45 group-open:border-[var(--color-accent)] group-open:text-[var(--color-accent)]">
          <svg
            width="10"
            height="10"
            viewBox="0 0 10 10"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M5 1v8M1 5h8" />
          </svg>
        </span>
      </summary>
      <p className="border-t border-[var(--color-border)] px-5 pb-4 pt-3 text-sm leading-relaxed text-[var(--color-fg-muted)]">
        {a}
      </p>
    </details>
  );
}

/* ── Footer col ───────────────────────────────────────────────────────────── */
function FooterCol({
  title,
  links,
}: {
  title: string;
  links: Array<{ href: string; label: string }>;
}) {
  return (
    <div>
      <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--color-fg)]">
        {title}
      </h4>
      <ul className="space-y-2">
        {links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="text-sm transition-colors hover:text-[var(--color-fg)]"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ── SVG Icons ────────────────────────────────────────────────────────────── */
function IconScissors() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="6" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <path d="M20 4L8.12 15.88M14.47 14.48L20 20M8.12 8.12L12 12" />
    </svg>
  );
}
function IconPalette() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10c.83 0 1.5-.67 1.5-1.5 0-.39-.15-.74-.39-1.01-.23-.26-.38-.61-.38-.99 0-.83.67-1.5 1.5-1.5H16c2.76 0 5-2.24 5-5 0-4.42-4.03-8-9-8z" />
      <circle cx="6.5" cy="11.5" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="9.5" cy="7.5" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="14.5" cy="7.5" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="17.5" cy="11.5" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}
function IconWaveform() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2 12h2M6 8v8M10 5v14M14 9v6M18 7v10M22 12h-2" />
    </svg>
  );
}
function IconCaptions() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M7 15h4M7 11h10" />
    </svg>
  );
}
function IconFilm() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="2" y="3" width="20" height="18" rx="2" />
      <path d="M7 3v18M17 3v18M2 8h5M2 13h5M2 18h5M17 8h5M17 13h5M17 18h5" />
    </svg>
  );
}
function IconBolt() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  );
}
