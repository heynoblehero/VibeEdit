import { randomUUID } from "node:crypto";
import type Anthropic from "@anthropic-ai/sdk";
import { AGENT_MODEL, getAnthropic } from "@/lib/server/anthropic-client";
import { runRenderJobAsync } from "@/lib/server/render-jobs";
import { sampleVideo } from "@/lib/server/sample-frames";
import type { Project } from "@/lib/scene-schema";
import { type AssetSurvey, renderSurveyBlock } from "./asset-survey";
import { type Critique, critiqueDraft } from "./critic";
import {
	type DraftProject,
	DraftProjectSchema,
	materializeDraft,
} from "./draft-schema";
import { AGENT_SYSTEM_PROMPT } from "./prompts";
import { refineDraft } from "./refine";
import {
	type ClarifyQuestion,
	type UploadRequest,
	TOOLS,
} from "./tools";

/**
 * Multi-turn agentic loop + Critic-Refine outer loop.
 *
 * Phase B: model picks ask_user / request_user_upload / emit_project
 * inside a paused-resume agentic loop. Once it emits the first draft,
 * we enter Phase D's critic loop:
 *
 *   for round in 1..3:
 *     render at 540p_internal
 *     sample 12 frames + audio peaks
 *     critique
 *     if score >= 8 or round == 3: done
 *     refine → next round
 *
 * Returns the highest-scoring draft. Each attempt is preserved in
 * `attempts` so the user can pick an earlier round if they prefer.
 *
 * `skipCritique: true` short-circuits the critic loop and finishes
 * after the first emit_project — useful if the user just wants speed.
 */

const MAX_TURNS = 8;
const MAX_TOKENS_PER_CALL = 4096;
const MAX_CRITIC_ROUNDS = 3;
const SHIPPABLE_SCORE = 8;

export type RunStage =
	| "queued"
	| "thinking"
	| "awaiting_clarify"
	| "awaiting_upload"
	| "validating"
	| "critic_rendering"
	| "critic_critiquing"
	| "critic_refining"
	| "done"
	| "failed"
	| "cancelled";

interface PendingClarify {
	kind: "clarify";
	toolUseId: string;
	questions: ClarifyQuestion[];
	resolve: (answers: Record<string, string>) => void;
}

interface PendingUpload {
	kind: "upload";
	toolUseId: string;
	request: UploadRequest;
	resolve: (uploadUrl: string) => void;
}

type Pending = PendingClarify | PendingUpload;

export interface CriticAttempt {
	round: number;
	draft: DraftProject;
	project: Project;
	critique: Critique;
}

export interface AgentRun {
	id: string;
	prompt: string;
	survey: AssetSurvey | null;
	skipCritique: boolean;
	/** Server-resolved origin (e.g. https://vibevideoedit.com) used by
	 *  the critic-loop render pipeline so its preflight HEAD requests
	 *  hit the right host. */
	origin: string;
	stage: RunStage;
	createdAt: number;
	updatedAt: number;
	error: string | null;
	finalProject: Project | null;
	draftPreview: DraftProject | null;
	/** Critic loop history. Empty when skipCritique is true. */
	attempts: CriticAttempt[];
	/** Current critic round (1..MAX_CRITIC_ROUNDS). 0 when not in loop. */
	criticRound: number;
	subscribers: Set<(evt: string) => void>;
	cancelled: boolean;
	pending: Pending | null;
	messages: Anthropic.MessageParam[];
}

const runs = new Map<string, AgentRun>();

function snapshotPending(run: AgentRun) {
	if (!run.pending) return null;
	if (run.pending.kind === "clarify")
		return { kind: "clarify" as const, questions: run.pending.questions };
	return { kind: "upload" as const, request: run.pending.request };
}

function snapshot(run: AgentRun) {
	return {
		id: run.id,
		stage: run.stage,
		error: run.error,
		draft: run.draftPreview,
		finalProject: run.finalProject,
		attempts: run.attempts.map(({ round, draft, project, critique }) => ({
			round,
			draftName: draft.name,
			project,
			score: critique.score,
			summary: critique.summary,
			issueCount: critique.issues.length,
		})),
		criticRound: run.criticRound,
		updatedAt: run.updatedAt,
		pending: snapshotPending(run),
	};
}

function emit(run: AgentRun, event: Record<string, unknown>) {
	run.updatedAt = Date.now();
	const payload = `data: ${JSON.stringify(event)}\n\n`;
	for (const sub of run.subscribers) {
		try {
			sub(payload);
		} catch {
			// subscriber disconnected — ignored
		}
	}
}

export function getRun(runId: string): AgentRun | undefined {
	return runs.get(runId);
}

