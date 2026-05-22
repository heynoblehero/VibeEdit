#!/usr/bin/env tsx
/*
 * Agent benchmark harness.
 *
 * Runs N golden prompts through runAgent in throwaway projects under a
 * dedicated bench user, records lint outcome + tool-use counts + wall-clock,
 * and writes a JSON report + markdown summary to apps/web/bench-output/.
 *
 * Usage:
 *   bun run bench                  # all prompts
 *   bun run bench -- --filter comic
 *   bun run bench -- --max 3
 *
 * No external services required other than the same Claude Agent SDK auth
 * the running web app uses. Bench user/projects exist only on disk —
 * nothing hits the production DB.
 */

import {
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	rmSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { runAgent } from "../src/lib/ai/agent";
import { ensureProjectDir, listFiles } from "../src/lib/storage/fs";

type GoldenPrompt = {
	id: string;
	niche: string;
	format: "16:9" | "9:16";
	prompt: string;
	approvalReply: string;
};

const GOLDEN_PROMPTS: GoldenPrompt[] = [
	{
		id: "comic-hook-30s-9x16",
		niche: "comic",
		format: "9:16",
		prompt:
			"Make a 30-second 1080x1920 comic-style facts Short. Red + yellow palette, halftone backdrop, big chromatic title, one glass-crack on the title beat. Generic comic energy — no real publishers.",
		approvalReply: "yes go",
	},
	{
		id: "anime-hook-25s-9x16",
		niche: "anime",
		format: "9:16",
		prompt:
			"25s vertical anime-style facts hook about legendary ninja clans. Pink + cyan + speed lines, chromatic title, scale-pulse on every reveal.",
		approvalReply: "ship it",
	},
	{
		id: "history-intro-45s-16x9",
		niche: "history",
		format: "16:9",
		prompt:
			"45s 16:9 intro titled 'What really happened at Roanoke?'. Sepia palette, slow ken-burns, candle flicker, low brass drone. End on the title held 3 seconds.",
		approvalReply: "yes build it",
	},
	{
		id: "finance-hook-20s-9x16",
		niche: "finance",
		format: "9:16",
		prompt:
			"20s vertical finance hook: 3 ways the rich think differently about money. Black + gold + green, ticker tape strip, coin clink on each fact reveal.",
		approvalReply: "approved",
	},
	{
		id: "sleep-intro-60s-16x9",
		niche: "sleep",
		format: "16:9",
		prompt:
			"60s 16:9 intro for a sleep story about an ancient forgotten library. Indigo + soft amber, slow ambient feel, fog drifting, no quick cuts, no flashes.",
		approvalReply: "yes",
	},
	{
		id: "scary-hook-30s-9x16",
		niche: "scary",
		format: "9:16",
		prompt:
			"30s vertical horror hook — 'The thing my neighbor saw on his lawn'. Dark blue + sickly green, vignette, low rumble, glitch on title, frozen end frame.",
		approvalReply: "go",
	},
	{
		id: "tech-intro-15s-16x9",
		niche: "tech",
		format: "16:9",
		prompt:
			"15s 16:9 intro for 'How I built a $10k app in a weekend'. Dark UI, terminal-green accents, code rain bg, arrow pointing to a number ticking up to $10,000.",
		approvalReply: "build",
	},
	{
		id: "scifi-declassified-30s-9x16",
		niche: "scifi",
		format: "9:16",
		prompt:
			"30s vertical sci-fi 'declassified file' Short. Cyan-on-black, grid + scanlines, mono tags, glowing case-file number that pulses. Ominous tone.",
		approvalReply: "yes go",
	},
	{
		id: "history-longform-360s-16x9",
		niche: "history",
		format: "16:9",
		prompt:
			"6-minute (360s) 16:9 long-form intro+chapters for a video titled 'The mystery of the lost civilization'. Sepia + deep gold palette, serif type, slow ken-burns on parchment textures, 4-5 chapter title cards with held silence between them. No flashes. End with the next-chapter hook.",
		approvalReply: "ship it",
	},
];

type BenchOutcome = {
	id: string;
	niche: string;
	format: "16:9" | "9:16";
	model: string;
	wallClockMs: number;
	planEmitted: boolean;
	writeFileCount: number;
	lintCalled: boolean;
	lintIssuesText: string | null;
	screenshotCalled: boolean;
	toolErrors: number;
	finalIndexBytes: number | null;
	notes: string[];
	turns: number;
	failedWith?: string;
	// User-facing text the agent produced (excludes tool I/O). Word count is
	// the terseness signal — target ≤80 words/turn averaged across the bench.
	assistantWords: number;
};

async function main() {
	const args = process.argv.slice(2);
	const filterFlag = args.indexOf("--filter");
	const filter = filterFlag !== -1 ? args[filterFlag + 1] : null;
	const maxFlag = args.indexOf("--max");
	const max = maxFlag !== -1 ? Number(args[maxFlag + 1]) : Infinity;
	const ciMode = args.includes("--ci");
	const minWinRate = Number(
		args[args.indexOf("--min-win-rate") + 1] || (ciMode ? "0.7" : "0"),
	);

	const prompts = GOLDEN_PROMPTS.filter(
		(p) => !filter || p.id.includes(filter) || p.niche.includes(filter),
	).slice(0, max);
	if (!prompts.length) {
		console.error(`× no prompts match filter '${filter}'`);
		process.exit(2);
	}

	const benchRoot = resolve(process.cwd(), "bench-output");
	mkdirSync(benchRoot, { recursive: true });
	const stamp = new Date().toISOString().replace(/[:.]/g, "-");
	const reportDir = join(benchRoot, stamp);
	mkdirSync(reportDir, { recursive: true });

	const outcomes: BenchOutcome[] = [];
	let i = 0;
	for (const prompt of prompts) {
		i += 1;
		console.log(`\n[${i}/${prompts.length}] ${prompt.id}`);
		const outcome = await runOne(prompt);
		outcomes.push(outcome);
		console.log(
			`  → ${outcome.failedWith ? "FAILED " + outcome.failedWith : "OK"} · ${outcome.wallClockMs}ms · plan=${outcome.planEmitted} writes=${outcome.writeFileCount} lint=${outcome.lintCalled} screenshot=${outcome.screenshotCalled} bytes=${outcome.finalIndexBytes ?? "—"}`,
		);
	}

	const previous = loadPrevious(benchRoot, reportDir);
	writeFileSync(
		join(reportDir, "report.json"),
		JSON.stringify({ stamp, outcomes }, null, 2),
	);
	writeFileSync(
		join(reportDir, "summary.md"),
		renderSummary(stamp, outcomes, previous),
	);
	const winRate = computeWinRate(outcomes);
	console.log(
		`\nReport written to ${reportDir}/ — win-rate ${(winRate * 100).toFixed(0)}% (${outcomes.filter(isWin).length}/${outcomes.length})`,
	);

	if (ciMode && winRate < minWinRate) {
		console.error(
			`× CI mode: win-rate ${winRate.toFixed(2)} below threshold ${minWinRate}`,
		);
		process.exit(2);
	}
}

function summarizeInput(input: Record<string, unknown>): string {
	const entries = Object.entries(input);
	if (!entries.length) return "";
	return entries
		.map(([key, value]) => {
			let serialized: string;
			if (typeof value === "string") serialized = value;
			else if (Array.isArray(value)) {
				serialized = `[${value.length} items]`;
			} else if (value && typeof value === "object") {
				serialized = JSON.stringify(value).slice(0, 200);
			} else {
				serialized = String(value);
			}
			return `${key}=${serialized.length > 200 ? serialized.slice(0, 200) + "…" : serialized}`;
		})
		.join(", ");
}

function isWin(outcome: BenchOutcome): boolean {
	return (
		!outcome.failedWith &&
		outcome.planEmitted &&
		outcome.writeFileCount > 0 &&
		outcome.lintCalled &&
		outcome.screenshotCalled
	);
}

function computeWinRate(outcomes: BenchOutcome[]): number {
	if (!outcomes.length) return 0;
	return outcomes.filter(isWin).length / outcomes.length;
}

function loadPrevious(
	benchRoot: string,
	currentDir: string,
): BenchOutcome[] | null {
	if (!existsSync(benchRoot)) return null;
	const entries = readdirSync(benchRoot)
		.filter((name) => join(benchRoot, name) !== currentDir)
		.map((name) => ({ name, path: join(benchRoot, name) }))
		.filter((entry) => existsSync(join(entry.path, "report.json")))
		.sort((a, b) => b.name.localeCompare(a.name));
	if (!entries.length) return null;
	try {
		const parsed = JSON.parse(
			readFileSync(join(entries[0].path, "report.json"), "utf8"),
		) as { outcomes?: BenchOutcome[] };
		return parsed.outcomes || null;
	} catch {
		return null;
	}
}

async function runOne(prompt: GoldenPrompt): Promise<BenchOutcome> {
	const userId = "__bench__";
	const projectId = `bench-${prompt.id}-${Date.now()}`;
	const dir = ensureProjectDir(userId, projectId);

	const outcome: BenchOutcome = {
		id: prompt.id,
		niche: prompt.niche,
		format: prompt.format,
		model: "",
		wallClockMs: 0,
		planEmitted: false,
		writeFileCount: 0,
		lintCalled: false,
		lintIssuesText: null,
		screenshotCalled: false,
		toolErrors: 0,
		finalIndexBytes: null,
		notes: [],
		turns: 0,
		assistantWords: 0,
	};

	const enqueueRender = async () => "bench-render-skipped";
	const ctx = { userId, projectId, enqueueRender };

	const started = Date.now();
	// Capture Turn 1's transcript so Turn 2 sees the actual plan the agent
	// emitted. Without this the agent often refuses to build because the
	// "yes go" arrives with no context.
	const turn1Transcript: string[] = [];
	try {
		outcome.turns += 1;
		await runAgent({
			userMessage: prompt.prompt,
			ctx,
			onEvent: (event) => {
				observe(event, outcome);
				if (event.type === "text") {
					turn1Transcript.push(`assistant: ${event.text}`);
				} else if (event.type === "tool_use") {
					turn1Transcript.push(
						`assistant tool: ${event.name}(${summarizeInput(event.input)})`,
					);
				}
			},
		});

		// Turn 2: approval message. Agent sees the actual prior plan now.
		outcome.turns += 1;
		const priorHistory = [
			`user: ${prompt.prompt}`,
			...turn1Transcript,
		].join("\n");
		await runAgent({
			userMessage: prompt.approvalReply,
			priorHistory,
			ctx,
			onEvent: (event) => observe(event, outcome),
		});

		const files = listFiles(userId, projectId);
		if (files.includes("index.html")) {
			const path = join(dir, "index.html");
			outcome.finalIndexBytes = existsSync(path) ? statSync(path).size : 0;
		}
	} catch (error) {
		outcome.failedWith = (error as Error).message.slice(0, 240);
	} finally {
		outcome.wallClockMs = Date.now() - started;
		// Clean up the bench project dir so disk doesn't bloat across runs.
		try {
			rmSync(dir, { recursive: true, force: true });
		} catch {
			/* */
		}
	}

	return outcome;
}

type AgentEvent = Parameters<
	NonNullable<Parameters<typeof runAgent>[0]["onEvent"]>
>[0];

function observe(event: AgentEvent, outcome: BenchOutcome) {
	if (event.type === "text") {
		const words = event.text.split(/\s+/).filter(Boolean).length;
		outcome.assistantWords += words;
	} else if (event.type === "tool_use") {
		switch (event.name) {
			case "plan_composition":
				outcome.planEmitted = true;
				break;
			case "write_file":
				outcome.writeFileCount += 1;
				break;
			case "lint_composition":
				outcome.lintCalled = true;
				break;
			case "screenshot_at_time":
				outcome.screenshotCalled = true;
				break;
		}
	} else if (event.type === "tool_result") {
		const text = event.result || "";
		if (/^ERROR/.test(text)) outcome.toolErrors += 1;
		if (text.includes("issues") || /^(warn|error)\b/m.test(text)) {
			outcome.lintIssuesText = text.slice(0, 600);
		}
	} else if (event.type === "error") {
		outcome.notes.push(`stream error: ${event.message.slice(0, 160)}`);
	}
}

function renderSummary(
	stamp: string,
	outcomes: BenchOutcome[],
	previous: BenchOutcome[] | null,
): string {
	const planned = outcomes.filter((o) => o.planEmitted).length;
	const wrote = outcomes.filter((o) => o.writeFileCount > 0).length;
	const linted = outcomes.filter((o) => o.lintCalled).length;
	const looked = outcomes.filter((o) => o.screenshotCalled).length;
	const failed = outcomes.filter((o) => o.failedWith).length;
	const avgMs = Math.round(
		outcomes.reduce((sum, o) => sum + o.wallClockMs, 0) /
			Math.max(1, outcomes.length),
	);
	const avgWords = Math.round(
		outcomes.reduce((sum, o) => sum + o.assistantWords, 0) /
			Math.max(1, outcomes.length * Math.max(1, outcomes[0]?.turns ?? 2)),
	);
	const winRate = computeWinRate(outcomes);
	const prevWinRate = previous ? computeWinRate(previous) : null;
	const winRateDelta =
		prevWinRate !== null
			? `${(winRate * 100).toFixed(0)}% (Δ ${signed(((winRate - prevWinRate) * 100).toFixed(0))}pp vs prev)`
			: `${(winRate * 100).toFixed(0)}%`;

	const niches = new Map<string, BenchOutcome[]>();
	for (const o of outcomes) {
		if (!niches.has(o.niche)) niches.set(o.niche, []);
		niches.get(o.niche)!.push(o);
	}
	const nicheRows = [...niches.entries()]
		.sort((a, b) => a[0].localeCompare(b[0]))
		.map(([niche, list]) => {
			const rate = computeWinRate(list);
			const previousList = previous?.filter((o) => o.niche === niche) || [];
			const prevRate = previousList.length ? computeWinRate(previousList) : null;
			const delta =
				prevRate !== null
					? ` (Δ ${signed(((rate - prevRate) * 100).toFixed(0))}pp)`
					: "";
			return `| ${niche} | ${list.filter(isWin).length}/${list.length} | ${(rate * 100).toFixed(0)}%${delta} |`;
		})
		.join("\n");

	const rows = outcomes
		.map((o) => {
			const status = o.failedWith
				? "FAIL"
				: isWin(o)
					? "OK"
					: "WARN";
			return `| ${status} | ${o.id} | ${o.format} | ${o.planEmitted ? "✓" : "·"} | ${o.writeFileCount} | ${o.lintCalled ? "✓" : "·"} | ${o.screenshotCalled ? "✓" : "·"} | ${o.toolErrors} | ${o.finalIndexBytes ?? "—"} | ${o.wallClockMs}ms |`;
		})
		.join("\n");

	return `# Agent bench — ${stamp}

**Win-rate:** ${winRateDelta}
**Runs:** ${outcomes.length}
**Planned:** ${planned}/${outcomes.length}
**Wrote index.html:** ${wrote}/${outcomes.length}
**Linted:** ${linted}/${outcomes.length}
**Self-screenshotted:** ${looked}/${outcomes.length}
**Failed:** ${failed}
**Avg wall-clock:** ${avgMs}ms
**Avg user-facing words/turn:** ${avgWords} (target ≤80)

## Per niche

| niche | wins | win-rate |
|---|---|---|
${nicheRows || "| (no data) | — | — |"}

## Per run

| status | id | format | plan | writes | lint | screenshot | tool errs | bytes | wall |
|---|---|---|---|---|---|---|---|---|---|
${rows}
`;
}

function signed(value: string): string {
	if (value.startsWith("-")) return value;
	return value === "0" ? "0" : `+${value}`;
}

main().catch((error) => {
	console.error("bench error:", error);
	process.exit(1);
});
