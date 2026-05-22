"use client";

import { useState } from "react";

type Niche =
	| "comic"
	| "anime"
	| "scifi"
	| "history"
	| "finance"
	| "sleep"
	| "scary"
	| "tech"
	| "other";
type FormatPref = "16:9" | "9:16" | "both";
type Frequency = "daily" | "weekly" | "occasional" | "experimenting";

const NICHE_OPTIONS: Array<{ id: Niche; label: string; emoji: string }> = [
	{ id: "comic", label: "Comic / superhero", emoji: "💥" },
	{ id: "anime", label: "Anime / manga", emoji: "🌸" },
	{ id: "scifi", label: "Sci-fi / mystery", emoji: "🛸" },
	{ id: "history", label: "History", emoji: "📜" },
	{ id: "finance", label: "Finance / money", emoji: "💸" },
	{ id: "sleep", label: "Sleep stories", emoji: "🌙" },
	{ id: "scary", label: "Scary stories", emoji: "👁" },
	{ id: "tech", label: "Tech / coding", emoji: "⌨️" },
	{ id: "other", label: "Something else", emoji: "✦" },
];

const FORMAT_OPTIONS: Array<{ id: FormatPref; label: string; sub: string }> = [
	{ id: "9:16", label: "Vertical", sub: "Shorts / Reels / TikTok" },
	{ id: "16:9", label: "Horizontal", sub: "YouTube long-form" },
	{ id: "both", label: "Both", sub: "Mix of formats" },
];

const FREQUENCY_OPTIONS: Array<{ id: Frequency; label: string }> = [
	{ id: "daily", label: "Daily" },
	{ id: "weekly", label: "Weekly" },
	{ id: "occasional", label: "Occasionally" },
	{ id: "experimenting", label: "Just exploring" },
];

export function Onboarding({ onDone }: { onDone: () => void }) {
	const [niche, setNiche] = useState<Niche | null>(null);
	const [format, setFormat] = useState<FormatPref | null>(null);
	const [frequency, setFrequency] = useState<Frequency | null>(null);
	const [saving, setSaving] = useState(false);

	const canSubmit = !!(niche && format && frequency);

	async function submit(skip = false) {
		setSaving(true);
		const response = await fetch("/api/onboarding", {
			method: "PATCH",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				niche: skip ? null : niche,
				formatPreference: skip ? null : format,
				postFrequency: skip ? null : frequency,
				onboardingCompleted: true,
			}),
		});
		setSaving(false);
		const data = (await response.json().catch(() => ({}))) as {
			firstProjectId?: string | null;
		};
		if (data?.firstProjectId) {
			window.location.href = `/app/projects/${data.firstProjectId}/edit`;
			return;
		}
		onDone();
	}

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-6">
			<div className="w-full max-w-2xl rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8">
				<div className="mb-2 text-xs uppercase tracking-wider text-[var(--color-fg-muted)]">
					Tell us about your channel
				</div>
				<h2 className="mb-1 text-2xl font-bold">
					So we can make better starting prompts for you.
				</h2>
				<p className="mb-8 text-sm text-[var(--color-fg-muted)]">
					30 seconds. Skip if you'd rather not.
				</p>

				<section className="mb-6">
					<h3 className="mb-3 text-sm font-semibold">What do you make?</h3>
					<div className="grid grid-cols-3 gap-2">
						{NICHE_OPTIONS.map((option) => (
							<button
								key={option.id}
								onClick={() => setNiche(option.id)}
								className={`rounded-lg border px-3 py-3 text-left text-sm transition ${
									niche === option.id
										? "border-[var(--color-accent)] bg-[var(--color-bg-2)]"
										: "border-[var(--color-border)] hover:border-[var(--color-fg-muted)]"
								}`}
							>
								<div className="mb-0.5 text-lg leading-none">
									{option.emoji}
								</div>
								<div className="text-xs">{option.label}</div>
							</button>
						))}
					</div>
				</section>

				<section className="mb-6">
					<h3 className="mb-3 text-sm font-semibold">
						Vertical or horizontal?
					</h3>
					<div className="grid grid-cols-3 gap-2">
						{FORMAT_OPTIONS.map((option) => (
							<button
								key={option.id}
								onClick={() => setFormat(option.id)}
								className={`rounded-lg border px-4 py-3 text-left transition ${
									format === option.id
										? "border-[var(--color-accent)] bg-[var(--color-bg-2)]"
										: "border-[var(--color-border)] hover:border-[var(--color-fg-muted)]"
								}`}
							>
								<div className="text-sm font-semibold">
									{option.label}
								</div>
								<div className="text-xs text-[var(--color-fg-muted)]">
									{option.sub}
								</div>
							</button>
						))}
					</div>
				</section>

				<section className="mb-8">
					<h3 className="mb-3 text-sm font-semibold">How often do you post?</h3>
					<div className="grid grid-cols-4 gap-2">
						{FREQUENCY_OPTIONS.map((option) => (
							<button
								key={option.id}
								onClick={() => setFrequency(option.id)}
								className={`rounded-lg border px-3 py-2 text-sm transition ${
									frequency === option.id
										? "border-[var(--color-accent)] bg-[var(--color-bg-2)]"
										: "border-[var(--color-border)] hover:border-[var(--color-fg-muted)]"
								}`}
							>
								{option.label}
							</button>
						))}
					</div>
				</section>

				<div className="flex items-center justify-between">
					<button
						onClick={() => submit(true)}
						disabled={saving}
						className="text-sm text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] disabled:opacity-50"
					>
						Skip for now
					</button>
					<button
						onClick={() => submit(false)}
						disabled={!canSubmit || saving}
						className="rounded-md bg-[var(--color-accent)] px-6 py-2.5 font-semibold text-black hover:opacity-90 disabled:opacity-50"
					>
						{saving ? "Saving..." : "Get started"}
					</button>
				</div>
			</div>
		</div>
	);
}