export function subscribe(
	runId: string,
	send: (evt: string) => void,
): () => void {
	const run = runs.get(runId);
	if (!run) {
		send(`data: ${JSON.stringify({ type: "error", error: "unknown run" })}\n\n`);
		return () => {};
	}
	send(`data: ${JSON.stringify({ type: "snapshot", ...snapshot(run) })}\n\n`);
	run.subscribers.add(send);
	return () => {
		run.subscribers.delete(send);
	};
}

export function cancelRun(runId: string): boolean {
	const run = runs.get(runId);
	if (!run) return false;
	if (
		run.stage === "done" ||
		run.stage === "failed" ||
		run.stage === "cancelled"
	)
		return false;
	run.cancelled = true;
	run.stage = "cancelled";
	if (run.pending) {
		const pending = run.pending;
		run.pending = null;
		if (pending.kind === "clarify") pending.resolve({});
		else pending.resolve("");
	}
	emit(run, { type: "stage", stage: "cancelled" });
	return true;
}

export function respondToRun(
	runId: string,
	body:
		| { kind: "clarify"; answers: Record<string, string> }
		| { kind: "upload"; uploadUrl: string },
): { ok: true } | { ok: false; error: string } {
	const run = runs.get(runId);
	if (!run) return { ok: false, error: "unknown run" };
	if (!run.pending) return { ok: false, error: "run is not paused" };
	if (run.pending.kind !== body.kind)
		return {
			ok: false,
			error: `run is awaiting ${run.pending.kind}, not ${body.kind}`,
		};

	if (run.pending.kind === "clarify" && body.kind === "clarify") {
		const resolver = run.pending.resolve;
		run.pending = null;
		resolver(body.answers ?? {});
		return { ok: true };
	}
	if (run.pending.kind === "upload" && body.kind === "upload") {
		const resolver = run.pending.resolve;
		const url = body.uploadUrl;
		if (!url || typeof url !== "string") {
			return { ok: false, error: "uploadUrl is required" };
		}
		run.pending = null;
		resolver(url);
		return { ok: true };
	}
	return { ok: false, error: "invariant: pending/body kind mismatch" };
}

export interface StartRunInput {
	prompt: string;
	survey: AssetSurvey;
	skipCritique?: boolean;
	origin: string;
}

export function startRun(input: StartRunInput): AgentRun {
	const id = randomUUID();
	const run: AgentRun = {
		id,
		prompt: input.prompt,
		survey: input.survey,
		skipCritique: input.skipCritique ?? false,
		origin: input.origin,
		stage: "queued",
		createdAt: Date.now(),
		updatedAt: Date.now(),
		error: null,
		finalProject: null,
		draftPreview: null,
		attempts: [],
		criticRound: 0,
		subscribers: new Set(),
		cancelled: false,
		pending: null,
		messages: [],
	};
	runs.set(id, run);

	runAgent(run).catch((err) => {
		run.stage = "failed";
		run.error = err instanceof Error ? err.message : String(err);
		emit(run, { type: "failed", error: run.error });
	});

	return run;
}

/**
 * Top-level: agentic loop produces the first draft, then we enter
 * the critic loop (or finalize directly if skipCritique).
 */
async function runAgent(run: AgentRun): Promise<void> {
	if (run.cancelled) return;

	const surveyBlock = run.survey ? renderSurveyBlock(run.survey) : "";
	const firstUser = [
		surveyBlock,
		"",
		"## User prompt",
		run.prompt.trim() || "Make a generic 30-second hype reel.",
	]
		.filter(Boolean)
		.join("\n");
	run.messages = [{ role: "user", content: firstUser }];

	const firstDraft = await runAgenticLoop(run);
	if (run.cancelled || !firstDraft) return;

	if (run.skipCritique) {
		finalizeRun(run, firstDraft);
		return;
	}

	await runCriticLoop(run, firstDraft);
}

/**
 * Phase B agentic loop — paused-resume with ask_user / upload until
 * the model emits a draft.
 */
