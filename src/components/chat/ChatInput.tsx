"use client";

import { Send, Square } from "lucide-react";
import { useCallback, useRef } from "react";
import { useChatStore } from "@/store/chat-store";

const MAX_CHARS = 4000;

/**
 * Bottom-of-panel chat input. Auto-grows up to ~6 rows. Enter sends;
 * Shift+Enter inserts a newline. While streaming, the send icon swaps
 * to a Stop button that aborts the active turn.
 */
export function ChatInput() {
	const draft = useChatStore((s) => s.draft);
	const setDraft = useChatStore((s) => s.setDraft);
	const send = useChatStore((s) => s.send);
	const stop = useChatStore((s) => s.stop);
	const streaming = useChatStore((s) => s.streaming);

	const taRef = useRef<HTMLTextAreaElement>(null);

	const onSend = useCallback(() => {
		const text = draft.trim();
		if (!text || streaming) return;
		void send(text);
	}, [draft, send, streaming]);

	const onKeyDown = useCallback(
		(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
			if (e.key === "Enter" && !e.shiftKey) {
				e.preventDefault();
				onSend();
			}
		},
		[onSend],
	);

	const onChange = useCallback(
		(e: React.ChangeEvent<HTMLTextAreaElement>) => {
			const v = e.target.value.slice(0, MAX_CHARS);
			setDraft(v);
			// Auto-grow.
			const ta = e.currentTarget;
			ta.style.height = "auto";
			ta.style.height = `${Math.min(160, ta.scrollHeight)}px`;
		},
		[setDraft],
	);

	return (
		<div className="border-t border-neutral-800 bg-neutral-950/60 p-2">
			<div className="flex items-end gap-2 rounded-lg bg-neutral-900 border border-neutral-800 focus-within:border-emerald-500/40 transition-colors p-1.5">
				<textarea
					ref={taRef}
					value={draft}
					onChange={onChange}
					onKeyDown={onKeyDown}
					placeholder={
						streaming
							? "Agent is working — Stop to take over"
							: "Tell the agent what to do…"
					}
					rows={1}
					disabled={streaming}
					className="flex-1 bg-transparent resize-none outline-none text-[13px] text-neutral-100 placeholder-neutral-600 px-1.5 py-1 max-h-40"
				/>
				{streaming ? (
					<button
						type="button"
						onClick={stop}
						className="shrink-0 h-8 w-8 flex items-center justify-center rounded-md bg-red-500/20 hover:bg-red-500/30 text-red-200"
						title="Stop"
						aria-label="Stop agent"
					>
						<Square className="h-3.5 w-3.5 fill-current" />
					</button>
				) : (
					<button
						type="button"
						onClick={onSend}
						disabled={!draft.trim()}
						className="shrink-0 h-8 w-8 flex items-center justify-center rounded-md bg-emerald-500 hover:bg-emerald-400 disabled:opacity-30 disabled:bg-neutral-800 disabled:text-neutral-600 text-black"
						title="Send (Enter)"
						aria-label="Send message"
					>
						<Send className="h-3.5 w-3.5" />
					</button>
				)}
			</div>
		</div>
	);
}
