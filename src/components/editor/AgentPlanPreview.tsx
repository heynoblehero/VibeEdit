"use client";

import { Sparkles, X } from "lucide-react";

export interface PlanStep {
	verb: string;
	target?: string;
}

interface Props {
	steps: PlanStep[];
	onApprove: () => void;
	onCancel: () => void;
}

/**
 * Inline plan preview shown above the chat input when the agent is
 * about to issue a >3-step burst. Surfaces the planned tool calls so
 * the user can interrupt before any state changes. Empty/short plans
 * skip the preview so trivial single-call ops feel snappy.
 *
 * The chat panel passes a ready-to-render plan; this component owns
 * only presentation + the two-button decision.
 */
export function AgentPlanPreview({ steps, onApprove, onCancel }: Props) {
	if (steps.length < 3) return null;
	return (
		<div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-2.5 space-y-2 motion-slide-down">
			<div className="flex items-center gap-2">
				<Sparkles className="h-3.5 w-3.5 text-emerald-300" />
				<span className="text-[11px] uppercase tracking-wider text-emerald-300 font-semibold">
					Plan ({steps.length} steps)
				</span>
				<button
					type="button"
					onClick={onCancel}
					title="Cancel"
					className="ml-auto text-neutral-500 hover:text-red-300"
				>
					<X className="h-3 w-3" />
				</button>
			</div>
			<ol className="space-y-0.5 text-[12px] text-neutral-200">
				{steps.map((s, i) => (
					<li key={i} className="flex items-start gap-2">
						<span className="text-[10px] font-mono text-emerald-300/70 tabular-nums w-4 shrink-0">
							{i + 1}.
						</span>
						<span className="flex-1">
							<span className="font-medium">{s.verb}</span>
							{s.target ? (
								<span className="text-neutral-500"> · {s.target}</span>
							) : null}
						</span>
					</li>
				))}
			</ol>
			<div className="flex items-center justify-end gap-2 pt-1">
				<button
					type="button"
					onClick={onCancel}
					className="text-[11px] text-neutral-500 hover:text-neutral-200"
				>
					Cancel
				</button>
				<button
					type="button"
					onClick={onApprove}
					className="text-[11px] font-semibold px-3 py-1 rounded bg-emerald-500 hover:bg-emerald-400 text-neutral-950"
				>
					Run plan
				</button>
			</div>
		</div>
	);
}