async function runAgenticLoop(run: AgentRun): Promise<DraftProject | null> {
	const client = getAnthropic();

	for (let turn = 0; turn < MAX_TURNS; turn++) {
		if (run.cancelled) return null;

		run.stage = "thinking";
		emit(run, { type: "stage", stage: "thinking", turn });

		let response: Anthropic.Message;
		try {
			response = await client.messages.create({
				model: AGENT_MODEL,
				max_tokens: MAX_TOKENS_PER_CALL,
				system: AGENT_SYSTEM_PROMPT,
				tools: TOOLS,
				messages: run.messages,
			});
		} catch (err) {
			throw new Error(
				`Anthropic call failed: ${
					err instanceof Error ? err.message : String(err)
				}`,
			);
		}

		if (run.cancelled) return null;

		run.messages.push({ role: "assistant", content: response.content });

		const toolUses = response.content.filter(
			(b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
		);

		if (toolUses.length === 0) {
			if (turn === MAX_TURNS - 1) {
				const text = response.content.find(
					(b): b is Anthropic.TextBlock => b.type === "text",
				);
				throw new Error(
					`Model never called a tool. ${
						text ? `Said: ${text.text.slice(0, 240)}` : ""
					}`,
				);
			}
			run.messages.push({
				role: "user",
				content:
					"You must call exactly one of: ask_user, request_user_upload, or emit_project. Don't reply with text — call a tool.",
			});
			continue;
		}

		const toolResults: Anthropic.ToolResultBlockParam[] = [];

		for (const tu of toolUses) {
			if (run.cancelled) return null;

			if (tu.name === "emit_project") {
				return validateEmit(run, tu);
			}

			if (tu.name === "ask_user") {
				const input = tu.input as { questions?: ClarifyQuestion[] };
				const questions = (input.questions ?? []).slice(0, 4);
				if (questions.length === 0) {
					toolResults.push({
						type: "tool_result",
						tool_use_id: tu.id,
						content: "ask_user requires at least one question.",
						is_error: true,
					});
					continue;
				}
				const answers = await waitForClarify(run, tu.id, questions);
				if (run.cancelled) return null;
				toolResults.push({
					type: "tool_result",
					tool_use_id: tu.id,
					content: formatClarifyAnswers(questions, answers),
				});
				continue;
			}

			if (tu.name === "request_user_upload") {
				const input = tu.input as Partial<UploadRequest>;
				if (!input.slotId || !input.description || !input.mediaType) {
					toolResults.push({
						type: "tool_result",
						tool_use_id: tu.id,
						content:
							"request_user_upload requires slotId, description, and mediaType.",
						is_error: true,
					});
					continue;
				}
				const uploadUrl = await waitForUpload(run, tu.id, {
					slotId: input.slotId,
					description: input.description,
					mediaType: input.mediaType,
				});
				if (run.cancelled) return null;
				if (!uploadUrl) {
					toolResults.push({
						type: "tool_result",
						tool_use_id: tu.id,
						content:
							"User did not upload. Continue without this asset — pick a scene type that doesn't need it.",
					});
					continue;
				}
				toolResults.push({
					type: "tool_result",
					tool_use_id: tu.id,
					content: `User uploaded: ${uploadUrl}\n\nThis URL is now available — use it in scene background.imageUrl, background.videoUrl, or montageUrls as appropriate.`,
				});
				continue;
			}

			toolResults.push({
				type: "tool_result",
				tool_use_id: tu.id,
				content: `Unknown tool: ${tu.name}`,
				is_error: true,
			});
		}

		run.messages.push({ role: "user", content: toolResults });
	}

	throw new Error(
		`Hit ${MAX_TURNS}-turn cap without calling emit_project. Try a more concrete prompt.`,
	);
}

/**
 * Phase D outer loop — render → critique → refine.
 */
async function runCriticLoop(
	run: AgentRun,
	firstDraft: DraftProject,
): Promise<void> {
	let currentDraft: DraftProject = firstDraft;

	for (let round = 1; round <= MAX_CRITIC_ROUNDS; round++) {
		if (run.cancelled) return;

		run.criticRound = round;

		// Render the draft at low res for vision review.
		run.stage = "critic_rendering";
		emit(run, {
			type: "critic_round",
			stage: "critic_rendering",
			round,
		});

		const project = materializeDraft(currentDraft);
		let renderResult: Awaited<ReturnType<typeof runRenderJobAsync>>;
		try {
			renderResult = await runRenderJobAsync({
				project,
				characters: {},
				sfx: {},
				origin: run.origin,
				presetId: "540p_internal",
			});
		} catch (err) {
			// If round 1 renders fail, the whole pipeline fails. If a
			// later round fails, we can fall back on the previous best.
			if (run.attempts.length === 0) {
				throw new Error(
					`Critic-loop render failed (round ${round}): ${
						err instanceof Error ? err.message : String(err)
					}`,
				);
			}
			emit(run, {
				type: "critic_warning",
				message: `Round ${round} render failed; returning best previous attempt.`,
			});
			break;
		}

		if (run.cancelled) return;

		// Sample 12 frames + audio peaks for the Critic.
		run.stage = "critic_critiquing";
		emit(run, {
			type: "critic_round",
			stage: "critic_critiquing",
			round,
		});

		let critique: Critique;
		try {
			const sampled = await sampleVideo(
				renderResult.outputPath,
				renderResult.durationSec,
			);
			critique = await critiqueDraft({
				draft: currentDraft,
				frames: sampled.frames,
				audioPeaks: sampled.audioPeaks,
			});
		} catch (err) {
			// Critic failure: fall back to a default mid-score so we can
			// still surface this draft to the user.
			emit(run, {
				type: "critic_warning",
				message: `Round ${round} critique failed: ${
					err instanceof Error ? err.message : String(err)
				}. Treating as score 5.`,
			});
			critique = {
				score: 5,
				summary: "Critic unavailable for this round.",
				issues: [],
			};
		}

		if (run.cancelled) return;

		const attempt: CriticAttempt = {
			round,
			draft: currentDraft,
			project,
			critique,
		};
		run.attempts.push(attempt);
		emit(run, {
			type: "critic_score",
			round,
			score: critique.score,
			summary: critique.summary,
			issues: critique.issues,
		});

		if (critique.score >= SHIPPABLE_SCORE || round === MAX_CRITIC_ROUNDS) {
			break;
		}

		// Refine for the next round.
		run.stage = "critic_refining";
		emit(run, {
			type: "critic_round",
			stage: "critic_refining",
			round: round + 1,
		});
		try {
			currentDraft = await refineDraft({
				previous: currentDraft,
				critique,
			});
		} catch (err) {
			emit(run, {
				type: "critic_warning",
				message: `Refine failed at round ${round}: ${
					err instanceof Error ? err.message : String(err)
				}. Returning best so far.`,
			});
			break;
		}
	}

	// Pick the highest-scoring attempt as the winner.
	const winner = pickBestAttempt(run.attempts);
	if (!winner) {
		throw new Error("Critic loop produced no attempts");
	}
	finalizeWithWinner(run, winner);
}

function pickBestAttempt(attempts: CriticAttempt[]): CriticAttempt | null {
	if (attempts.length === 0) return null;
	return attempts.reduce((best, cur) =>
		cur.critique.score > best.critique.score ? cur : best,
	);
}

function finalizeWithWinner(run: AgentRun, winner: CriticAttempt): void {
	run.draftPreview = winner.draft;
	run.finalProject = winner.project;
	run.stage = "done";
	emit(run, {
		type: "done",
		stage: "done",
		draft: winner.draft,
		finalProject: winner.project,
		winningRound: winner.round,
		winningScore: winner.critique.score,
		attempts: run.attempts.map((a) => ({
			round: a.round,
			project: a.project,
			score: a.critique.score,
			summary: a.critique.summary,
		})),
	});
}

function finalizeRun(run: AgentRun, draft: DraftProject): void {
	run.draftPreview = draft;
	run.finalProject = materializeDraft(draft);
	run.stage = "done";
	emit(run, {
		type: "done",
		stage: "done",
		draft,
		finalProject: run.finalProject,
	});
}

async function waitForClarify(
	run: AgentRun,
	toolUseId: string,
	questions: ClarifyQuestion[],
): Promise<Record<string, string>> {
	run.stage = "awaiting_clarify";
	emit(run, {
		type: "clarify_request",
		stage: "awaiting_clarify",
		questions,
	});
	return new Promise((resolve) => {
		run.pending = { kind: "clarify", toolUseId, questions, resolve };
	});
}

async function waitForUpload(
	run: AgentRun,
	toolUseId: string,
	request: UploadRequest,
): Promise<string> {
	run.stage = "awaiting_upload";
	emit(run, {
		type: "upload_request",
		stage: "awaiting_upload",
		request,
	});
	return new Promise((resolve) => {
		run.pending = { kind: "upload", toolUseId, request, resolve };
	});
}

function formatClarifyAnswers(
	questions: ClarifyQuestion[],
	answers: Record<string, string>,
): string {
	const lines: string[] = ["The user answered:"];
	for (const q of questions) {
		const a = answers[q.id]?.trim();
		lines.push(`Q: ${q.prompt}`);
		lines.push(`A: ${a || "(skipped)"}`);
	}
	return lines.join("\n");
}

function validateEmit(
	run: AgentRun,
	toolUse: Anthropic.ToolUseBlock,
): DraftProject {
	run.stage = "validating";
	emit(run, { type: "stage", stage: "validating" });

	const parsed = DraftProjectSchema.safeParse(toolUse.input);
	if (!parsed.success) {
		const issues = parsed.error.issues
			.slice(0, 8)
			.map((i) => `· ${i.path.join(".") || "(root)"}: ${i.message}`)
			.join("\n");
		throw new Error(`Draft failed validation:\n${issues}`);
	}
	return parsed.data;
}
