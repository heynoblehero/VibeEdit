"use client";

import { useEffect, useRef, useState } from "react";

/*
 * In-page sandbox: the visitor types a brief, hits Build, and the same
 * agent loop the real app uses plays out — plan, tool calls, mock preview.
 * No backend call. Pure client-side simulation tuned to feel like the
 * actual product: same plan card UI, same tool log, same niche style packs.
 *
 * Detection is keyword-based. Real misses still feel reasonable because the
 * default falls back to a comic palette, which is the most photogenic.
 */

type Niche =
	| "comic"
	| "anime"
	| "scifi"
	| "history"
	| "finance"
	| "sleep"
	| "scary"
	| "tech";

type NicheSpec = {
	id: Niche;
	planTitle: string;
	scenes: string[];
	music: string;
	gradient: string;
	dots?: boolean;
	headline: string;
	headlineColor: string;
	textShadow?: string;
};

const NICHES: Record<Niche, NicheSpec> = {
	comic: {
		id: "comic",
		planTitle: "COMIC FACTS",
		scenes: [
			"Title smash — chromatic split type",
			"Fact card on halftone backdrop",
			"Glass-crack reveal of fact 2",
			"Whip-pan into final card",
			'CTA — "follow for more"',
		],
		music: "energetic punchy comic",
		gradient:
			"radial-gradient(circle at 50% 30%, #ffd43b 0%, #ff2b3a 60%, #1a0608 100%)",
		dots: true,
		headline: "COMIC",
		headlineColor: "#ffe169",
		textShadow: "3px 3px 0 #ff2b3a, -3px -3px 0 #2a8cff",
	},
	anime: {
		id: "anime",
		planTitle: "ANIME FACTS",
		scenes: [
			"Speed-line opener — chromatic title",
			"Scale-pulse fact reveal",
			"Tilted kicker text",
			"Glitch beat on twist fact",
			"Final card with whoosh exit",
		],
		music: "energetic intense playful",
		gradient: "linear-gradient(135deg, #ff6ad5 0%, #c774e8 35%, #6ddff8 100%)",
		headline: "ANIME!",
		headlineColor: "#ffffff",
		textShadow: "3px 3px 0 #ff2bd1, -3px -3px 0 #2adff8",
	},
	scifi: {
		id: "scifi",
		planTitle: "[ DECLASSIFIED ]",
		scenes: [
			"Grid + scanlines fade-in",
			"Case-file number glow",
			"Document fragment scroll",
			"Voiceover cue card",
			"Cliffhanger title",
		],
		music: "mysterious tense modern",
		gradient:
			"radial-gradient(circle at 50% 40%, #00ddff30 0%, #050a18 60%, #000 100%)",
		headline: "[FILE 087]",
		headlineColor: "#00ddff",
	},
	history: {
		id: "history",
		planTitle: "Historical mystery",
		scenes: [
			"Parchment title with burn",
			"Slow ken-burns on map",
			"Quote card — solemn drone",
			"Candle flicker over fort",
			"Title held for 3 seconds",
		],
		music: "solemn mysterious calm",
		gradient:
			"radial-gradient(circle at 50% 30%, #c89b58 0%, #6e4023 50%, #1e0e05 100%)",
		headline: "ROANOKE",
		headlineColor: "#f5e0a8",
		textShadow: "1px 1px 0 #00000080",
	},
	finance: {
		id: "finance",
		planTitle: "FINANCE HOOK",
		scenes: [
			"Black-on-green title card",
			"Animated $ counter to climax",
			"Line chart drawing in",
			"Ticker tape strip",
			"Coin-clink CTA",
		],
		music: "confident modern punchy",
		gradient: "linear-gradient(180deg, #000000 0%, #001a0d 70%, #000 100%)",
		headline: "$10,000",
		headlineColor: "#00ff88",
	},
	sleep: {
		id: "sleep",
		planTitle: "Sleep-story intro",
		scenes: [
			"Indigo gradient fade-in",
			"Soft serif title",
			"Slow ken-burns on stars",
			"Fog drifts across frame",
			"Whisper-quiet cue at 0:55",
		],
		music: "calm peaceful warm",
		gradient: "linear-gradient(180deg, #1d2870 0%, #3a4a9c 50%, #d8a96c 100%)",
		headline: "calm.",
		headlineColor: "#ffeacb",
	},
	scary: {
		id: "scary",
		planTitle: "Horror hook",
		scenes: [
			"Vignette opener · low rumble",
			"Glitch on title beat",
			"Sickly-green fact card",
			"Sudden frozen frame",
			'CTA — "watch til the end"',
		],
		music: "ominous tense dark",
		gradient:
			"radial-gradient(circle at 50% 60%, #1c2230 0%, #050810 70%, #000 100%)",
		headline: "DON'T",
		headlineColor: "#7fb8a4",
	},
	tech: {
		id: "tech",
		planTitle: "TECH TUTORIAL",
		scenes: [
			"Dark UI title with terminal-green accent",
			"Code rain background",
			"Code-snippet rotator",
			"Counter ticks up to $10K",
			"Channel-name CTA",
		],
		music: "focused modern confident",
		gradient: "linear-gradient(135deg, #0a0e14 0%, #0b1a17 100%)",
		headline: "$ run",
		headlineColor: "#7cf06e",
	},
};

