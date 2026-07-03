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
              Vibe coding, but for video · now in early access
            </div>

            <h1 className="text-[clamp(2.6rem,6vw,4.5rem)] font-black leading-[1.04] tracking-[-0.03em] text-[var(--color-fg)]">
              Edit any video.
              <br />
              Make any video.
              <br />
              <span className="text-[var(--color-accent)]">Just by talking.</span>
            </h1>

            <p className="mt-6 max-w-[460px] text-[1.05rem] leading-[1.7] text-[var(--color-fg-muted)]">
              Drop in your footage and fix, cut, and restructure it by chatting — or spin up a whole
              video from a sentence. No timeline. No tools to learn. You talk, the AI edits
              underneath, and hands you a finished MP4.
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

            <div className="mt-8">
              <Link
                href="/app/signup"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--color-accent)] px-8 py-4 text-base font-semibold text-black shadow-lg shadow-[var(--color-accent)]/20 transition-all hover:-translate-y-0.5 hover:opacity-95 hover:shadow-xl hover:shadow-[var(--color-accent)]/30"
              >
                Start your 7-day free trial
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 14 14"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M2 7h10M8 3l4 4-4 4" />
                </svg>
              </Link>
            </div>
            <p className="mt-4 text-xs text-[var(--color-fg-subtle)]">
              7-day trial · runs in your browser, no install · no editing skills needed
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
        <div className="mx-auto max-w-5xl px-4 py-20 sm:px-6 sm:py-28">
          <div className="mb-14 text-center">
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.15em] text-[var(--color-accent)]">
              The core idea
            </p>
            <h2 className="text-[clamp(1.8rem,4vw,3rem)] font-bold leading-[1.15] tracking-tight">
              Two jobs. One conversation.
            </h2>
            <p className="mx-auto mt-6 max-w-lg text-[1rem] leading-[1.8] text-[var(--color-fg-muted)]">
              Editors wait for you to drag clips and turn dials. VibeEdit just listens. You talk —
              it cuts, grades, captions, builds, and hands you an MP4. You direct. It executes.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <JobCard
              kicker="Edit any video"
              title="Bring your own footage."
              body="Drop in your clips and fix them by chatting. Trim the rambling, cut to the good parts, restructure the whole thing, fix the color, add captions — all by describing it. No timeline to scrub, no panels to learn."
              examples={[
                '"Cut the dead air and tighten the intro."',
                '"Reorder this so the demo comes first."',
                '"Warm grade and burn captions."',
              ]}
            />
            <JobCard
              kicker="Or make one"
              title="Build from scratch."
              body="No footage? Describe the video you want and the AI builds every scene — titles, motion graphics, transitions, music. The same chat that edits your clips can generate a video from a single sentence."
              examples={[
                '"30s finance hook, black + neon green."',
                '"Explainer for my app, three scenes."',
                '"Make scene 2 punchier."',
              ]}
            />
          </div>
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

      {/* ── RECURRING CHARACTER ───────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-y border-[var(--color-border)] bg-[var(--color-surface)]/50">
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <div
            className="absolute -right-32 top-1/2 h-[420px] w-[420px] -translate-y-1/2 rounded-full opacity-[0.06]"
            style={{ background: "radial-gradient(circle, #d4ff3a 0%, transparent 70%)" }}
          />
        </div>
        <div className="relative mx-auto grid max-w-6xl gap-12 px-4 py-20 sm:px-6 sm:py-28 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:gap-16">
          <div>
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-[var(--color-border-2)] bg-[var(--color-surface)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-accent)]">
              Only on VibeEdit
            </p>
            <h2 className="text-[clamp(1.8rem,4vw,3rem)] font-bold leading-[1.12] tracking-tight">
              One character.
              <br />
              <span className="text-[var(--color-accent)]">Every video.</span>
            </h2>
            <p className="mt-6 max-w-lg text-[1.05rem] leading-[1.8] text-[var(--color-fg-muted)]">
              Lock in a recurring AI host once, and they star — consistently — in everything you
              make. Same face, same voice, same vibe across every upload. It becomes your channel's
              identity, the way CodeBullet's character is his.
            </p>
            <p className="mt-4 max-w-lg text-[1.05rem] leading-[1.8] text-[var(--color-fg-muted)]">
              No other AI video tool can keep a character consistent. We built VibeEdit around it.
            </p>
            <ul className="mt-8 space-y-3">
              {[
                "Generate a host, then lock them as your brand",
                "Reuse the same persona in any new project",
                "AI poses & expressions from your locked base",
              ].map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm text-[var(--color-fg)]">
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
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Intro", emoji: "🎬", tint: "from-[#d4ff3a]/15" },
              { label: "Reaction", emoji: "😮", tint: "from-[#60a5fa]/15" },
              { label: "Explainer", emoji: "🧑‍🏫", tint: "from-[#ff6ad5]/15" },
              { label: "Hook", emoji: "🔥", tint: "from-[#00ff88]/15" },
              { label: "Outro", emoji: "👋", tint: "from-[#ffd43b]/15" },
              { label: "Thumbnail", emoji: "📸", tint: "from-[#c774e8]/15" },
            ].map((pose) => (
              <div
                key={pose.label}
                className={`relative flex aspect-[3/4] flex-col items-center justify-center gap-2 overflow-hidden rounded-xl border border-[var(--color-border)] bg-gradient-to-b ${pose.tint} to-transparent`}
              >
                <span className="text-3xl">{pose.emoji}</span>
                <span className="absolute inset-x-0 bottom-0 bg-black/50 py-1 text-center text-[10px] uppercase tracking-wide text-white/80 backdrop-blur-sm">
                  {pose.label}
                </span>
              </div>
            ))}
          </div>
        </div>
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

      {/* ── WORKFLOW PICKER ───────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
        <div className="mb-14 text-center">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.15em] text-[var(--color-accent)]">
            Built for every editor
          </p>
          <h2 className="text-[clamp(1.8rem,4vw,3rem)] font-bold tracking-tight">
            Knows your workflow.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-[var(--color-fg-muted)]">
            YouTube, weddings, corporate, documentaries, social shorts — the agent adapts its style,
            pacing, and output format to match what you actually make.
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
              Every tool. Every tier.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-[var(--color-fg-muted)]">
              The full editor is unlocked on every plan — 4K, no watermark, every AI tool. One
              credit currency powers every action. Pick your monthly volume. 7-day trial on all
              plans.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <PricingCard
              name="Starter"
              price="$39"
              sub="per month · 7-day trial"
              features={[
                "1,000 credits / month",
                "The full editor — nothing gated",
                "4K exports · no watermark",
                "AI edits, images, b-roll, voiceover & music",
                "Top-up credits any time",
              ]}
              cta={{ label: "Start 7-day trial", href: "/app/signup?plan=creator" }}
            />
            <PricingCard
              name="Pro"
              price="$99"
              sub="per month · most popular"
              highlight
              features={[
                "3,000 credits / month",
                "The full editor — nothing gated",
                "4K exports · no watermark",
                "3× the volume for serious output",
                "Top-up credits any time",
              ]}
              cta={{ label: "Start 7-day trial", href: "/app/signup?plan=pro" }}
            />
            <PricingCard
              name="Studio"
              price="$149"
              sub="per month · 7-day trial"
              features={[
                "5,000 credits / month",
                "The full editor — nothing gated",
                "4K exports · priority render queue",
                "Highest volume",
                "Top-up credits any time",
              ]}
              cta={{ label: "Start 7-day trial", href: "/app/signup?plan=studio" }}
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
            a="They generate raw pixels you can't edit. VibeEdit edits real footage and builds compositions that render deterministically — same prompt, same MP4, every time. You can also refine anything by chat. And only VibeEdit gives you a recurring AI host who stars consistently across every video."
          />
          <Faq
            q="What's the recurring character?"
            a="Generate an AI host once, lock them in, and they appear — same face, same voice, same vibe — in every video you make. It becomes your channel's identity (think CodeBullet's character). The AI can also pose and re-express your locked host for new scenes. No other AI video tool keeps a character consistent."
          />
          <Faq
            q="Do I have to install anything?"
            a="No. Everything renders in the cloud, right in your browser. Paid plans can add an optional local worker for faster renders."
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
            q="Can it add captions automatically?"
            a="Yes. Drop any footage into the project, say 'add captions', and the agent transcribes via Whisper, generates word-level offsets, styles them (2-word chunks, bold white pill), and burns them permanently into the export. Bring your own OpenAI key for transcription."
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
            Edit your footage or build from scratch — and let your recurring host star in all of it.
            No timeline, no tools. Just talk.
          </p>
          <Link
            href="/app/signup"
            className="mt-10 inline-flex items-center gap-2 rounded-xl bg-[var(--color-accent)] px-8 py-4 text-base font-semibold text-black shadow-xl shadow-[var(--color-accent)]/20 transition-all hover:-translate-y-0.5 hover:opacity-95 hover:shadow-2xl hover:shadow-[var(--color-accent)]/30 sm:text-lg"
          >
            Make your first video — free
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

/* ── Job card ─────────────────────────────────────────────────────────────── */
function JobCard({
  kicker,
  title,
  body,
  examples,
}: {
  kicker: string;
  title: string;
  body: string;
  examples: string[];
}) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 sm:p-8">
      <div className="text-xs font-semibold uppercase tracking-[0.15em] text-[var(--color-accent)]">
        {kicker}
      </div>
      <h3 className="text-xl font-bold text-[var(--color-fg)] sm:text-2xl">{title}</h3>
      <p className="text-sm leading-relaxed text-[var(--color-fg-muted)] sm:text-base">{body}</p>
      <div className="mt-1 space-y-2">
        {examples.map((example) => (
          <div
            key={example}
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-2)] px-3 py-2 font-mono text-xs leading-relaxed text-[var(--color-fg)]"
          >
            <span className="text-[var(--color-accent)]">{"> "}</span>
            {example}
          </div>
        ))}
      </div>
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
