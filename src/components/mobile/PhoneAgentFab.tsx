"use client";

import { Sparkles } from "lucide-react";
import { haptics } from "@/lib/haptics";
import { useAgentRunStore } from "@/store/agent-run-store";

type Placement = "phone" | "desktop";

interface Props {
	/**
	 * Phone variant uses `absolute` positioning inside a `relative`
	 * parent (the Edit tab body) so it sits above the bottom tab bar.
	 * Desktop variant pins to the bottom-left of the viewport so it
	 * doesn't collide with the render queue dock + recent-renders
	 * strip on the bottom-right.
	 */
	placement?: Placement;
}

/**
 * ✨ floating action button that opens the AgentSheet. Mounted on both
 * the phone Edit tab and the desktop project shell — the agent itself
 * is the same on either surface.
 */
export function PhoneAgentFab({ placement = "phone" }: Props = {}) {
	const open = useAgentRunStore((s) => s.open);
	const view = useAgentRunStore((s) => s.view);
	const openSheet = useAgentRunStore((s) => s.openSheet);

	if (open) return null;

	const isRunning = view === "running";

	const positionClass =
		placement === "desktop"
			? "fixed left-4 bottom-4 z-40"
			: "absolute right-4 bottom-4 z-30";

	return (
		<button
			type="button"
			onClick={() => {
				haptics.light();
				openSheet();
			}}
			className={`${positionClass} flex items-center gap-1.5 px-3 h-11 rounded-full shadow-[0_4px_16px_rgba(0,0,0,0.5)] motion-pop transition-colors ${
				isRunning
					? "bg-emerald-500/90 text-black animate-pulse"
					: "bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-black"
			}`}
			title={isRunning ? "AI is composing your video" : "Generate with AI"}
			aria-label="Generate video with AI"
		>
			<Sparkles className="h-4 w-4" />
			<span className="text-[12px] font-semibold tracking-wide">
				{isRunning ? "Composing…" : "AI"}
			</span>
		</button>
	);
}
