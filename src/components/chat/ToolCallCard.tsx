"use client";

import { Check, ChevronRight, Loader2, X } from "lucide-react";
import { useState } from "react";

interface ToolCall {
	id: string;
	name: string;
	input: unknown;
	result?: { ok: boolean; content: string };
}

/**
 * Compact card visualizing one tool invocation in the chat.
 *
 * Collapsed by default. Click to expand input args + tool_result.
 * State badges:
 *   loading — tool is in flight (no result yet)
 *   ok      — green check, result was successful
 *   err     — red x, tool returned is_error
 */
export function ToolCallCard({ call }: { call: ToolCall }) {
	const [expanded, setExpanded] = useState(false);
	const status: "loading" | "ok" | "err" = !call.result
		? "loading"
		: call.result.ok
		? "ok"
		: "err";

	const statusBg =
		status === "ok"
			? "border-emerald-500/30 bg-emerald-500/5"
			: status === "err"
			? "border-red-500/30 bg-red-500/5"
			: "border-neutral-800 bg-neutral-900/40";

	return (
		<div className={`rounded-md border ${statusBg} text-[11px]`}>
			<button
				type="button"
				onClick={() => setExpanded((v) => !v)}
				className="w-full flex items-center gap-1.5 px-2 py-1.5 text-left"
			>
				<ChevronRight
					className={`h-3 w-3 text-neutral-500 transition-transform ${expanded ? "rotate-90" : ""}`}
				/>
				<StatusIcon status={status} />
				<span className="font-mono text-neutral-300">{call.name}</span>
				{call.result && !expanded ? (
					<span className="ml-auto text-[10px] text-neutral-500 truncate max-w-[180px]">
						{call.result.content.slice(0, 80)}
					</span>
				) : null}
			</button>
			{expanded ? (
				<div className="px-2 pb-2 space-y-1.5">
					<div>
						<div className="text-[9px] uppercase tracking-wider text-neutral-500 mb-0.5">
							input
						</div>
						<pre className="text-[10px] font-mono text-neutral-300 bg-neutral-950/60 rounded px-1.5 py-1 overflow-x-auto">
							{tryStringify(call.input)}
						</pre>
					</div>
					{call.result ? (
						<div>
							<div className="text-[9px] uppercase tracking-wider text-neutral-500 mb-0.5">
								result
							</div>
							<div
								className={`text-[10px] rounded px-1.5 py-1 ${
									call.result.ok
										? "bg-neutral-950/60 text-neutral-300"
										: "bg-red-500/10 text-red-200"
								}`}
							>
								{call.result.content}
							</div>
						</div>
					) : null}
				</div>
			) : null}
		</div>
	);
}

function StatusIcon({ status }: { status: "loading" | "ok" | "err" }) {
	if (status === "loading")
		return <Loader2 className="h-3 w-3 text-emerald-300 animate-spin shrink-0" />;
	if (status === "ok")
		return <Check className="h-3 w-3 text-emerald-400 shrink-0" />;
	return <X className="h-3 w-3 text-red-400 shrink-0" />;
}

function tryStringify(v: unknown): string {
	try {
		return JSON.stringify(v, null, 2);
	} catch {
		return String(v);
	}
}
