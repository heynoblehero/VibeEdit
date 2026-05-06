import { randomUUID } from "node:crypto";
import type Anthropic from "@anthropic-ai/sdk";
import { AGENT_MODEL, getAnthropic } from "@/lib/server/anthropic-client";
import type { Project } from "@/lib/scene-schema";
import {
	type DraftProject,
	DraftProjectSchema,
	materializeDraft,
} from "./draft-schema";
import { GENERATE_SYSTEM_PROMPT } from "./prompts";
import { TOOLS } from "./tools";

/**
 * State machine for one agent run.
 *
 * Phase A: single `generate` stage that asks Sonnet to emit a project
 * via the `emit_project` tool, validates the output, and resolves the
 * run with a final draft. No critic loop yet — that lands in Phase D.
 *
 * Run state lives in-memory (single-process). Subscribers attach via
 * `subscribe(runId, send)` and receive every event the runner emits.
 * Mirrors `lib/server/render-jobs.ts`'s SSE pattern so the client can
 * use the same EventSource shape.
 */

export type RunStage =
	| "queued"
	| "generating"
	| "validating"
	| "done"
	| "failed"
	| "cancelled";

export interface AgentRun {
	id: string;
	prompt: string;
	stage: RunStage;
	createdAt: number;
	updatedAt: number;
	error: string | null;
	/** Final materialized Project — only set when stage === "done". */
	finalProject: Project | null;
	/** Raw draft as the agent emitted it (debug aid; safe to ship to client). */
	draftPreview: DraftProject | null;
	subscribers: Set<(evt: string) => void>;
	/** Set on cancel so the running stage can short-circuit. */
	cancelled: boolean;
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
	if (run.stage === "done" || run.stage === "failed" || run.stage === "cancelled")
		return false;
	run.cancelled = true;
	run.stage = "cancelled";
	emit(run, { type: "stage", stage: "cancelled" });
	return true;
}

/**
 * Kick off a new run. Returns the run id immediately; the actual
 * generation happens off the request lifecycle so the POST /runs
 * route can return fast and the client subscribes to /events for
 * progress.
 */
export function startRun(input: { prompt: string }): AgentRun {
	const id = randomUUID();
	const run: AgentRun = {
		id,
		prompt: input.prompt,
		stage: "queued",
		createdAt: Date.now(),
		updatedAt: Date.now(),
		error: null,
		finalProject: null,
		draftPreview: null,
		subscribers: new Set(),
		cancelled: false,
	};
	runs.set(id, run);

	// Detach from request — fire and forget. Failures land on the run
	// object as `stage="failed"` so subscribers see the error too.
	runGenerate(run).catch((err) => {
		run.stage = "failed";
		run.error = err instanceof Error ? err.message : String(err);
		emit(run, { type: "failed", error: run.error });
	});

	return run;
}

async function runGenerate(run: AgentRun): Promise<void> {
	if (run.cancelled) return;

	run.stage = "generating";
	emit(run, { type: "stage", stage: "generating" });

	let response: Anthropic.Message;
	try {
		const client = getAnthropic();
		response = await client.messages.create({
			model: AGENT_MODEL,
			max_tokens: 4096,
			system: GENERATE_SYSTEM_PROMPT,
			tools: TOOLS,
			tool_choice: { type: "tool", name: "emit_project" },
			messages: [
				{
					role: "user",
					content: run.prompt.trim() || "Make a generic 30-second hype reel.",
				},
			],
		});
	} catch (err) {
		throw new Error(
			`Anthropic call failed: ${err instanceof Error ? err.message : String(err)}`,
		);
	}

	if (run.cancelled) return;

	const toolUse = response.content.find(
		(block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
	);
	if (!toolUse || toolUse.name !== "emit_project") {
		const textBlock = response.content.find(
			(b): b is Anthropic.TextBlock => b.type === "text",
		);
		throw new Error(
			`Model did not call emit_project. ${
				textBlock ? `Said: ${textBlock.text.slice(0, 240)}` : "(no text)"
			}`,
		);
	}

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
