"use client";

import { Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { useAiStatusStore } from "@/store/ai-status-store";

/**
 * Tiny header pill that pulses when any AI work is in flight (chat,
 * voiceover, image, animation, transcribe). Hover to see what's
 * running. Mounted next to the AutoSaveIndicator so users have one
 * place to glance at "is the agent doing something."
 */
export function AiStatusIndicator() {
	const tasks = useAiStatusStore((s) => s.tasks);
	const spendCents = useAiStatusStore((s) => s.spendCents);
	const [hovered, setHovered] = useState(false);
	// Force re-render every second while there's a task so the
	// elapsed-time tooltip stays current.
	const [, setTick] = useState(0);
	useEffect(() => {
		if (tasks.length === 0) return;
		const id = window.setInterval(() => setTick((t) => t + 1), 1000);
		return () => window.clearInterval(id);
	}, [tasks.length]);

	// Always show spend if any AI work has been done this session,
	// even when nothing is currently in flight. Keeps cost visible.
	if (tasks.length === 0 && spendCents === 0) return null;
	return (
		<div
			className={`relative hidden md:flex items-center gap-1.5 px-2 py-1 rounded-full border text-[10px] select-none ${
				tasks.length > 0
					? "bg-fuchsia-500/10 border-fuchsia-500/40 text-fuchsia-200"
					: "bg-neutral-900 border-neutral-800 text-neutral-400"
			}`}
			onMouseEnter={() => setHovered(true)}
			onMouseLeave={() => setHovered(false)}
		>
			<Sparkles
				className={`h-3 w-3 ${tasks.length > 0 ? "animate-pulse" : ""}`}
			/>
			<span className="font-semibold">
				{tasks.length > 0
					? `AI working${tasks.length > 1 ? ` · ${tasks.length}` : ""}`
					: `$${(spendCents / 100).toFixed(3)}`}
			</span>
			{hovered ? (
				<div className="absolute top-full mt-1 right-0 z-50 w-64 rounded-md border border-neutral-700 bg-neutral-900 p-2 motion-pop shadow-[0_8px_24px_rgba(0,0,0,0.45)]">
					<div className="text-[10px] uppercase tracking-wider text-fuchsia-300/80 font-semibold mb-1">
						{tasks.length > 0 ? "In flight" : "Session"}
					</div>
					<div className="space-y-1">
						{tasks.map((t) => {
							const elapsed = Math.floor((Date.now() - t.startedAt) / 1000);
							return (
								<div
									key={t.id}
									className="flex items-center justify-between text-[11px] text-neutral-300"
								>
									<span className="truncate">{t.label}</span>
									<span className="text-neutral-500 font-mono tabular-nums">
										{elapsed}s
									</span>
								</div>
							);
						})}
						<div className="flex items-center justify-between text-[11px] text-neutral-300 pt-1 border-t border-neutral-800">
							<span>Session spend</span>
							<span className="text-fuchsia-300 font-mono tabular-nums">
								${(spendCents / 100).toFixed(4)}
							</span>
						</div>
					</div>
				</div>
			) : null}
		</div>
	);
}
