"use client";

import type Anthropic from "@anthropic-ai/sdk";
import { create } from "zustand";
import type { AgentLogEntry, Project } from "@/lib/scene-schema";
import { useProjectStore } from "@/store/project-store";

/**
 * Client-side chat store.
 *
 * Holds:
 *   - panel UI state (open, streaming, current draft input)
 *   - the in-flight assistant message buffer (so streaming text can
 *     update before being persisted)
 *   - an AbortController for the active SSE turn
 *
 * Persisted chat history lives on `project.agentLog` (synced via the
 * project-store's localStorage). We DON'T persist a parallel copy here
 * — single source of truth, no drift.
 */

export interface UiMessage {
	id: string;
	role: "user" | "assistant";
	/** Visible text — for assistant messages this is the streamed/final text. */
	text: string;
	/** Tool invocations attached to this assistant message. */
	toolCalls?: Array<{
		id: string;
		name: string;
		input: unknown;
		result?: { ok: boolean; content: string };
	}>;
	/** True for an assistant message that's still streaming. */
	streaming?: boolean;
}

interface ChatStoreState {
	open: boolean;
	streaming: boolean;
	draft: string;
	/** Live preview of the assistant's reply during streaming. Replaced
	 *  with the finalized message in agentLog at turn end. */
	pendingAssistant: UiMessage | null;
	/** Last error surfaced to the chat (cleared on next send). */
	error: string | null;

	openPanel: () => void;
	closePanel: () => void;
	togglePanel: () => void;
	setDraft: (s: string) => void;

	send: (text: string) => Promise<void>;
	stop: () => void;
	clearError: () => void;
	clearHistory: () => void;
}

let activeAbort: AbortController | null = null;

function cancelActive() {
	if (activeAbort) {
		activeAbort.abort();
		activeAbort = null;
	}
}

const STORAGE_KEY = "vibeedit-chat-open";

function readPersistedOpen(): boolean {
	if (typeof window === "undefined") return false;
	try {
		return window.localStorage.getItem(STORAGE_KEY) === "1";
	} catch {
		return false;
	}
}

function writePersistedOpen(open: boolean): void {
	if (typeof window === "undefined") return;
	try {
		window.localStorage.setItem(STORAGE_KEY, open ? "1" : "0");
	} catch {
		// non-fatal
	}
}

