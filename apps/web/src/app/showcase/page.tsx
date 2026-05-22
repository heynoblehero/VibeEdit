import Link from "next/link";
import { Wordmark } from "@/components/Wordmark";
import { MarketingNav } from "@/components/MarketingNav";

// Curated showcases displayed to logged-out visitors. Each entry pairs a
// niche-tagged faceless YouTube format with the exact prompt that produced
// it, so prospects can see the prompt-to-video relationship before signup.
// Swap to a CMS / DB-driven list once we have real creator submissions.
type ShowcaseEntry = {
	niche: string;
	title: string;
	description: string;
	prompt: string;
	ratio: "9:16" | "16:9";
	gradient: string;
	accent: string;
};

const SHOWCASES: ShowcaseEntry[] = [
	{
		niche: "Comic facts",
		title: "10 Marvel facts that broke the multiverse",
		description:
			"Rapid-fire title smash with red glass cracks on every beat — built for 60-second retention.",
		prompt:
			'"30s comic facts hook, red glass cracks at every title smash, hard cuts on the kick."',
		ratio: "9:16",
		gradient:
			"linear-gradient(135deg, #ff2b3a 0%, #ff8a3a 45%, #1a0a0e 100%)",
		accent: "#ff2b3a",
	},
	{
		niche: "Anime facts",
		title: "The Naruto detail no one noticed",
		description:
			"Manga-panel transitions, ink-splash reveal, fast type-on captions for silent autoplay.",
		prompt:
			'"45s anime facts short, manga panel slide-ins, ink splatter on the reveal, big type-on captions."',
		ratio: "9:16",
		gradient:
			"linear-gradient(135deg, #ff5aa8 0%, #ffd93d 50%, #1a0a14 100%)",
		accent: "#ff5aa8",
	},
	{
		niche: "History mysteries",
		title: "The pyramid no one talks about",
		description:
			"Sepia-wash B-roll, parchment overlays, slow zoom-ins timed to a documentary VO.",
		prompt:
			'"3-minute history mystery long-form, parchment textures, slow Ken Burns zoom, sepia look, ominous low drone bed."',
		ratio: "16:9",
		gradient:
			"linear-gradient(135deg, #d4a55c 0%, #6b4a1f 50%, #120a05 100%)",
		accent: "#d4a55c",
	},
	{
		niche: "Finance hooks",
		title: "Why I tracked $10,420 in 30 days",
		description:
			"Bold green ticker numbers count up on the hook, clean sans-serif chyrons, punchy cuts.",
		prompt:
			'"60s finance hook, big green count-up numbers, clean white sans-serif chyrons, minimal black background."',
		ratio: "16:9",
		gradient:
			"linear-gradient(135deg, #5be39a 0%, #0e7a47 55%, #050f0a 100%)",
		accent: "#5be39a",
	},
	{
		niche: "Sleep stories",
		title: "Ancient stars — a sleep story",
		description:
			"30-minute slow drift through deep-space gradients, breath-paced fades, no hard cuts.",
		prompt:
			'"30-minute sleep story, slow drifting nebula gradients, long crossfades only, no cuts, soft type fade-ins every 90s."',
		ratio: "16:9",
		gradient:
			"linear-gradient(135deg, #9b8bd9 0%, #2a1f5c 55%, #0a081a 100%)",
		accent: "#9b8bd9",
	},
	{
		niche: "Scary stories",
		title: "The basement tape — Episode 04",
		description:
			"VHS scanlines, red flicker frames on jump beats, distorted type at the title card.",
		prompt:
			'"5-minute scary story, VHS scanline overlay, red 1-frame flicker on every jump beat, distorted type for the title."',
		ratio: "9:16",
		gradient:
			"linear-gradient(135deg, #7c4ddf 0%, #ff2b3a 55%, #0a0510 100%)",
		accent: "#7c4ddf",
	},
];