const EXAMPLE_PROMPTS: Array<{ label: string; prompt: string }> = [
	{
		label: "Comic facts hook",
		prompt:
			"30s vertical comic-facts Short. Red + yellow, halftone backdrop, glass-crack on the title beat.",
	},
	{
		label: "Anime Short",
		prompt:
			"25s anime facts Short. Pink + cyan, speed lines, chromatic title with scale-pulse.",
	},
	{
		label: "History mystery",
		prompt:
			"45s 16:9 history mystery intro about Roanoke. Sepia, slow ken-burns, candle flicker.",
	},
	{
		label: "Finance hook",
		prompt:
			"20s finance hook — 3 ways the rich think differently. Black + neon green, ticker tape.",
	},
	{
		label: "Sleep story",
		prompt:
			"60s 16:9 sleep-story intro about ancient stars. Indigo + amber, slow, no flashes.",
	},
	{
		label: "Scary story",
		prompt:
			"30s vertical horror hook — the thing my neighbor saw. Dark blue + sickly green, vignette.",
	},
];

type Phase =
	| "idle"
	| "thinking"
	| "plan"
	| "approved"
	| "building"
	| "preview"
	| "done";

const TOOL_NAMES = [
	"plan_composition",
	"find_stock",
	"write_file",
	"lint_composition",
	"screenshot_at_time",
];

