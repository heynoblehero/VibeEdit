"use client";

import { useState } from "react";

type Niche = {
	id: string;
	label: string;
	prompt: string;
	gradient: string;
	headline: string;
	headlineColor: string;
	textShadow?: string;
	subline: string;
};

const NICHES: Niche[] = [
	{
		id: "comic",
		label: "Comic facts",
		prompt:
			"30s vertical comic-facts Short. Red + yellow, halftone, glass-crack on the title beat.",
		gradient:
			"radial-gradient(circle at 50% 30%, #ffd43b 0%, #ff2b3a 60%, #1a0608 100%)",
		headline: "COMIC FACTS",
		headlineColor: "#ffe169",
		textShadow: "2px 2px 0 #ff2b3a, -2px -2px 0 #2a8cff",
		subline: "Bold typography · halftone dots · chromatic title hits",
	},
	{
		id: "anime",
		label: "Anime facts",
		prompt:
			"25s anime facts Short. Pink + cyan, speed lines, chromatic title, scale-pulse.",
		gradient: "linear-gradient(135deg, #ff6ad5 0%, #c774e8 35%, #6ddff8 100%)",
		headline: "ANIME!",
		headlineColor: "#ffffff",
		textShadow: "2px 2px 0 #ff2bd1, -2px -2px 0 #2adff8",
		subline: "Pink + cyan · speed lines · scale-pulse reveals",
	},
	{
		id: "history",
		label: "History",
		prompt:
			"45s 16:9 history mystery intro. Sepia, slow ken-burns, candle flicker, no flashes.",
		gradient:
			"radial-gradient(circle at 50% 30%, #c89b58 0%, #6e4023 50%, #1e0e05 100%)",
		headline: "ROANOKE",
		headlineColor: "#f5e0a8",
		textShadow: "1px 1px 0 #00000080",
		subline: "Sepia + serif · slow ken-burns · solemn brass",
	},
	{
		id: "finance",
		label: "Finance",
		prompt:
			"20s finance hook. Black + neon green, animated counters, ticker tape, scanlines.",
		gradient: "linear-gradient(180deg, #000000 0%, #001a0d 70%, #000 100%)",
		headline: "$10,000",
		headlineColor: "#00ff88",
		subline: "Black + green · mono counters · scanline overlay",
	},
	{
		id: "sleep",
		label: "Sleep stories",
		prompt:
			"60s sleep-story intro. Indigo + soft amber, slow ambient, fog drifting, no quick cuts.",
		gradient: "linear-gradient(180deg, #1d2870 0%, #3a4a9c 50%, #d8a96c 100%)",
		headline: "calm.",
		headlineColor: "#ffeacb",
		subline: "Indigo + amber · soft serif · slow ambient bed",
	},
	{
		id: "scary",
		label: "Scary stories",
		prompt:
			"30s horror hook. Dark blue + sickly green, vignette, low rumble, glitch on title.",
		gradient:
			"radial-gradient(circle at 50% 60%, #1c2230 0%, #050810 70%, #000 100%)",
		headline: "DON'T",
		headlineColor: "#7fb8a4",
		subline: "Vignette · low rumble · glitch beat on the title",
	},
	{
		id: "scifi",
		label: "Sci-fi",
		prompt:
			"30s sci-fi declassified Short. Cyan-on-black, grid + scanlines, glowing case-file number.",
		gradient:
			"radial-gradient(circle at 50% 40%, #00ddff30 0%, #050a18 60%, #000 100%)",
		headline: "[FILE 087]",
		headlineColor: "#00ddff",
		subline: "Cyan-on-black · grid + scanlines · ominous tone",
	},
	{
		id: "tech",
		label: "Tech tutorials",
		prompt:
			"15s tech tutorial intro. Dark UI, terminal-green accent, code rain, animated counter.",
		gradient: "linear-gradient(135deg, #0a0e14 0%, #0b1a17 100%)",
		headline: "$ run",
		headlineColor: "#7cf06e",
		subline: "Dark UI · monospace · code rain background",
	},
];

export function NichePicker() {
	const [activeId, setActiveId] = useState<string>(NICHES[0].id);
	const active = NICHES.find((niche) => niche.id === activeId) ?? NICHES[0];

	return (
		<div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:gap-10 lg:items-center">
			<div className="order-2 lg:order-1">
				<div className="mb-3 text-xs uppercase tracking-wider text-[var(--color-accent)]">
					Try a niche →
				</div>
				<div className="mb-6 flex flex-wrap gap-2">
					{NICHES.map((niche) => (
						<button
							key={niche.id}
							onClick={() => setActiveId(niche.id)}
							className={`rounded-full px-3 py-1.5 text-sm transition-colors ${
								niche.id === activeId
									? "bg-[var(--color-accent)] text-black"
									: "border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-fg-muted)] hover:border-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
							}`}
						>
							{niche.label}
						</button>
					))}
				</div>

				<div className="mb-3 text-xs uppercase tracking-wider text-[var(--color-fg-muted)]">
					What you'd type
				</div>
				<div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 font-mono text-sm leading-relaxed text-[var(--color-fg)]">
					<span className="text-[var(--color-accent)]">{"> "}</span>
					{active.prompt}
				</div>
				<div className="mt-3 text-sm text-[var(--color-fg-muted)]">
					{active.subline}
				</div>
			</div>

			<div className="order-1 lg:order-2">
				<div className="relative mx-auto aspect-[9/16] w-full max-w-[260px] overflow-hidden rounded-2xl ring-1 ring-white/10 transition-all duration-500">
					<div
						key={active.id}
						className="absolute inset-0 animate-[fadeIn_400ms_ease-out]"
						style={{ background: active.gradient }}
					/>
					{active.id === "comic" && (
						<div
							className="absolute inset-0 opacity-25"
							style={{
								backgroundImage:
									"radial-gradient(circle, rgba(0,0,0,0.55) 1px, transparent 1.5px)",
								backgroundSize: "6px 6px",
							}}
						/>
					)}
					<div
						key={`headline-${active.id}`}
						className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center animate-[fadeIn_500ms_ease-out]"
					>
						<div
							className="text-3xl font-black leading-tight"
							style={{
								color: active.headlineColor,
								textShadow: active.textShadow,
							}}
						>
							{active.headline}
						</div>
					</div>
					<div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-black/60 px-3 py-2 backdrop-blur-sm">
						<span className="text-xs text-white/90">{active.label}</span>
						<span className="rounded bg-white/15 px-1.5 py-0.5 font-mono text-[10px] uppercase text-white/80">
							{active.id === "history" ||
							active.id === "finance" ||
							active.id === "tech"
								? "16:9"
								: "9:16"}
						</span>
					</div>
				</div>
			</div>
		</div>
	);
}
