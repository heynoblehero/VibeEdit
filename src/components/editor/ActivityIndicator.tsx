"use client";

import { Activity, Bot, Film, Mic, Plus, RotateCcw, Trash2, Upload } from "lucide-react";
import { useState } from "react";
import {
	type ActivityEvent,
	type ActivityKind,
	useActivityStore,
} from "@/store/activity-store";
import { useProjectStore } from "@/store/project-store";

const KIND_ICON: Record<ActivityKind, typeof Bot> = {
	"ai-edit": Bot,
	"scene-add": Plus,
	"scene-delete": Trash2,
	voiceover: Mic,
	render: Film,
	import: Upload,
	manual: RotateCcw,
};

const KIND_TINT: Record<ActivityKind, string> = {
	"ai-edit": "text-fuchsia-300",
	"scene-add": "text-emerald-300",
	"scene-delete": "text-red-300",
	voiceover: "text-orange-300",
	render: "text-emerald-300",
	import: "text-neutral-300",
	manual: "text-neutral-400",
};

// Stable reference for the empty fallback. Returning a fresh array
// from a Zustand selector breaks getSnapshot caching.
const EMPTY_EVENTS: ActivityEvent[] = [];

function fmtRel(ts: number): string {
	const diff = Date.now() - ts;
	const s = Math.floor(diff / 1000);
	if (s < 30) return "just now";
	if (s < 60) return `${s}s ago`;
	const m = Math.floor(s / 60);
	if (m < 60) return `${m}m ago`;
	const h = Math.floor(m / 60);
	if (h < 24) return `${h}h ago`;
	const d = Math.floor(h / 24);
	return `${d}d ago`;
}

/**
 * "What's new" pill — sits next to the project name in the topbar.
 * Hover/click to see the last 20 activity events for the active
 * project. Quiet badge when there's anything in the feed.
 */
export function ActivityIndicator() {
	const projectId = useProjectStore((s) => s.project.id);
	// Subscribe to the bucket reference, not the derived "?? []" result —
	// returning a fresh `[]` on every snapshot tripped React's
	// `getSnapshot should be cached` warning and looped useSyncExternalStore.
	const eventsMap = useActivityStore((s) => s.events);
	const events = eventsMap[projectId] ?? EMPTY_EVENTS;
	const [open, setOpen] = useState(false);

	if (events.length === 0) return null;

	return (
		<div className="relative">
			<button
				type="button"
				onClick={() => setOpen((v) => !v)}
				className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] text-neutral-500 hover:text-neutral-200 hover:bg-neutral-900 transition-colors"
				title="Recent activity"
			>
				<Activity className="h-3 w-3" />
				<span className="tabular-nums">{events.length}</span>
			</button>
			{open ? (
				<>
					<button
						type="button"
						aria-label="close activity"
						onClick={() => setOpen(false)}
						className="fixed inset-0 z-30 cursor-default"
					/>
					<div className="absolute top-full mt-1 left-0 z-40 w-72 rounded-md border border-neutral-700 bg-neutral-900 shadow-[0_8px_24px_rgba(0,0,0,0.45)] motion-pop">
						<div className="px-3 py-2 border-b border-neutral-800 text-[10px] uppercase tracking-wider text-neutral-500 font-semibold flex items-center justify-between">
							<span>Recent activity</span>
							<button
								type="button"
								onClick={() => {
									useActivityStore.getState().clear(projectId);
									setOpen(false);
								}}
								className="hover:text-neutral-300 normal-case tracking-normal"
							>
								clear
							</button>
						</div>
						<div className="max-h-72 overflow-y-auto py-1">
							{events.map((ev) => {
								const Icon = KIND_ICON[ev.kind] ?? Activity;
								return (
									<div
										key={ev.id}
										className="flex items-center gap-2 px-3 py-1.5"
									>
										<Icon className={`h-3 w-3 shrink-0 ${KIND_TINT[ev.kind]}`} />
										<span className="text-[11px] text-neutral-200 flex-1 truncate">
											{ev.label}
										</span>
										<span className="text-[10px] text-neutral-600 font-mono tabular-nums shrink-0">
											{fmtRel(ev.at)}
										</span>
									</div>
								);
							})}
						</div>
					</div>
				</>
			) : null}
		</div>
	);
}
