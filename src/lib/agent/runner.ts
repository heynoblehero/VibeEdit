import { randomUUID } from "node:crypto";
import type Anthropic from "@anthropic-ai/sdk";
import { AGENT_MODEL, getAnthropic } from "@/lib/server/anthropic-client";
import type { Project } from "@/lib/scene-schema";
import { type AssetSurvey, renderSurveyBlock } from "./asset-survey";
import {
	type DraftProject,
	DraftProjectSchema,
	materializeDraft,
} from "./draft-schema";
import { AGENT_SYSTEM_PROMPT } from "./prompts";
import {
	type ClarifyQuestion,
	type UploadRequest,
	TOOLS,
} from "./tools";

/**
 * Multi-turn agentic loop.
 *
 * The Phase A runner was a single shot: prompt → tool call → done.
 * Phase B turns it into a loop where the model picks one of:
 *   ask_user             → run pauses; resumes when user answers
 *   request_user_upload  → run pauses; resumes when user uploads
 *   emit_project         → terminal; validate + materialize
 *
 * Pause/resume uses a Promise-resolver pattern: when the agent
 * requests user input, we register an async resolver on the run, emit
 * an SSE event, and `await` until /respond fulfils the resolver.
 *
 * Hard cap of 8 tool turns prevents infinite loops if the model
 * misuses the question loop.
 */

const MAX_TURNS = 8;
const MAX_TOKENS_PER_CALL = 4096;

export type RunStage =
	| "queued"
	| "thinking"
	| "awaiting_clarify"
	| "awaiting_upload"
	| "validating"
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

export interface AgentRun {
	id: string;
	prompt: string;
	survey: AssetSurvey | null;
	stage: RunStage;
	createdAt: number;
	updatedAt: number;
	error: string | null;
	finalProject: Project | null;
	draftPreview: DraftProject | null;
	subscribers: Set<(evt: string) => void>;
	cancelled: boolean;
	/** Currently-paused tool call awaiting user input. */
	pending: Pending | null;
	/** Conversation history accumulated across turns. */
	messages: Anthropic.MessageParam[];
}

const runs = new Map<string, AgentRun>();

function snapshot(run: AgentRun) {
	return {
		id: run.id,
		stage: run.stage,
		error: run.error,
		draft: run.draftPreview,
		finalProject: run.finalProject,
		updatedAt: run.updatedAt,
		pending:
			run.pending?.kind === "clarify"
				? { kind: "clarify", questions: run.pending.questions }
				: run.pending?.kind === "upload"
				? { kind: "upload", request: run.pending.request }
				: null,
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
	// If a pending resolver is waiting, fail it so the loop unwinds.
	if (run.pending) {
		const pending = run.pending;
		run.pending = null;
		// Reject resolver by calling with throw-equivalent: we resolve
		// with empty data and let the loop check `cancelled` before
		// continuing.
		if (pending.kind === "clarify") pending.resolve({});
		else pending.resolve("");
	}
	emit(run, { type: "stage", stage: "cancelled" });
	return true;
}

/**
 * Resume a paused run with the user's answers (clarify) or uploaded
 * URL (upload). Returns true if the resume was actually applied —
 * false when the run isn't paused or the kind doesn't match.
 */
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
}

export function startRun(input: StartRunInput): AgentRun {
	const id = randomUUID();
	const run: AgentRun = {
		id,
		prompt: input.prompt,
		survey: input.survey,
		stage: "queued",
		createdAt: Date.now(),
		updatedAt: Date.now(),
		error: null,
		finalProject: null,
		draftPreview: null,
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

async function runAgent(run: AgentRun): Promise<void> {
	if (run.cancelled) return;

	// Seed the conversation with the user prompt + asset survey so
	// every model turn has full context without re-injection.
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

	const client = getAnthropic();

	for (let turn = 0; turn < MAX_TURNS; turn++) {
		if (run.cancelled) return;

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

		if (run.cancelled) return;

		// Append the assistant turn to history regardless of how it
		// terminates — the next iteration needs it.
		run.messages.push({ role: "assistant", content: response.content });

		const toolUses = response.content.filter(
			(b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
		);

		if (toolUses.length === 0) {
			// Model produced text but no tool call. Nudge it back on
			// track once; if it still won't, fail loud.
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

		// Process tool calls. We process serially because ask_user /
		// request_user_upload pause the loop. If the model emits multiple
		// tool calls in one turn (rare but allowed), we resolve each
		// before the next iteration.
		const toolResults: Anthropic.ToolResultBlockParam[] = [];

		for (const tu of toolUses) {
			if (run.cancelled) return;

			if (tu.name === "emit_project") {
				return finalizeWithEmit(run, tu);
			}

			if (tu.name === "ask_user") {
				const input = tu.input as {
					questions?: ClarifyQuestion[];
				};
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
				if (run.cancelled) return;
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
				if (run.cancelled) return;
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

			// Unknown tool — surface as error so the model can recover.
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

function finalizeWithEmit(run: AgentRun, toolUse: Anthropic.ToolUseBlock): void {
	run.stage = "validating";
	emit(run, { type: "stage", stage: "validating" });

	const parsed = DraftProjectSchema.safeParse(toolUse.input);
	if (!parsed.success) {
		const issues = parsed.error.issues
			.slice(0, 8)
			.map((i) => `· ${i.path.join(".") || "(root)"}: ${i.message}`)
			.join("\n");
		run.stage = "failed";
		run.error = `Draft failed validation:\n${issues}`;
		emit(run, { type: "failed", error: run.error });
		return;
	}

	const draft = parsed.data;
	const project = materializeDraft(draft);
	run.draftPreview = draft;
	run.finalProject = project;
	run.stage = "done";
	emit(run, {
		type: "done",
		stage: "done",
		draft,
		finalProject: project,
	});
}
