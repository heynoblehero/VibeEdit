"use client";

import { Check, ChevronDown, ChevronRight, X } from "lucide-react";
import { useState } from "react";

export interface ToolCallEvent {
	id: string;
	name: string;
	/** Short verb-phrase that becomes the breadcrumb line. */
	summary: string;
	/** Optional structured detail revealed when the row expands. */
	detail?: Record<string, unknown>;
	status: "running" | "ok" | "failed";
	error?: string;
}

interface Props {
	event: ToolCallEvent;
}

/**
 * Single inline breadcrumb for an agent tool call. Lives between
 * assistant message bubbles in the chat panel — collapsed by default,
 * expandable to reveal the structured payload. Shared so any chat
 * surface (Animate, future main agent) can render the same line.
 */
export function ToolCallBreadcrumb({ event }: Props) {
	const [open, setOpen] = useState(false);
	const Icon =
		event.status === "ok" ? Check : event.status === "failed" ? X : Spinner;
	const tint =
		event.status === "ok"
			? "text-emerald-300 border-emerald-500/30"
			: event.status === "failed"
				? "text-red-300 border-red-500/30"
				: "text-neutral-300 border-neutral-700";
	return (
		<div className={`rounded-md border ${tint} bg-neutral-950/60 px-2 py-1`}>
			<button
				type="button"
				onClick={() => setOpen((v) => !v)}
				className="w-full flex items-center gap-2 text-left"
			>
				{open ? (
					<ChevronDown className="h-3 w-3 shrink-0 text-neutral-500" />
				) : (
					<ChevronRight className="h-3 w-3 shrink-0 text-neutral-500" />
				)}
				<Icon className="h-3 w-3 shrink-0" />
				<span className="text-[11px] font-mono text-neutral-400 shrink-0">
					{event.name}
				</span>
				<span className="text-[11px] text-neutral-200 truncate">
					{event.summary}
				</span>
			</button>
			{open && (event.detail || event.error) ? (
				<div className="mt-1 ml-5 text-[10px] text-neutral-400 font-mono">
					{event.error ? (
						<div className="text-red-300 whitespace-pre-wrap">{event.error}</div>
					) : null}
					{event.detail ? (
						<pre className="whitespace-pre-wrap break-all">
							{JSON.stringify(event.detail, null, 2)}
						</pre>
					) : null}
				</div>
			) : null}
		</div>
	);
}

function Spinner({ className }: { className?: string }) {
	return (
		<span
			className={`inline-block rounded-full border-2 border-t-transparent border-neutral-500 animate-spin ${className ?? ""}`}
		/>
	);
}
