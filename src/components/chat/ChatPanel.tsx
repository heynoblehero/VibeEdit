"use client";

import { Sparkles, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import type { AgentLogEntry } from "@/lib/scene-schema";
import { useChatStore } from "@/store/chat-store";
import { useProjectStore } from "@/store/project-store";
import { ChatInput } from "./ChatInput";
import { ChatMessage } from "./ChatMessage";

/**
 * Persistent chat panel beside the desktop editor.
 *
 * Reads conversation from `project.agentLog` (single source of truth).
 * The chat-store carries only ephemeral UI state (open, streaming,
 * pendingAssistant for the in-flight reply).
 *
 * Width: 360px fixed. Toggleable via the header chat button (or the
 * close X in this panel's header).
 */
export function ChatPanel() {
	const open = useChatStore((s) => s.open);
	const closePanel = useChatStore((s) => s.closePanel);
	const pendingAssistant = useChatStore((s) => s.pendingAssistant);
	const error = useChatStore((s) => s.error);
	const clearError = useChatStore((s) => s.clearError);
	const clearHistory = useChatStore((s) => s.clearHistory);

	const agentLog = useProjectStore((s) => s.project.agentLog);

	const messages = useMemo(() => buildMessages(agentLog ?? []), [agentLog]);

	const scrollerRef = useRef<HTMLDivElement>(null);

	// Autoscroll on new messages or streaming deltas.
	useEffect(() => {
		const el = scrollerRef.current;
		if (!el) return;
		el.scrollTop = el.scrollHeight;
	}, [messages.length, pendingAssistant]);

	if (!open) return null;

	return (
		<aside
			className="hidden md:flex w-[360px] shrink-0 flex-col border-l border-neutral-800 bg-neutral-950/40"
			aria-label="AI chat panel"
		>
			<header className="shrink-0 flex items-center justify-between px-3 h-10 border-b border-neutral-800 bg-neutral-950/70 backdrop-blur">
				<div className="flex items-center gap-1.5 text-emerald-300">
					<Sparkles className="h-3.5 w-3.5" />
					<span className="text-[12px] uppercase tracking-wider font-semibold">
						AI Chat
					</span>
				</div>
				<div className="flex items-center gap-1">
					{messages.length > 0 ? (
						<button
							type="button"
							onClick={() => {
								if (
									window.confirm("Clear chat history for this project?")
								) {
									clearHistory();
								}
							}}
							className="p-1 text-neutral-500 hover:text-red-300 transition-colors"
							title="Clear chat history"
							aria-label="Clear chat history"
						>
							<Trash2 className="h-3.5 w-3.5" />
						</button>
					) : null}
					<button
						type="button"
						onClick={closePanel}
						className="p-1 text-neutral-500 hover:text-white transition-colors"
						title="Close chat"
						aria-label="Close chat"
					>
						<X className="h-3.5 w-3.5" />
					</button>
				</div>
			</header>

			<div ref={scrollerRef} className="flex-1 min-h-0 overflow-y-auto py-2">
				{messages.length === 0 && !pendingAssistant ? (
					<EmptyState />
				) : (
					<>
						{messages.map((m) => (
							<ChatMessage
								key={m.id}
								role={m.role}
								text={m.text}
								toolCalls={m.toolCalls}
							/>
						))}
						{pendingAssistant ? (
							<ChatMessage
								role="assistant"
								text={pendingAssistant.text}
								toolCalls={pendingAssistant.toolCalls}
								streaming
							/>
						) : null}
					</>
				)}
				{error ? (
					<button
						type="button"
						onClick={clearError}
						className="mx-3 my-2 block w-[calc(100%-1.5rem)] text-left rounded-md border border-red-500/30 bg-red-500/5 px-2.5 py-1.5 text-[11px] text-red-200 hover:bg-red-500/10"
					>
						{error} <span className="text-neutral-500">— click to dismiss</span>
					</button>
				) : null}
			</div>

			<ChatInput />
		</aside>
	);
}

function EmptyState() {
	return (
		<div className="flex flex-col items-center justify-center h-full px-6 text-center text-neutral-500 gap-2">
			<Sparkles className="h-5 w-5 text-emerald-400/60" />
			<p className="text-[12px] leading-relaxed">
				Ask the agent to edit your video. It can add scenes, change colors,
				replace text, and more.
			</p>
			<div className="text-[11px] text-neutral-600 mt-1">
				Try: &ldquo;Add a hook scene with the text &lsquo;Most coffee shops
				over-extract&rsquo;&rdquo;
			</div>
		</div>
	);
}

interface RenderedMessage {
	id: string;
	role: "user" | "assistant";
	text: string;
	toolCalls?: Array<{
		id: string;
		name: string;
		input: unknown;
		result?: { ok: boolean; content: string };
	}>;
}

/**
 * Group AgentLog entries into displayable messages, one per turn-role
 * pair. Tool calls + their results within a turn collapse onto the
 * assistant message that emitted them.
 */
function buildMessages(log: AgentLogEntry[]): RenderedMessage[] {
	const messages: RenderedMessage[] = [];
	const byTurn = new Map<number, AgentLogEntry[]>();
	for (const e of log) {
		const list = byTurn.get(e.turn) ?? [];
		list.push(e);
		byTurn.set(e.turn, list);
	}
	const turns = [...byTurn.keys()].sort((a, b) => a - b);
	for (const t of turns) {
		const entries = byTurn.get(t) ?? [];
		const userText = entries.find(
			(e) => e.role === "user" && e.kind === "text",
		);
		if (userText?.text) {
			messages.push({
				id: `u-${t}`,
				role: "user",
				text: userText.text,
			});
		}
		const assistantText =
			entries.find(
				(e) => e.role === "assistant" && e.kind === "assistant_blocks",
			)?.text ??
			entries.find((e) => e.role === "assistant" && e.kind === "text")?.text ??
			"";
		const toolCalls = entries
			.filter((e) => e.kind === "tool_call")
			.map((e) => {
				const result = entries.find(
					(r) => r.kind === "tool_result" && r.toolUseRef === e.toolUseId,
				);
				return {
					id: e.toolUseId ?? `${t}-${e.tool ?? "x"}`,
					name: e.tool ?? "unknown",
					input: e.toolInput,
					result: result
						? {
								ok: result.ok ?? true,
								content:
									typeof result.toolResult === "string"
										? result.toolResult
										: result.preview ?? "",
						  }
						: undefined,
				};
			});
		if (assistantText || toolCalls.length > 0) {
			messages.push({
				id: `a-${t}`,
				role: "assistant",
				text: assistantText,
				toolCalls,
			});
		}
	}
	return messages;
}