export const useChatStore = create<ChatStoreState>((set, get) => ({
	open: readPersistedOpen(),
	streaming: false,
	draft: "",
	pendingAssistant: null,
	error: null,

	openPanel: () => {
		writePersistedOpen(true);
		set({ open: true });
	},
	closePanel: () => {
		writePersistedOpen(false);
		set({ open: false });
	},
	togglePanel: () => {
		const next = !get().open;
		writePersistedOpen(next);
		set({ open: next });
	},
	setDraft: (s) => set({ draft: s }),
	clearError: () => set({ error: null }),

	clearHistory: () => {
		const projectStore = useProjectStore.getState();
		projectStore.setProject({ ...projectStore.project, agentLog: [] });
		set({ pendingAssistant: null, error: null });
	},

	stop: () => {
		cancelActive();
		set({ streaming: false, pendingAssistant: null });
	},

	send: async (text) => {
		const trimmed = text.trim();
		if (!trimmed) return;
		if (get().streaming) return;

		cancelActive();
		const abort = new AbortController();
		activeAbort = abort;

		const projectStore = useProjectStore.getState();
		const startProject = projectStore.project;
		const log = startProject.agentLog ?? [];
		const turnNumber =
			(log.length > 0 ? Math.max(...log.map((e) => e.turn)) : 0) + 1;

		// Append the user message to the project log first so it
		// renders immediately.
		const userEntry: AgentLogEntry = {
			ts: Date.now(),
			turn: turnNumber,
			role: "user",
			kind: "text",
			text: trimmed,
		};
		projectStore.setProject({
			...startProject,
			agentLog: [...log, userEntry],
		});

		set({
			streaming: true,
			draft: "",
			error: null,
			pendingAssistant: {
				id: `pending-${turnNumber}`,
				role: "assistant",
				text: "",
				toolCalls: [],
				streaming: true,
			},
		});

		// Build prior message list from the existing agentLog (BEFORE
		// adding the new user entry). This is what Anthropic sees as
		// the conversation history.
		const priorMessages = agentLogToMessages(log);

		// Build the project snapshot WITHOUT the agentLog (saves
		// payload size on every turn — log is purely client-side).
		const projectSnapshot: Project = {
			...startProject,
			agentLog: undefined,
		};

		let response: Response;
		try {
			response = await fetch("/api/chat/turn", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					project: projectSnapshot,
					priorMessages,
					userMessage: trimmed,
				}),
				signal: abort.signal,
			});
		} catch (err) {
			if (abort.signal.aborted) {
				set({ streaming: false, pendingAssistant: null });
				return;
			}
			set({
				streaming: false,
				pendingAssistant: null,
				error: err instanceof Error ? err.message : String(err),
			});
			return;
		}

		if (!response.ok || !response.body) {
			set({
				streaming: false,
				pendingAssistant: null,
				error: `chat turn failed: HTTP ${response.status}`,
			});
			return;
		}

		const reader = response.body.getReader();
		const decoder = new TextDecoder();
		let buffer = "";

		const finalLogEntries: AgentLogEntry[] = [];
		let assistantText = "";
		const toolUses: Array<{ id: string; name: string; input: unknown }> = [];
		const toolResults: Record<string, { ok: boolean; content: string }> = {};
		let assistantBlocks: unknown = null;
		let lastProject: Project | null = null;

		try {
			while (true) {
				const { value, done } = await reader.read();
				if (done) break;
				buffer += decoder.decode(value, { stream: true });

				// Split on SSE record separators.
				const records = buffer.split("\n\n");
				buffer = records.pop() ?? "";
				for (const record of records) {
					const line = record.trim();
					if (!line.startsWith("data:")) continue;
					const json = line.slice(5).trim();
					if (!json) continue;
					let evt: Record<string, unknown>;
					try {
						evt = JSON.parse(json);
					} catch {
						continue;
					}
					handleEvent(evt);
				}
			}
		} catch (err) {
			if (abort.signal.aborted) {
				set({ streaming: false, pendingAssistant: null });
				return;
			}
			set({
				streaming: false,
				pendingAssistant: null,
				error: err instanceof Error ? err.message : String(err),
			});
			return;
		}

		function handleEvent(evt: Record<string, unknown>): void {
			switch (evt.type) {
				case "assistant_text_delta": {
					const delta = String(evt.text ?? "");
					assistantText += delta;
					set((state) => ({
						pendingAssistant: state.pendingAssistant
							? { ...state.pendingAssistant, text: assistantText }
							: state.pendingAssistant,
					}));
					break;
				}
				case "assistant_text_done": {
					assistantText = String(evt.text ?? assistantText);
					set((state) => ({
						pendingAssistant: state.pendingAssistant
							? { ...state.pendingAssistant, text: assistantText }
							: state.pendingAssistant,
					}));
					break;
				}
				case "tool_use": {
					const id = String(evt.id ?? "");
					const name = String(evt.name ?? "");
					const input = evt.input;
					toolUses.push({ id, name, input });
					set((state) => ({
						pendingAssistant: state.pendingAssistant
							? {
									...state.pendingAssistant,
									toolCalls: [
										...(state.pendingAssistant.toolCalls ?? []),
										{ id, name, input },
									],
							  }
							: state.pendingAssistant,
					}));
					break;
				}
				case "tool_result": {
					const id = String(evt.tool_use_id ?? "");
					const ok = Boolean(evt.ok);
					const content = String(evt.content ?? "");
					toolResults[id] = { ok, content };
					set((state) => ({
						pendingAssistant: state.pendingAssistant
							? {
									...state.pendingAssistant,
									toolCalls: state.pendingAssistant.toolCalls?.map((tc) =>
										tc.id === id ? { ...tc, result: { ok, content } } : tc,
									),
							  }
							: state.pendingAssistant,
					}));
					break;
				}
				case "project_patch": {
					const project = evt.project as Project | undefined;
					if (project) {
						lastProject = project;
						// Preserve the agentLog from the current store —
						// the server stripped it out, we layer the latest
						// user entry + (later) assistant entries on top.
						const cur = useProjectStore.getState().project;
						useProjectStore.getState().setProject({
							...project,
							agentLog: cur.agentLog,
						});
					}
					break;
				}
				case "assistant_blocks": {
					assistantBlocks = evt.blocks;
					break;
				}
				case "done": {
					// Nothing extra here; we'll finalize after the loop ends.
					break;
				}
				case "failed": {
					set({
						error: String(evt.error ?? "agent failed"),
					});
					break;
				}
			}
		}

		// Finalize: build assistant_blocks log entry + tool_call/tool_result
		// entries in order, append to the project log.
		const ts = Date.now();
		if (assistantBlocks) {
			finalLogEntries.push({
				ts,
				turn: turnNumber,
				role: "assistant",
				kind: "assistant_blocks",
				text: assistantText,
				blocks: assistantBlocks,
			});
		} else if (assistantText) {
			finalLogEntries.push({
				ts,
				turn: turnNumber,
				role: "assistant",
				kind: "text",
				text: assistantText,
			});
		}
		for (const tu of toolUses) {
			finalLogEntries.push({
				ts,
				turn: turnNumber,
				role: "assistant",
				kind: "tool_call",
				tool: tu.name,
				toolUseId: tu.id,
				toolInput: tu.input,
			});
			const result = toolResults[tu.id];
			if (result) {
				finalLogEntries.push({
					ts,
					turn: turnNumber,
					role: "user",
					kind: "tool_result",
					toolUseRef: tu.id,
					ok: result.ok,
					preview: result.content.slice(0, 240),
					toolResult: result.content,
				});
			}
		}

		// Layer the finalized entries on top of the latest project
		// (which may have been patched by tool calls).
		const cur = useProjectStore.getState().project;
		const cappedLog = capLog([...(cur.agentLog ?? []), ...finalLogEntries]);
		useProjectStore.getState().setProject({
			...cur,
			agentLog: cappedLog,
		});

		// Use the last patched project if we got one — otherwise the store
		// already has the up-to-date version from the last patch.
		void lastProject;

		set({ streaming: false, pendingAssistant: null });
		activeAbort = null;
	},
}));

