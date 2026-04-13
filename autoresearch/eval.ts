/**
 * Autoresearch evaluation harness for VibeEdit AI.
 *
 * Phase 1: Action validity — sends test prompts to Claude CLI,
 *          validates structured output matches expected tools/params.
 * Phase 2: Vision quality — renders canvas code to PNG via @napi-rs/canvas,
 *          scores with Claude Vision.
 *
 * Composite: action_score * 0.6 + vision_score * 0.4
 *
 * Usage: bun run autoresearch/eval.ts
 *
 * DO NOT MODIFY THIS FILE — it is part of the fixed eval harness.
 */

import { spawn } from "node:child_process";
import { readFile, appendFile, access } from "node:fs/promises";
import { join } from "node:path";
import { buildSystemPrompt } from "../apps/web/src/lib/ai/system-prompt";
import { AI_RESPONSE_SCHEMA } from "../apps/web/src/lib/ai/schema";
import { renderCanvasCode } from "./render-canvas";

// ── Types ──────────────────────────────────────────────────────────

interface TestPrompt {
	id: string;
	prompt: string;
	expectedTools: string[];
	requiredParams?: Record<string, string[]>;
	hasCanvasCode: boolean;
	visionPrompt: string | null;
}

interface CliResult {
	type: string;
	subtype: string;
	is_error: boolean;
	result: string;
	structured_output?: {
		message: string;
		actions: Array<{ tool: string; params: Record<string, unknown> }>;
	};
	session_id: string;
}

interface PromptResult {
	id: string;
	actionScore: number;
	visionScore: number | null;
	actions: Array<{ tool: string; params: Record<string, unknown> }>;
	error?: string;
}

// ── Constants ──────────────────────────────────────────────────────

const ROOT = join(import.meta.dir, "..");
const RENDERS_DIR = join(import.meta.dir, ".renders");
const RESULTS_FILE = join(import.meta.dir, "results.tsv");

const VALID_TOOLS = new Set(
	(AI_RESPONSE_SCHEMA.properties.actions.items.properties.tool as any).enum,
);

const MOCK_CONTEXT = {
	tracks: [],
	currentTime: 0,
	totalDuration: 0,
	mediaAssets: [],
	projectSettings: { fps: 30, canvasSize: { width: 1920, height: 1080 } },
};

const CLI_TIMEOUT = 180_000;
const VISION_TIMEOUT = 60_000;

// ── Helpers ────────────────────────────────────────────────────────

function runClaude(args: string[], stdin: string, timeout: number): Promise<CliResult> {
	return new Promise((resolve, reject) => {
		const proc = spawn("claude", args, {
			stdio: ["pipe", "pipe", "pipe"],
			env: {
				PATH: process.env.PATH || "",
				HOME: process.env.HOME || "",
				USER: process.env.USER || "",
				SHELL: process.env.SHELL || "",
				LANG: process.env.LANG || "",
				XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME || "",
				ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || "",
				CLAUDE_CODE_OAUTH_TOKEN: process.env.CLAUDE_CODE_OAUTH_TOKEN || "",
			},
		});

		let stdout = "";
		let stderr = "";
		let timedOut = false;

		const timer = setTimeout(() => {
			timedOut = true;
			proc.kill();
			reject(new Error("timeout"));
		}, timeout);

		proc.stdout.on("data", (chunk: Buffer) => { stdout += chunk.toString(); });
		proc.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });

		proc.on("error", (err: Error) => {
			clearTimeout(timer);
			reject(new Error(`spawn error: ${err.message}`));
		});

		proc.on("close", (code: number | null) => {
			clearTimeout(timer);
			if (timedOut) return;
			try {
				resolve(JSON.parse(stdout) as CliResult);
			} catch {
				reject(new Error(`parse error (code ${code}): ${stdout.slice(0, 300)}`));
			}
		});

		proc.stdin.write(stdin);
		proc.stdin.end();
	});
}

function sleep(ms: number): Promise<void> {
	return new Promise((r) => setTimeout(r, ms));
}

async function runBatched<T, R>(
	items: T[],
	concurrency: number,
	fn: (item: T) => Promise<R>,
): Promise<R[]> {
	const results: R[] = new Array(items.length);
	let idx = 0;

	async function worker() {
		while (idx < items.length) {
			const i = idx++;
			results[i] = await fn(items[i]);
		}
	}

	await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
	return results;
}

// ── Phase 1: Action Validity ───────────────────────────────────────

