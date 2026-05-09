"use client";

import { ToolCallCard } from "./ToolCallCard";

interface ToolCall {
	id: string;
	name: string;
	input: unknown;
	result?: { ok: boolean; content: string };
}

interface MessageProps {
	role: "user" | "assistant";
	text: string;
	toolCalls?: ToolCall[];
	streaming?: boolean;
}

/**
 * Render one message in the chat.
 *
 * - User: right-side bubble, accent background.
 * - Assistant: left-aligned plain text (so streaming reads naturally),
 *   tool calls listed below the text as collapsible cards.
 */
export function ChatMessage({ role, text, toolCalls, streaming }: MessageProps) {
	if (role === "user") {
		return (
			<div className="flex justify-end px-3 py-1.5">
				<div className="max-w-[80%] rounded-lg bg-emerald-500/15 text-emerald-50 px-3 py-1.5 text-[13px] whitespace-pre-wrap break-words">
					{text}
				</div>
			</div>
		);
	}

	return (
		<div className="px-3 py-2 space-y-1.5">
			{text || streaming ? (
				<div className="text-[13px] text-neutral-100 leading-relaxed whitespace-pre-wrap break-words">
					{text}
					{streaming ? (
						<span className="inline-block ml-0.5 w-1.5 h-3.5 align-middle bg-emerald-400/70 animate-pulse" />
					) : null}
				</div>
			) : null}
			{toolCalls && toolCalls.length > 0 ? (
				<div className="space-y-1">
					{toolCalls.map((tc) => (
						<ToolCallCard key={tc.id} call={tc} />
					))}
				</div>
			) : null}
		</div>
	);
}
