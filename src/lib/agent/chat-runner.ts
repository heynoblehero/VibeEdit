import type Anthropic from "@anthropic-ai/sdk";
import { AGENT_MODEL, getAnthropic } from "@/lib/server/anthropic-client";
import type { Project } from "@/lib/scene-schema";
import { anthropicToolDefs, CHAT_TOOL_BY_NAME } from "./chat-tools";
import { CHAT_AGENT_SYSTEM_PROMPT } from "./chat-prompts";
import { renderProjectSummary } from "./project-summary";

/**
 * Per-turn handler for the chat agent.
 *
 * Stateless. Caller passes:
 *   - the current project snapshot (the agent's source of truth)
 *   - the prior conversation as Anthropic message blocks
 *   - the new user message
 * Yields a stream of typed events the SSE route forwards to the client.
 *
 * Multi-tool turns: if the model calls tools, we execute them server-side
 * against a working copy of the project, append a tool_result, and call
 * the model again — looping until the model stops asking for tools OR
 * we hit a hard cap. Each loop iteration emits its own assistant_text /
 * tool_use / tool_result events so the client UI streams live.
 */

const MAX_TOOL_LOOPS = 8;
const MAX_TOKENS_PER_CALL = 4096;

export type ChatEvent =
	| { type: "assistant_text_delta"; text: string }
	| { type: "assistant_text_done"; text: string }
	| {
			type: "tool_use";
			id: string;
			name: string;
			input: unknown;
	  }
	| {
			type: "tool_result";
			tool_use_id: string;
			ok: boolean;
			content: string;
	  }
	| {
			type: "project_patch";
			project: Project;
	  }
	| {
			type: "assistant_blocks";
			blocks: unknown;
	  }
	| { type: "done"; project: Project }
	| { type: "failed"; error: string };

export interface RunChatTurnInput {
	project: Project;
	priorMessages: Anthropic.MessageParam[];
	userMessage: string;
	signal?: AbortSignal;
}

/**
 * Build the message array sent to Anthropic for this turn.
 *
 * Strategy:
 *   - first user message in the turn = the project summary + the actual user prompt
 *   - prior assistant turns + their tool_results stay verbatim (already in priorMessages)
 *   - the model decides what to do
 */
function buildInitialMessages(
	priorMessages: Anthropic.MessageParam[],
	userMessage: string,
	project: Project,
): Anthropic.MessageParam[] {
	const summary = renderProjectSummary(project);
	const prefix = summary ? `${summary}\n\n---\n\n` : "";
	const newUser: Anthropic.MessageParam = {
		role: "user",
		content: `${prefix}${userMessage.trim()}`,
	};
	return [...priorMessages, newUser];
}

/**
 * Run one chat turn end-to-end. Yields events as the model thinks,
 * calls tools, and replies. Caller is responsible for forwarding events
 * to the client (typically as SSE) and persisting the conversation
 * state from the events.
 */
export async function* runChatTurn(
	input: RunChatTurnInput,
): AsyncGenerator<ChatEvent, void, void> {
	const { signal } = input;
	const client = getAnthropic();

	let workingProject = input.project;
	const messages = buildInitialMessages(
		input.priorMessages,
		input.userMessage,
		workingProject,
	);

	for (let loop = 0; loop < MAX_TOOL_LOOPS; loop++) {
		if (signal?.aborted) {
			yield { type: "failed", error: "aborted" };
			return;
		}

		// Stream the model's response. We collect the assistant content
		// blocks as they arrive so we can echo them on tool_result followup.
		const stream = client.messages.stream({
			model: AGENT_MODEL,
			max_tokens: MAX_TOKENS_PER_CALL,
			system: CHAT_AGENT_SYSTEM_PROMPT,
			tools: anthropicToolDefs(),
			messages,
		});

		const collectedBlocks: Anthropic.ContentBlock[] = [];
		let currentTextBuf = "";
		const toolUses: Anthropic.ToolUseBlock[] = [];

		try {
			for await (const event of stream) {
				if (signal?.aborted) {
					yield { type: "failed", error: "aborted" };
					return;
				}

				if (event.type === "content_block_start") {
					if (event.content_block.type === "text") {
						currentTextBuf = "";
					}
				} else if (event.type === "content_block_delta") {
					const delta = event.delta;
					if (delta.type === "text_delta") {
						currentTextBuf += delta.text;
						yield { type: "assistant_text_delta", text: delta.text };
					}
					// input_json_delta handled by stream's accumulator; we read
					// the final value on content_block_stop below.
				} else if (event.type === "content_block_stop") {
					// Pull the full block from the stream's running snapshot.
					const final = await stream.finalMessage();
					const block = final.content[event.index];
					if (block) {
						collectedBlocks[event.index] = block;
						if (block.type === "text" && currentTextBuf) {
							yield { type: "assistant_text_done", text: block.text };
							currentTextBuf = "";
						} else if (block.type === "tool_use") {
							toolUses.push(block);
							yield {
								type: "tool_use",
								id: block.id,
								name: block.name,
								input: block.input,
							};
						}
					}
				}
				// message_stop / message_delta are handled below via finalMessage.
			}
		} catch (err) {
			if (signal?.aborted) {
				yield { type: "failed", error: "aborted" };
				return;
			}
			yield {
				type: "failed",
				error: `Anthropic stream error: ${err instanceof Error ? err.message : String(err)}`,
			};
			return;
		}

		const final = await stream.finalMessage();
		// final.content is the canonical block list; use that for the
		// assistant message echo (more reliable than collectedBlocks).
		yield { type: "assistant_blocks", blocks: final.content };

		// Append the assistant turn to the message history.
		messages.push({ role: "assistant", content: final.content });

		// If the model isn't asking for tools, we're done.
		if (final.stop_reason !== "tool_use" || toolUses.length === 0) {
			yield { type: "done", project: workingProject };
			return;
		}

		// Run each tool. Tools execute serially against the working
		// project — the next tool sees the previous tool's mutations.
		const toolResults: Anthropic.ToolResultBlockParam[] = [];
		for (const tu of toolUses) {
			if (signal?.aborted) {
				yield { type: "failed", error: "aborted" };
				return;
			}
			const tool = CHAT_TOOL_BY_NAME[tu.name];
			if (!tool) {
				toolResults.push({
					type: "tool_result",
					tool_use_id: tu.id,
					content: `Unknown tool: ${tu.name}`,
					is_error: true,
				});
				yield {
					type: "tool_result",
					tool_use_id: tu.id,
					ok: false,
					content: `Unknown tool: ${tu.name}`,
				};
				continue;
			}
			try {
				const result = await tool.run(
					{ project: workingProject },
					tu.input as Record<string, unknown>,
				);
				workingProject = result.project;
				toolResults.push({
					type: "tool_result",
					tool_use_id: tu.id,
					content: result.content,
					is_error: result.isError,
				});
				yield {
					type: "tool_result",
					tool_use_id: tu.id,
					ok: !result.isError,
					content: result.content,
				};
				// Emit the new project state so the client can patch live.
				yield { type: "project_patch", project: workingProject };
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err);
				toolResults.push({
					type: "tool_result",
					tool_use_id: tu.id,
					content: `tool threw: ${msg}`,
					is_error: true,
				});
				yield {
					type: "tool_result",
					tool_use_id: tu.id,
					ok: false,
					content: `tool threw: ${msg}`,
				};
			}
		}

		// Append tool_results as a user message and loop back to the model.
		messages.push({ role: "user", content: toolResults });
	}

	yield {
		type: "failed",
		error: `hit ${MAX_TOOL_LOOPS}-tool-loop cap`,
	};
}