/**
 * Cap the persisted log so localStorage doesn't blow up over time.
 * Keep the most recent 30 turns.
 */
const MAX_TURNS_PERSISTED = 30;
function capLog(entries: AgentLogEntry[]): AgentLogEntry[] {
	if (entries.length === 0) return entries;
	const turns = new Set<number>();
	for (const e of entries) turns.add(e.turn);
	if (turns.size <= MAX_TURNS_PERSISTED) return entries;
	const sortedTurns = [...turns].sort((a, b) => a - b);
	const cutoffTurn = sortedTurns[sortedTurns.length - MAX_TURNS_PERSISTED];
	return entries.filter((e) => e.turn >= cutoffTurn);
}

/**
 * Reconstruct the Anthropic message history from a project's agentLog.
 *
 * Per turn:
 *   - "text" (role=user) → { role: "user", content: text }
 *   - "assistant_blocks" → { role: "assistant", content: blocks }
 *   - "tool_result" entries within a turn → grouped into one
 *     { role: "user", content: [{type:"tool_result"}, ...] }
 *
 * Returns the messages in canonical order. Stops at the latest fully-
 * completed turn (no in-flight pending state).
 */
function agentLogToMessages(
	log: AgentLogEntry[],
): Anthropic.MessageParam[] {
	const messages: Anthropic.MessageParam[] = [];
	const byTurn = new Map<number, AgentLogEntry[]>();
	for (const e of log) {
		const list = byTurn.get(e.turn) ?? [];
		list.push(e);
		byTurn.set(e.turn, list);
	}
	const turns = [...byTurn.keys()].sort((a, b) => a - b);
	for (const t of turns) {
		const entries = byTurn.get(t) ?? [];

		// User text first.
		const userText = entries.find(
			(e) => e.role === "user" && e.kind === "text",
		);
		if (userText?.text) {
			messages.push({ role: "user", content: userText.text });
		}

		// Assistant blocks (reuses the original block list verbatim — this
		// is the canonical shape Anthropic expects, including any tool_use
		// blocks the next user-message tool_results respond to).
		const asBlocks = entries.find(
			(e) => e.role === "assistant" && e.kind === "assistant_blocks",
		);
		if (asBlocks?.blocks) {
			messages.push({
				role: "assistant",
				content: asBlocks.blocks as Anthropic.ContentBlock[],
			});
		} else {
			const asText = entries.find(
				(e) => e.role === "assistant" && e.kind === "text",
			);
			if (asText?.text) {
				messages.push({ role: "assistant", content: asText.text });
			}
		}

		// Tool results, in order — packed into one user message of
		// tool_result blocks (Anthropic requires this batching).
		const results = entries
			.filter((e) => e.kind === "tool_result")
			.map(
				(e): Anthropic.ToolResultBlockParam => ({
					type: "tool_result",
					tool_use_id: e.toolUseRef ?? "",
					content: typeof e.toolResult === "string" ? e.toolResult : (e.preview ?? ""),
					is_error: e.ok === false,
				}),
			);
		if (results.length > 0) {
			messages.push({ role: "user", content: results });
		}
	}
	return messages;
}