export function HeroSandbox() {
	const [prompt, setPrompt] = useState("");
	const [phase, setPhase] = useState<Phase>("idle");
	const [shownTools, setShownTools] = useState(0);
	const [activeNiche, setActiveNiche] = useState<Niche>("comic");
	const [activeDuration, setActiveDuration] = useState(30);
	const [activeFormat, setActiveFormat] = useState<"9:16" | "16:9">("9:16");
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	function reset() {
		if (timerRef.current) clearTimeout(timerRef.current);
		setPhase("idle");
		setShownTools(0);
	}

	function build(text?: string) {
		const value = (text ?? prompt).trim();
		if (!value || phase !== "idle") return;
		setPrompt(value);
		const detected = detectNiche(value);
		setActiveNiche(detected);
		setActiveDuration(detectDuration(value));
		setActiveFormat(detectFormat(value, detected));
		setShownTools(0);
		setPhase("thinking");
	}

	// Phase machine
	useEffect(() => {
		if (phase === "idle" || phase === "done") return;
		const delays: Partial<Record<Phase, number>> = {
			thinking: 800,
			plan: 1600,
			approved: 600,
			preview: 1400,
		};
		if (phase === "building") return; // tools effect drives this
		const ms = delays[phase];
		if (!ms) return;
		const id = setTimeout(() => {
			setPhase((current) => nextPhase(current));
		}, ms);
		timerRef.current = id;
		return () => clearTimeout(id);
	}, [phase]);

	// Tool tick during building
	useEffect(() => {
		if (phase !== "building") return;
		let cancelled = false;
		const tick = (i: number) => {
			if (cancelled) return;
			setShownTools(i + 1);
			if (i + 1 < TOOL_NAMES.length) {
				timerRef.current = setTimeout(() => tick(i + 1), 520);
			} else {
				timerRef.current = setTimeout(() => {
					if (!cancelled) setPhase("preview");
				}, 600);
			}
		};
		tick(0);
		return () => {
			cancelled = true;
		};
	}, [phase]);

	const niche = NICHES[activeNiche];
	const showPlan =
		phase === "plan" ||
		phase === "approved" ||
		phase === "building" ||
		phase === "preview" ||
		phase === "done";
	const showApproved =
		phase === "approved" ||
		phase === "building" ||
		phase === "preview" ||
		phase === "done";
	const showBuild =
		phase === "building" || phase === "preview" || phase === "done";
	const showPreview = phase === "preview" || phase === "done";

	return (
		<div className="relative">
			<div className="absolute inset-0 -z-10 rounded-3xl bg-[var(--color-accent)]/15 blur-3xl" />
			<div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl">
				<div className="flex items-center gap-2 border-b border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2">
					<span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
					<span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
					<span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
					<span className="ml-3 font-mono text-[10px] text-[var(--color-fg-muted)]">
						try it · vibeedit.video / editor
					</span>
					<span className="ml-auto flex items-center gap-1.5 font-mono text-[10px] text-[var(--color-fg-muted)]">
						<span
							className={`inline-block h-1.5 w-1.5 rounded-full ${
								phase === "idle"
									? "bg-[var(--color-fg-muted)]"
									: showPreview
										? "bg-[var(--color-success)]"
										: "bg-[var(--color-accent)] animate-pulse"
							}`}
						/>
						{phase === "idle"
							? "waiting"
							: showPreview
								? "ready"
								: "working"}
					</span>
				</div>

				<div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr]">
					{/* LEFT: input + chat */}
					<div className="flex flex-col gap-3 border-b border-[var(--color-border)] bg-[var(--color-bg-2)] p-4 lg:border-b-0 lg:border-r">
						{/* Input or echoed user message */}
						{phase === "idle" ? (
							<>
								<div className="text-[10px] uppercase tracking-wider text-[var(--color-fg-muted)]">
									Tell the agent what to make
								</div>
								<textarea
									ref={textareaRef}
									value={prompt}
									onChange={(event) => setPrompt(event.target.value)}
									onKeyDown={(event) => {
										if (
											(event.key === "Enter" || event.keyCode === 13) &&
											(event.metaKey || event.ctrlKey)
										) {
											event.preventDefault();
											build();
										}
									}}
									placeholder="e.g. 30s vertical comic-facts hook with red + yellow and a glass-crack on the title"
									rows={3}
									className="w-full resize-none rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] p-2.5 text-sm outline-none focus:border-[var(--color-accent)]"
								/>
								<div className="flex flex-wrap gap-1.5">
									{EXAMPLE_PROMPTS.map((example) => (
										<button
											key={example.label}
											onClick={() => {
												setPrompt(example.prompt);
												setTimeout(() => build(example.prompt), 50);
											}}
											className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1 text-[11px] text-[var(--color-fg-muted)] hover:border-[var(--color-accent)] hover:text-[var(--color-fg)]"
										>
											{example.label}
										</button>
									))}
								</div>
								<button
									onClick={() => build()}
									disabled={!prompt.trim()}
									className="rounded-md bg-[var(--color-accent)] py-2 text-sm font-semibold text-black disabled:opacity-40"
								>
									Build it →
								</button>
								<p className="text-[10px] text-[var(--color-fg-muted)]">
									This is a live sandbox. Real account, real render, real
									MP4 → after sign-up.
								</p>
							</>
						) : (
							<>
								<div className="text-[10px] uppercase tracking-wider text-[var(--color-fg-muted)]">
									Chat with the agent
								</div>
								<UserBubble>{prompt}</UserBubble>
								{phase === "thinking" && <Thinking />}
								{showPlan && (
									<PlanCard
										niche={niche}
										duration={activeDuration}
										format={activeFormat}
									/>
								)}
								{phase === "plan" && (
									<AgentLine>
										Approve this plan and I'll build it.
									</AgentLine>
								)}
								{showApproved && <UserBubble>yes go</UserBubble>}
								{showBuild && (
									<BuildLog
										shownTools={shownTools}
										done={showPreview}
										musicMood={niche.music}
									/>
								)}
								{phase === "done" && (
									<AgentLine accent>Built it. Render?</AgentLine>
								)}
								{(phase === "done" || phase === "preview") && (
									<button
										onClick={reset}
										className="mt-1 self-start rounded-md border border-[var(--color-border)] px-3 py-1 text-[11px] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
									>
										← Try another prompt
									</button>
								)}
							</>
						)}
					</div>

					{/* RIGHT: preview */}
					<div className="bg-black p-4">
						<div className="mb-2 flex items-center justify-between text-[10px] text-[var(--color-fg-muted)]">
							<span className="flex items-center gap-1.5">
								<span
									className={`inline-block h-1.5 w-1.5 rounded-full ${
										showPreview
											? "bg-[var(--color-success)]"
											: "bg-[var(--color-fg-muted)]"
									}`}
								/>
								{showPreview ? "Playing" : "Empty"}
							</span>
							<span className="font-mono">⇧click to edit · ⌘R render</span>
						</div>
						<div className="flex items-center justify-center">
							<PreviewPane
								niche={niche}
								duration={activeDuration}
								format={activeFormat}
								visible={showPreview}
							/>
						</div>
					</div>
				</div>
			</div>

			{phase !== "idle" && (
				<div className="mt-3 flex items-center justify-center gap-3 text-[10px] text-[var(--color-fg-muted)]">
					<Dot active={phase === "thinking"} label="thinking" />
					<Dot
						active={phase === "plan" || phase === "approved"}
						label="plan"
					/>
					<Dot active={phase === "building"} label="build" />
					<Dot
						active={phase === "preview" || phase === "done"}
						label="preview"
					/>
				</div>
			)}
		</div>
	);
}

