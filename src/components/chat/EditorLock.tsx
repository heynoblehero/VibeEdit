"use client";

import { Loader2, Square } from "lucide-react";
import { useChatStore } from "@/store/chat-store";

/**
 * Transparent overlay that locks manual editing while the chat agent
 * is streaming a turn.
 *
 * Why: tool calls apply project patches live as the agent works. If
 * the user simultaneously drags a scene or edits a field, their edit
 * either races or gets clobbered when the next agent patch arrives.
 * Locking the timeline + rails prevents that — the user can hit Stop
 * to take over instead.
 *
 * Mounted inside the editor body container in ProjectShell, so it
 * covers preview/scene-list/properties but NOT the chat panel. The
 * chat input stays alive so the user can still talk to the agent
 * (e.g. send "wait, change scene 2 to red instead").
 */
export function EditorLock() {
	const streaming = useChatStore((s) => s.streaming);
	const chatOpen = useChatStore((s) => s.open);
	const stop = useChatStore((s) => s.stop);

	if (!streaming) return null;

	// Lock everything LEFT of the chat panel. The chat panel itself
	// stays interactive so the user can still read the streaming reply
	// and hit Stop in the input bar. ChatPanel is 360px wide on desktop
	// (`w-[360px]`), so when open we end at right-[360px].
	const rightOffsetClass = chatOpen ? "md:right-[360px]" : "right-0";

	return (
		<div
			role="status"
			aria-live="polite"
			className={`absolute top-0 bottom-0 left-0 ${rightOffsetClass} z-30 flex items-start justify-center bg-emerald-500/[0.04] backdrop-blur-[1px] motion-fade pointer-events-auto`}
			onClick={(e) => e.stopPropagation()}
			onKeyDown={(e) => e.stopPropagation()}
		>
			<div className="mt-6 flex items-center gap-2 px-3 py-1.5 rounded-full bg-neutral-900/95 border border-emerald-500/40 shadow-[0_4px_16px_rgba(0,0,0,0.5)] motion-pop">
				<Loader2 className="h-3 w-3 text-emerald-300 animate-spin" />
				<span className="text-[11px] text-emerald-200 font-medium">
					Agent is editing
				</span>
				<span className="text-[10px] text-neutral-500">·</span>
				<button
					type="button"
					onClick={stop}
					className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-500/20 hover:bg-red-500/30 text-red-200 text-[10px] font-semibold uppercase tracking-wider"
					title="Stop the agent and take over"
				>
					<Square className="h-2.5 w-2.5 fill-current" />
					<span>Stop</span>
				</button>
			</div>
		</div>
	);
}