export default function ShowcasePage() {
	return (
		<div className="min-h-screen">
			<MarketingNav />

			<section className="mx-auto max-w-6xl px-4 pt-10 pb-10 text-center sm:px-6 sm:pt-16 sm:pb-12">
				<div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1 text-xs text-[var(--color-fg-muted)]">
					<span className="inline-block h-2 w-2 rounded-full bg-[var(--color-accent)]" />
					Showcase
				</div>
				<h1 className="mx-auto max-w-4xl text-4xl font-black leading-tight tracking-tight sm:text-5xl md:text-7xl">
					Real videos. <br />
					<span className="text-[var(--color-accent)]">Real prompts.</span>
				</h1>
				<p className="mx-auto mt-6 max-w-2xl text-base text-[var(--color-fg-muted)] sm:text-lg md:text-xl">
					Every video below was generated from a single prompt — no editor,
					no timeline. Read the prompt, watch the render, then write your
					own.
				</p>
			</section>

			<section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
				<div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
					{SHOWCASES.map((entry) => (
						<ShowcaseCard key={entry.title} entry={entry} />
					))}
				</div>
			</section>

			<section className="mx-auto max-w-3xl px-4 pb-24 pt-8 text-center sm:px-6 sm:pb-32 sm:pt-12">
				<h2 className="mb-4 text-2xl font-bold sm:text-3xl md:text-5xl">
					Your channel, next.
				</h2>
				<p className="mx-auto mt-4 max-w-xl text-[var(--color-fg-muted)]">
					Pick a niche, write a prompt, ship a video tonight. No editing
					skills required.
				</p>
				<Link
					href="/app/signup"
					className="mt-8 inline-block rounded-md bg-[var(--color-accent)] px-6 py-3 text-base font-semibold text-black hover:opacity-90 sm:px-8 sm:py-4 sm:text-lg"
				>
					Start your first video
				</Link>
				<p className="mt-4 text-xs text-[var(--color-fg-muted)]">
					$1 trial for 14 days. Cancel any time.
				</p>
			</section>

			<footer className="border-t border-[var(--color-border)] px-4 py-10 text-sm text-[var(--color-fg-muted)] sm:px-6">
				<div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
					<Wordmark size="sm" />
					<span>© 2026 VibeEdit. Made for creators.</span>
				</div>
			</footer>
		</div>
	);
}

function ShowcaseCard({ entry }: { entry: ShowcaseEntry }) {
	const isVertical = entry.ratio === "9:16";
	return (
		<article className="group flex flex-col overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] transition hover:border-[var(--color-fg-muted)]">
			<div
				className={`relative w-full overflow-hidden ${
					isVertical ? "aspect-[9/16]" : "aspect-video"
				}`}
				style={{ background: entry.gradient }}
			>
				<video
					className="absolute inset-0 h-full w-full object-cover opacity-90"
					src="/demo.mp4"
					poster=""
					muted
					loop
					autoPlay
					playsInline
					preload="metadata"
				/>
				<div
					className="pointer-events-none absolute inset-0"
					style={{
						background: `linear-gradient(180deg, transparent 55%, rgba(0,0,0,0.55) 100%)`,
					}}
				/>
				<span
					className="absolute left-3 top-3 rounded-full px-2.5 py-1 text-xs font-semibold text-black"
					style={{ background: entry.accent }}
				>
					{entry.niche}
				</span>
				<span className="absolute right-3 top-3 rounded bg-black/50 px-2 py-1 font-mono text-[10px] text-white/80">
					{entry.ratio}
				</span>
			</div>
			<div className="flex flex-1 flex-col p-5">
				<h3 className="mb-2 text-lg font-bold leading-tight">
					{entry.title}
				</h3>
				<p className="mb-4 text-sm text-[var(--color-fg-muted)]">
					{entry.description}
				</p>
				<div className="mt-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
					<div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-fg-muted)]">
						Prompt
					</div>
					<p className="font-mono text-xs leading-snug text-[var(--color-fg)]">
						{entry.prompt}
					</p>
				</div>
			</div>
		</article>
	);
}