// ──── helpers ────────────────────────────────────────────────────────────

function detectNiche(text: string): Niche {
	const lower = text.toLowerCase();
	const tests: Array<[Niche, RegExp]> = [
		["comic", /\b(comic|superhero|hero|cape|villain|marvel|halftone|chromatic)\b/],
		["anime", /\b(anime|manga|shonen|weeb|ninja|speed.?lines)\b/],
		["scifi", /\b(scifi|sci-fi|declassified|alien|file|conspiracy|ufo)\b/],
		["history", /\b(history|historic|ancient|sepia|roanoke|pyramid|civilization|mystery)\b/],
		["finance", /\b(finance|money|wealth|stock|invest|rich|dollar|\$\d)\b/],
		["sleep", /\b(sleep|calm|peaceful|dream|ambient|whisper|library)\b/],
		["scary", /\b(scary|horror|creepy|dread|nightmare|haunt|basement)\b/],
		["tech", /\b(tech|code|coding|tutorial|terminal|dev|engineer|app)\b/],
	];
	for (const [id, regex] of tests) {
		if (regex.test(lower)) return id;
	}
	return "comic";
}

function detectDuration(text: string): number {
	const match = text.match(/(\d{1,3})\s*s(?:ec(?:ond)?s?)?/i);
	if (match) {
		const n = Number(match[1]);
		if (n >= 5 && n <= 900) return n;
	}
	if (/\blong-?form\b/i.test(text)) return 90;
	if (/\bshort\b/i.test(text)) return 30;
	return 30;
}

function detectFormat(text: string, niche: Niche): "9:16" | "16:9" {
	if (/\b(9:16|vertical|short|tiktok|reels)\b/i.test(text)) return "9:16";
	if (/\b(16:9|horizontal|landscape|long-?form|youtube long)\b/i.test(text)) {
		return "16:9";
	}
	if (niche === "history" || niche === "finance" || niche === "sleep" || niche === "tech") {
		return "16:9";
	}
	return "9:16";
}

function nextPhase(current: Phase): Phase {
	const order: Phase[] = [
		"idle",
		"thinking",
		"plan",
		"approved",
		"building",
		"preview",
		"done",
	];
	const index = order.indexOf(current);
	if (index === -1 || index === order.length - 1) return "done";
	return order[index + 1];
}

// ──── small UI atoms ─────────────────────────────────────────────────────

function UserBubble({ children }: { children: React.ReactNode }) {
	return (
		<div className="ml-auto max-w-[88%] rounded-lg bg-[var(--color-surface)] p-2.5 text-xs animate-[fadeIn_220ms_ease-out]">
			{children}
		</div>
	);
}

function AgentLine({
	children,
	accent,
}: {
	children: React.ReactNode;
	accent?: boolean;
}) {
	return (
		<div
			className={`max-w-[88%] rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-2.5 text-xs animate-[fadeIn_240ms_ease-out] ${
				accent ? "text-[var(--color-accent)]" : "text-[var(--color-fg)]"
			}`}
		>
			{children}
		</div>
	);
}

function Thinking() {
	return (
		<div className="max-w-[88%] rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-2.5 text-xs text-[var(--color-fg-muted)]">
			<span className="inline-flex gap-1">
				<span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--color-fg-muted)] [animation-delay:-0.3s]" />
				<span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--color-fg-muted)] [animation-delay:-0.15s]" />
				<span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--color-fg-muted)]" />
			</span>
		</div>
	);
}