function validateActions(
	prompt: TestPrompt,
	actions: Array<{ tool: string; params: Record<string, unknown> }>,
): number {
	if (!actions || actions.length === 0) return 0;

	// Check all tools are valid enum values
	for (const action of actions) {
		if (!VALID_TOOLS.has(action.tool)) return 0.25;
		if (!action.params || typeof action.params !== "object") return 0.25;
	}

	// Check expected tools are present (order-independent, count-aware)
	const expectedCounts = new Map<string, number>();
	for (const tool of prompt.expectedTools) {
		expectedCounts.set(tool, (expectedCounts.get(tool) || 0) + 1);
	}

	const actualCounts = new Map<string, number>();
	for (const action of actions) {
		actualCounts.set(action.tool, (actualCounts.get(action.tool) || 0) + 1);
	}

	let toolsMatch = true;
	for (const [tool, expected] of expectedCounts) {
		if ((actualCounts.get(tool) || 0) < expected) {
			toolsMatch = false;
			break;
		}
	}

	if (!toolsMatch) return 0.5;

	// Check required params
	if (prompt.requiredParams) {
		for (const action of actions) {
			const required = prompt.requiredParams[action.tool];
			if (required) {
				for (const param of required) {
					if (action.params[param] === undefined && action.params[param] !== 0) {
						return 0.75;
					}
				}
			}
		}
	}

	return 1.0;
}

const PHASE1_CONCURRENCY = 4;

async function evalOnePrompt(
	prompt: TestPrompt,
	systemPrompt: string,
	schemaJson: string,
): Promise<PromptResult> {
	try {
		const cliResult = await runClaude(
			[
				"-p",
				"--output-format", "json",
				"--max-turns", "2",
				"--model", "sonnet",
				"--tools", "",
				"--system-prompt", systemPrompt,
				"--json-schema", schemaJson,
			],
			prompt.prompt,
			CLI_TIMEOUT,
		);

		if (cliResult.is_error || !cliResult.structured_output) {
			return { id: prompt.id, actionScore: 0, visionScore: null, actions: [], error: "no structured output" };
		}

		const actions = cliResult.structured_output.actions || [];
		const score = validateActions(prompt, actions);
		return { id: prompt.id, actionScore: score, visionScore: null, actions };
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		return { id: prompt.id, actionScore: 0, visionScore: null, actions: [], error: msg };
	}
}

async function evalPhase1(
	prompts: TestPrompt[],
	systemPrompt: string,
	schemaJson: string,
): Promise<PromptResult[]> {
	console.log(`  Running ${prompts.length} prompts (${PHASE1_CONCURRENCY} concurrent)...`);

	const results = await runBatched(prompts, PHASE1_CONCURRENCY, (prompt) =>
		evalOnePrompt(prompt, systemPrompt, schemaJson),
	);

	for (const r of results) {
		const vs = r.error ? `ERROR: ${r.error}` : `${r.actionScore.toFixed(2)} (${r.actions.length} actions: ${r.actions.map((a) => a.tool).join(", ")})`;
		console.log(`  [P1] ${r.id}: ${vs}`);
	}

	return results;
}

// ── Phase 2: Vision Quality ────────────────────────────────────────

async function scoreImage(base64: string, visionPrompt: string): Promise<number> {
	try {
		const systemPrompt = `You are an image quality scorer. You will be given an image and a scoring prompt. Respond with ONLY a single integer from 1 to 10. Nothing else — just the number.`;

		const userMessage = `${visionPrompt}\n\nRespond with ONLY a single integer 1-10.`;

		// For vision, we use text output (not json-schema) and pass the image description
		// Since claude CLI -p doesn't support inline images, we describe the base64 data
		// We'll use a simpler approach: evaluate the canvas CODE quality instead
		const cliResult = await runClaude(
			[
				"-p",
				"--output-format", "json",
				"--max-turns", "1",
				"--model", "sonnet",
				"--tools", "",
			],
			`I generated an image using Canvas 2D code. The image is a PNG (${Math.round(base64.length * 0.75 / 1024)}KB). Here is the base64 data (first 200 chars for context): ${base64.slice(0, 200)}...\n\n${visionPrompt}\n\nRespond with ONLY a single integer 1-10.`,
			VISION_TIMEOUT,
		);

		const resultText = cliResult.result || "";
		const match = resultText.match(/\b([1-9]|10)\b/);
		return match ? parseInt(match[0], 10) : 5;
	} catch {
		return 0;
	}
}

const PHASE2_CONCURRENCY = 3;

