import Link from "next/link";
import { Wordmark } from "@/components/Wordmark";
import { MarketingNav } from "@/components/MarketingNav";
import { WaitlistForm } from "@/components/WaitlistForm";
import { HeroSandbox } from "@/components/landing/HeroSandbox";
import { NichePicker } from "@/components/landing/NichePicker";

export default function Home() {
	return (
		<div className="min-h-screen overflow-x-hidden">
			<MarketingNav />

			{/* ───── HERO ───────────────────────────────────────────── */}
			<section className="mx-auto max-w-7xl px-4 pt-10 pb-20 sm:px-6 sm:pt-16 sm:pb-28 lg:pt-24 lg:pb-36">
				<div className="grid gap-12 lg:grid-cols-[1fr_1.1fr] lg:items-center lg:gap-16">
					<div>
						<div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1 text-xs text-[var(--color-fg-muted)]">
							<span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--color-accent)]" />
							For faceless YouTubers
						</div>
						<h1 className="text-4xl font-black leading-[1.05] tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
							Type a video.
							<br />
							<span className="text-[var(--color-accent)]">
								Get an MP4.
							</span>
						</h1>
						<p className="mt-6 max-w-md text-lg leading-relaxed text-[var(--color-fg-muted)] sm:text-xl">
							Tell an AI what you want. It writes the composition,
							watches its own preview, and renders a YouTube-ready MP4.
						</p>
						<p className="mt-4 inline-flex items-center gap-2 text-sm text-[var(--color-accent)]">
							<span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--color-accent)]" />
							Try it live → type a prompt over there
						</p>
						<div className="mt-8 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
							<Link
								href="/app/signup"
								className="rounded-md bg-[var(--color-accent)] px-6 py-3 text-center font-semibold text-black hover:opacity-90"
							>
								Start your first video
							</Link>
							<Link
								href="#how"
								className="rounded-md border border-[var(--color-border)] px-6 py-3 text-center hover:bg-[var(--color-surface)]"
							>
								See how it works
							</Link>
						</div>
						<p className="mt-4 text-xs text-[var(--color-fg-muted)]">
							$1 for 14 days · cancel anytime · no credit-card prompt
						</p>
					</div>

					<HeroSandbox />
				</div>
			</section>

			{/* ───── ONE BIG IDEA ──────────────────────────────────── */}
			<section className="border-y border-[var(--color-border)] bg-[var(--color-surface)]/40">
				<div className="mx-auto max-w-3xl px-4 py-20 text-center sm:px-6 sm:py-28">
					<div className="mb-3 text-xs uppercase tracking-wider text-[var(--color-accent)]">
						The core idea
					</div>
					<h2 className="text-3xl font-bold leading-tight sm:text-4xl md:text-5xl">
						The chat <em className="not-italic text-[var(--color-accent)]">is</em> the timeline.
					</h2>
					<p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-[var(--color-fg-muted)] sm:text-lg">
						No drag-and-drop. No keyframes. You write what you want and
						the agent edits the video for you — scene by scene, by chat.
					</p>
				</div>
			</section>

			{/* ───── THREE STEPS ───────────────────────────────────── */}
			<section id="how" className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
				<div className="mb-14 text-center sm:mb-20">
					<div className="mb-3 text-xs uppercase tracking-wider text-[var(--color-accent)]">
						How it works
					</div>
					<h2 className="text-3xl font-bold sm:text-4xl md:text-5xl">
						Three steps to one video.
					</h2>
				</div>

				<div className="space-y-12 sm:space-y-16">
					<BigStep
						n="01"
						title="Write what you want."
						body="One sentence. A creative brief, not a timeline. The agent reads it and plans the scenes."
						example='"60s 16:9 history mystery about Roanoke. Sepia, slow ken-burns, no flashes."'
					/>
					<BigStep
						n="02"
						title="The agent builds — and checks its own work."
						body="It writes the composition, lints it, screenshots key frames, and fixes anything broken before you see it."
						example="✓ plan_composition  ✓ write_file  ✓ lint  ✓ screenshot_at_time  ✓ Built it."
						mono
					/>
					<BigStep
						n="03"
						title="Edit by chat. Render to MP4."
						body='"Make scene 3 punchier." "Drop the white flash." Iterate in plain language. When it looks right, hit Render. Done.'
						example="Render MP4 · YouTube 1080p · 30fps  →  output.mp4"
						mono
					/>
				</div>
			</section>

			{/* ───── INTERACTIVE NICHE PICKER ──────────────────────── */}
			<section className="border-y border-[var(--color-border)] bg-[var(--color-surface)]/30">
				<div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
					<div className="mb-14 text-center sm:mb-16">
						<div className="mb-3 text-xs uppercase tracking-wider text-[var(--color-accent)]">
							Pick your niche
						</div>
						<h2 className="text-3xl font-bold sm:text-4xl md:text-5xl">
							Tuned for the videos you make.
						</h2>
						<p className="mx-auto mt-4 max-w-xl text-[var(--color-fg-muted)]">
							Tap a niche to see what the agent draws by default.
						</p>
					</div>

					<NichePicker />
				</div>
			</section>

			{/* ───── DEMO VIDEO ─────────────────────────────────────── */}
			<section className="mx-auto max-w-4xl px-4 py-20 sm:px-6 sm:py-28">
				<div className="mb-10 text-center sm:mb-14">
					<div className="mb-3 text-xs uppercase tracking-wider text-[var(--color-accent)]">
						Watch a real render
					</div>
					<h2 className="text-3xl font-bold sm:text-4xl md:text-5xl">
						60 seconds. Start to MP4.
					</h2>
				</div>
				<div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-[var(--color-border)] bg-black shadow-2xl">
					<video
						className="absolute inset-0 h-full w-full object-cover"
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
				<p className="mt-4 text-center text-sm text-[var(--color-fg-muted)]">
					Prompt → preview → render → download · all on one screen
				</p>
			</section>

			{/* ───── PRICING ───────────────────────────────────────── */}
			<section
				id="pricing"
				className="border-t border-[var(--color-border)] bg-[var(--color-surface)]/30"
			>
				<div className="mx-auto max-w-5xl px-4 py-20 sm:px-6 sm:py-28">
					<div className="mb-14 text-center sm:mb-16">
						<div className="mb-3 text-xs uppercase tracking-wider text-[var(--color-accent)]">
							Pricing
						</div>
						<h2 className="text-3xl font-bold sm:text-4xl md:text-5xl">
							Start at a dollar.
						</h2>
						<p className="mx-auto mt-4 max-w-xl text-[var(--color-fg-muted)]">
							Two paid plans, both with a 14-day $1 trial.
						</p>
					</div>

					<div className="grid grid-cols-1 gap-5 md:grid-cols-3">
						<PricingCard
							name="Free"
							price="$0"
							sub="Forever free"
							features={[
								"3 watermarked renders / month",
								"Cloud-only render",
								"720p output",
								"All 8 niche style packs",
							]}
							cta={{ label: "Sign up free", href: "/app/signup" }}
						/>
						<PricingCard
							name="Creator"
							price="$19"
							sub="per month · most chosen"
							highlight
							features={[
								"50 renders / month included",
								"1080p, no watermark",
								"Local render worker (faster)",
								"Email support",
							]}
							cta={{
								label: "Start $1 trial",
								href: "/app/signup?plan=creator",
							}}
						/>
						<PricingCard
							name="Studio"
							price="$49"
							sub="per month"
							features={[
								"Unlimited renders",
								"4K · priority queue",
								"Brand kits (logo, colors, host)",
								"Priority support",
							]}
							cta={{
								label: "Start $1 trial",
								href: "/app/signup?plan=studio",
							}}
						/>
					</div>
				</div>
			</section>

			{/* ───── WAITLIST ──────────────────────────────────────── */}
			<section className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-20">
				<div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-center sm:p-10">
					<div className="mb-2 text-xs uppercase tracking-wider text-[var(--color-fg-muted)]">
						Not ready to sign up?
					</div>
					<h3 className="mb-5 text-xl font-bold sm:text-2xl">
						Get an email when we launch publicly.
					</h3>
					<div className="mx-auto max-w-md">
						<WaitlistForm placement="hero" />
					</div>
				</div>
			</section>

			{/* ───── FAQ ───────────────────────────────────────────── */}
			<section id="faq" className="mx-auto max-w-3xl px-4 py-20 sm:px-6 sm:py-28">
				<div className="mb-12 text-center sm:mb-14">
					<div className="mb-3 text-xs uppercase tracking-wider text-[var(--color-accent)]">
						Common questions
					</div>
					<h2 className="text-3xl font-bold sm:text-4xl md:text-5xl">
						Quick answers.
					</h2>
				</div>

				<div className="space-y-3 sm:space-y-4">
					<Faq
						q="Is the output really a YouTube-ready MP4?"
						a="Yes — deterministic h.264 with audio. Drag it into your CMS, done."
					/>
					<Faq
						q="How is this different from Sora or Runway?"
						a="They generate raw video pixels — you can't edit scene 3 by chat. We generate an editable HTML composition that renders deterministically. Same prompt = same MP4, every time."
					/>
					<Faq
						q="Do I have to install anything?"
						a="No. Free tier renders in the cloud. Paid plans add an optional local worker for faster renders, but it's not required."
					/>
					<Faq
						q="What if the AI gets it wrong?"
						a="Tell it. 'Make scene 3 red.' 'Drop the white flash.' Shift-click any preview frame to edit at that timestamp."
					/>
					<Faq
						q="Can I use my own brand and assets?"
						a="Yes. Drop images, video, audio into the project. Brand kits (Studio plan) apply your logo, colors, and host across every new project."
					/>
					<Faq
						q="Will TTS / voiceover be added?"
						a="Yes — v1.1, ~4–6 weeks after launch. For now upload your own voiceover and the agent times scenes to it."
					/>
					<Faq
						q="Does it work on my phone?"
						a="Yes. The editor stacks into chat / preview / files tabs on mobile."
					/>
				</div>
			</section>

			{/* ───── FINAL CTA ─────────────────────────────────────── */}
			<section className="border-t border-[var(--color-border)]">
				<div className="mx-auto max-w-3xl px-4 py-20 text-center sm:px-6 sm:py-28">
					<h2 className="text-3xl font-bold leading-tight sm:text-4xl md:text-5xl">
						Stop editing.{" "}
						<span className="text-[var(--color-accent)]">
							Start prompting.
						</span>
					</h2>
					<p className="mx-auto mt-5 max-w-md text-[var(--color-fg-muted)]">
						Your next video is one sentence away.
					</p>
					<Link
						href="/app/signup"
						className="mt-8 inline-block rounded-md bg-[var(--color-accent)] px-7 py-3.5 text-base font-semibold text-black hover:opacity-90 sm:px-8 sm:py-4 sm:text-lg"
					>
						Start for $1
					</Link>
				</div>
			</section>

			{/* ───── FOOTER ────────────────────────────────────────── */}
			<footer className="border-t border-[var(--color-border)] px-4 py-10 text-sm text-[var(--color-fg-muted)] sm:px-6">
				<div className="mx-auto max-w-6xl">
					<div className="mb-6 grid grid-cols-2 gap-6 md:grid-cols-4">
						<FooterCol
							title="Product"
							links={[
								{ href: "/#pricing", label: "Pricing" },
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
								{
									href: "mailto:support@vibeedit.video",
									label: "support@vibeedit.video",
								},
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
						<span>© 2026 VibeEdit. Made for creators.</span>
					</div>
				</div>
			</footer>
		</div>
	);
}