function PlanCard({
	niche,
	duration,
	format,
}: {
	niche: NicheSpec;
	duration: number;
	format: "9:16" | "16:9";
}) {
	return (
		<div className="overflow-hidden rounded-lg border border-[var(--color-accent)] bg-[var(--color-bg)] text-[10px] animate-[fadeIn_280ms_ease-out]">
			<div className="flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1.5">
				<span className="rounded bg-[var(--color-accent)] px-1.5 py-0.5 font-bold text-black">
					PLAN
				</span>
				<span className="font-mono text-[var(--color-fg-muted)]">
					{format} · {duration}s · {niche.scenes.length} scenes
				</span>
			</div>
			<ol className="space-y-1 p-2 text-[var(--color-fg)]">
				{niche.scenes.map((scene, index) => (
					<li key={scene}>
						<span className="text-[var(--color-accent)]">
							#{index + 1}
						</span>{" "}
						{scene}
					</li>
				))}
			</ol>
		</div>
	);
}

function BuildLog({
	shownTools,
	done,
	musicMood,
}: {
	shownTools: number;
	done: boolean;
	musicMood: string;
}) {
	const lines = [
		`plan_composition · scenes recorded`,
		`find_stock · music mood=${musicMood}`,
		`write_file · index.html`,
		`lint_composition · 0 issues`,
		`screenshot_at_time · [0.5s, 2s, climax]`,
	];
	return (
		<div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-2)] p-2 font-mono text-[10px]">
			<div className="mb-1 flex items-center gap-1.5">
				<span
					className={
						done
							? "text-[var(--color-success)]"
							: "text-[var(--color-accent)]"
					}
				>
					{done ? "✓" : "→"}
				</span>
				<span className="text-[var(--color-fg)]">
					{done ? "Built it" : "Building"}
				</span>
				<span className="text-[var(--color-fg-muted)]">
					· {shownTools}/{TOOL_NAMES.length}
				</span>
			</div>
			<div className="ml-3 space-y-0.5 text-[var(--color-fg-muted)]">
				{lines.slice(0, shownTools).map((line) => (
					<div key={line} className="animate-[fadeIn_180ms_ease-out]">
						→ {line}
					</div>
				))}
			</div>
		</div>
	);
}

function PreviewPane({
	niche,
	duration,
	format,
	visible,
}: {
	niche: NicheSpec;
	duration: number;
	format: "9:16" | "16:9";
	visible: boolean;
}) {
	const aspect = format === "9:16" ? "aspect-[9/16]" : "aspect-video";
	const width = format === "9:16" ? "max-w-[240px]" : "max-w-[360px]";
	return (
		<div
			className={`relative ${aspect} ${width} w-full overflow-hidden rounded-md ring-1 ring-white/10 transition-opacity duration-500 ${
				visible ? "opacity-100" : "opacity-15"
			}`}
		>
			<div
				key={niche.id}
				className="absolute inset-0 animate-[fadeIn_500ms_ease-out]"
				style={{ background: niche.gradient }}
			/>
			{niche.dots && (
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
				key={`headline-${niche.id}`}
				className="absolute inset-0 flex flex-col items-center justify-center px-4 text-center animate-[fadeIn_600ms_ease-out]"
			>
				<div
					className={`font-black leading-none ${
						format === "9:16" ? "text-5xl" : "text-6xl"
					}`}
					style={{
						color: niche.headlineColor,
						textShadow: niche.textShadow,
					}}
				>
					{niche.headline}
				</div>
			</div>
			{visible && (
				<div className="absolute bottom-3 right-3 rounded bg-black/60 px-1.5 py-0.5 font-mono text-[8px] text-white">
					00:{String(Math.round(duration / 2)).padStart(2, "0")} / 00:
					{String(duration).padStart(2, "0")}
				</div>
			)}
		</div>
	);
}

function Dot({ active, label }: { active: boolean; label: string }) {
	return (
		<span className="flex items-center gap-1.5">
			<span
				className={`inline-block h-1.5 w-1.5 rounded-full transition-colors ${
					active ? "bg-[var(--color-accent)]" : "bg-[var(--color-border)]"
				}`}
			/>
			<span className={active ? "text-[var(--color-fg)]" : ""}>{label}</span>
		</span>
	);
}