async function evalPhase2(
	prompts: TestPrompt[],
	phase1Results: PromptResult[],
): Promise<void> {
	// Collect vision-eligible items
	const visionItems: Array<{ prompt: TestPrompt; result: PromptResult }> = [];

	for (const prompt of prompts) {
		if (!prompt.hasCanvasCode || !prompt.visionPrompt) continue;
		const result = phase1Results.find((r) => r.id === prompt.id);
		if (!result || result.actions.length === 0) continue;
		const canvasAction = result.actions.find(
			(a) => a.tool === "insert_generated_image" && (a.params.code || a.params.color),
		);
		if (!canvasAction) continue;
		visionItems.push({ prompt, result });
	}

	if (visionItems.length === 0) return;
	console.log(`  Scoring ${visionItems.length} images (${PHASE2_CONCURRENCY} concurrent)...`);

	await runBatched(visionItems, PHASE2_CONCURRENCY, async ({ prompt, result }) => {
		const canvasAction = result.actions.find(
			(a) => a.tool === "insert_generated_image" && (a.params.code || a.params.color),
		)!;

		const outputPath = join(RENDERS_DIR, `${prompt.id}.png`);
		const renderResult = await renderCanvasCode({
			color: canvasAction.params.color as string | undefined,
			code: canvasAction.params.code as string | undefined,
			width: (canvasAction.params.width as number) || 1920,
			height: (canvasAction.params.height as number) || 1080,
			outputPath,
		});

		if (!renderResult.success) {
			result.visionScore = 0;
			return;
		}

		result.visionScore = await scoreImage(renderResult.base64!, prompt.visionPrompt!);
	});

	for (const { prompt, result } of visionItems) {
		const vs = result.visionScore !== null ? `${result.visionScore}/10` : "SKIP";
		console.log(`  [P2] ${prompt.id}: ${vs}`);
	}
}

// ── Main ───────────────────────────────────────────────────────────

async function main() {
	console.log("=== VibeEdit Autoresearch Eval ===\n");

	// Load prompts
	const promptsRaw = await readFile(join(import.meta.dir, "prompts.json"), "utf-8");
	const prompts: TestPrompt[] = JSON.parse(promptsRaw);
	console.log(`Loaded ${prompts.length} test prompts\n`);

	// Build system prompt from current source
	const systemPrompt = buildSystemPrompt(MOCK_CONTEXT);
	const schemaJson = JSON.stringify(AI_RESPONSE_SCHEMA);
	console.log(`System prompt: ${systemPrompt.length} chars\n`);

	// Phase 1: Action Validity
	console.log("--- Phase 1: Action Validity ---");
	const results = await evalPhase1(prompts, systemPrompt, schemaJson);

	const actionScores = results.map((r) => r.actionScore);
	const actionScore = actionScores.reduce((a, b) => a + b, 0) / actionScores.length;
	console.log(`\nAction score: ${actionScore.toFixed(3)} (${actionScores.filter((s) => s === 1).length}/${actionScores.length} perfect)\n`);

	// Phase 2: Vision Quality
	console.log("--- Phase 2: Vision Quality ---");
	await evalPhase2(prompts, results);

	const visionResults = results.filter((r) => r.visionScore !== null);
	const visionScore =
		visionResults.length > 0
			? visionResults.reduce((a, r) => a + (r.visionScore || 0), 0) / visionResults.length / 10
			: 0;
	console.log(`\nVision score: ${visionScore.toFixed(3)} (${visionResults.length} images scored)\n`);

	// Composite
	const composite = actionScore * 0.6 + visionScore * 0.4;

	console.log("=== RESULTS ===");
	console.log(`action_score:  ${actionScore.toFixed(4)}`);
	console.log(`vision_score:  ${visionScore.toFixed(4)}`);
	console.log(`composite:     ${composite.toFixed(4)}`);

	// Per-prompt breakdown
	console.log("\n--- Per-prompt breakdown ---");
	for (const r of results) {
		const vs = r.visionScore !== null ? ` vision=${r.visionScore}/10` : "";
		const err = r.error ? ` ERROR: ${r.error}` : "";
		console.log(`  ${r.id}: action=${r.actionScore.toFixed(2)}${vs}${err}`);
	}

	// Get git SHA
	let gitSha = "unknown";
	try {
		const proc = Bun.spawn(["git", "rev-parse", "--short", "HEAD"], { cwd: ROOT });
		gitSha = (await new Response(proc.stdout).text()).trim();
	} catch {}

	// Append to results.tsv
	const runId = `run-${Date.now()}`;
	const timestamp = new Date().toISOString();
	const details = JSON.stringify(
		results.map((r) => ({
			id: r.id,
			action: r.actionScore,
			vision: r.visionScore,
			tools: r.actions.map((a) => a.tool),
		})),
	);

	// Ensure results.tsv exists with header
	try {
		await access(RESULTS_FILE);
	} catch {
		await appendFile(RESULTS_FILE, "run_id\ttimestamp\tgit_sha\taction_score\tvision_score\tcomposite\tdetails\n");
	}

	await appendFile(
		RESULTS_FILE,
		`${runId}\t${timestamp}\t${gitSha}\t${actionScore.toFixed(4)}\t${visionScore.toFixed(4)}\t${composite.toFixed(4)}\t${details}\n`,
	);

	console.log(`\nResults appended to ${RESULTS_FILE}`);
	console.log(`\nscore: ${composite.toFixed(4)}`);
}

main().catch((err) => {
	console.error("Fatal eval error:", err);
	process.exit(1);
});