function BigStep({
	n,
	title,
	body,
	example,
	mono,
}: {
	n: string;
	title: string;
	body: string;
	example: string;
	mono?: boolean;
}) {
	return (
		<div className="grid gap-4 sm:gap-6 md:grid-cols-[120px_1fr] md:items-start md:gap-10">
			<div className="font-mono text-4xl font-bold text-[var(--color-accent)]/70 sm:text-5xl md:text-6xl">
				{n}
			</div>
			<div>
				<h3 className="mb-3 text-2xl font-bold sm:text-3xl">{title}</h3>
				<p className="mb-5 max-w-2xl text-base text-[var(--color-fg-muted)] sm:text-lg">
					{body}
				</p>
				<div
					className={`rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-sm sm:p-5 ${
						mono ? "font-mono text-[var(--color-fg)]" : "italic text-[var(--color-fg)]"
					}`}
				>
					{example}
				</div>
			</div>
		</div>
	);
}

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
			className={`rounded-2xl border bg-[var(--color-surface)] p-6 sm:p-7 ${
				highlight
					? "border-[var(--color-accent)] shadow-lg shadow-[var(--color-accent)]/10"
					: "border-[var(--color-border)]"
			}`}
		>
			<div className="mb-3 flex items-baseline justify-between">
				<h3 className="text-lg font-bold sm:text-xl">{name}</h3>
				{highlight && (
					<span className="rounded-full bg-[var(--color-accent)] px-2 py-0.5 text-xs font-semibold text-black">
						Popular
					</span>
				)}
			</div>
			<div className="mb-1 text-4xl font-black">{price}</div>
			<div className="mb-6 text-sm text-[var(--color-fg-muted)]">{sub}</div>
			<ul className="mb-6 space-y-2 text-sm">
				{features.map((feature) => (
					<li key={feature} className="flex items-start gap-2">
						<span className="mt-0.5 text-[var(--color-accent)]">→</span>
						<span>{feature}</span>
					</li>
				))}
			</ul>
			<Link
				href={cta.href}
				className={`block rounded-md py-2.5 text-center font-semibold ${
					highlight
						? "bg-[var(--color-accent)] text-black hover:opacity-90"
						: "border border-[var(--color-border)] hover:bg-[var(--color-bg)]"
				}`}
			>
				{cta.label}
			</Link>
		</div>
	);
}

function Faq({ q, a }: { q: string; a: string }) {
	return (
		<details className="group rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 sm:px-5 sm:py-4">
			<summary className="cursor-pointer list-none text-base font-semibold">
				<span className="float-right text-[var(--color-fg-muted)] transition-transform group-open:rotate-45">
					+
				</span>
				{q}
			</summary>
			<p className="mt-3 text-[var(--color-fg-muted)]">{a}</p>
		</details>
	);
}

function FooterCol({
	title,
	links,
}: {
	title: string;
	links: Array<{ href: string; label: string }>;
}) {
	return (
		<div>
			<h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-fg)]">
				{title}
			</h4>
			<ul className="space-y-1">
				{links.map((link) => (
					<li key={link.href}>
						<Link href={link.href} className="hover:text-[var(--color-fg)]">
							{link.label}
						</Link>
					</li>
				))}
			</ul>
		</div>
	);
}
