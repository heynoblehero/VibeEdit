"use client";

import { Loader2, Sparkles, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { haptics } from "@/lib/haptics";
import { toast } from "@/lib/toast";
import { useAgentRunStore } from "@/store/agent-run-store";
import { useProjectStore } from "@/store/project-store";

const STAGE_LABEL: Record<string, string> = {
	queued: "Queueing…",
	generating: "Composing your video…",
	validating: "Checking the draft…",
	done: "Ready",
	failed: "Failed",
	cancelled: "Cancelled",
};

const PROMPT_SUGGESTIONS = [
	"30-second hype reel about morning coffee rituals",
	"5 surprising facts about the deep ocean, fast cuts",
	"Quote-driven motivational short, dark moody background",
];

/**
 * Phone Edit-tab agent sheet.
 *
 * Slides up from the bottom when the ✨ FAB is tapped. Three views:
 *   idle    — prompt input + start button
 *   running — stage progress strip + cancel
 *   done    — preview of the agent's draft + Apply / Discard
 *   error   — the agent's failure message + Retry
 *
 * The sheet is mounted by `PhoneEditTab` so it inherits the safe-area
 * inset from the tab body. Tap-outside dismiss + Escape close.
 */
export function AgentSheet() {
	const open = useAgentRunStore((s) => s.open);
	const view = useAgentRunStore((s) => s.view);
	const stage = useAgentRunStore((s) => s.stage);
	const error = useAgentRunStore((s) => s.error);
	const draft = useAgentRunStore((s) => s.draft);
	const finalProject = useAgentRunStore((s) => s.finalProject);
	const closeSheet = useAgentRunStore((s) => s.closeSheet);
	const start = useAgentRunStore((s) => s.start);
	const cancel = useAgentRunStore((s) => s.cancel);
	const reset = useAgentRunStore((s) => s.reset);

	const setProject = useProjectStore((s) => s.setProject);
	const projectId = useProjectStore((s) => s.project.id);

	const [draftPrompt, setDraftPrompt] = useState("");

	useEffect(() => {
		if (!open) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") closeSheet();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [open, closeSheet]);

	const onStart = useCallback(() => {
		const trimmed = draftPrompt.trim();
		if (!trimmed) return;
		haptics.medium();
		void start(trimmed);
	}, [draftPrompt, start]);

	const onApply = useCallback(() => {
		if (!finalProject) return;
		// Reuse the user's current project id so we don't sprout a
		// duplicate entry in the dashboard every time the agent runs.
		setProject({ ...finalProject, id: projectId });
		haptics.success();
		toast.success(`Applied "${finalProject.name}" — ${finalProject.scenes.length} scenes`);
		reset();
		closeSheet();
	}, [finalProject, projectId, setProject, reset, closeSheet]);

	const onDiscard = useCallback(() => {
		haptics.light();
		reset();
	}, [reset]);

	const onRetry = useCallback(() => {
		reset();
	}, [reset]);

	if (!open) return null;

	return (
		<div
			className="fixed inset-0 z-[120] flex items-end justify-center bg-black/60 backdrop-blur-sm motion-fade"
			onClick={closeSheet}
			onKeyDown={() => {}}
			role="presentation"
		>
			<div
				className="w-full sm:max-w-md max-h-[85vh] flex flex-col rounded-t-2xl bg-neutral-900 border-t border-x border-neutral-800 shadow-[0_-8px_32px_rgba(0,0,0,0.5)] motion-slide-up pb-[env(safe-area-inset-bottom)]"
				onClick={(e) => e.stopPropagation()}
				onKeyDown={(e) => e.stopPropagation()}
				role="dialog"
				aria-label="AI generator"
			>
				<div className="flex justify-center pt-2 pb-1 shrink-0">
					<span className="block h-1 w-10 rounded-full bg-neutral-700" />
				</div>

				<div className="flex items-center justify-between px-4 pb-2 shrink-0">
					<div className="flex items-center gap-1.5 text-emerald-300">
						<Sparkles className="h-3.5 w-3.5" />
						<span className="text-[12px] uppercase tracking-wider font-semibold">
							AI Generate
						</span>
					</div>
					<button
						type="button"
						onClick={closeSheet}
						className="p-1 -mr-1 text-neutral-500 hover:text-white"
						aria-label="Close"
					>
						<X className="h-4 w-4" />
					</button>
				</div>

				<div className="flex-1 min-h-0 overflow-y-auto px-4 pb-4 space-y-3">
					{view === "idle" ? (
						<IdleView
							value={draftPrompt}
							onChange={setDraftPrompt}
							onStart={onStart}
						/>
					) : view === "running" ? (
						<RunningView stage={stage ?? "queued"} onCancel={cancel} />
					) : view === "done" ? (
						<DoneView
							projectName={finalProject?.name ?? draft?.name ?? "Draft"}
							sceneCount={finalProject?.scenes.length ?? 0}
							onApply={onApply}
							onDiscard={onDiscard}
						/>
					) : (
						<ErrorView error={error ?? "unknown error"} onRetry={onRetry} />
					)}
				</div>
			</div>
		</div>
	);
}

function IdleView({
	value,
	onChange,
	onStart,
}: {
	value: string;
	onChange: (v: string) => void;
	onStart: () => void;
}) {
	return (
		<>
			<p className="text-[12px] text-neutral-400 leading-relaxed">
				Describe the video you want. The agent will compose scenes, text, and
				timing for you. You can edit anything afterwards.
			</p>
			<textarea
				value={value}
				onChange={(e) => onChange(e.target.value)}
				placeholder="e.g. 30-second clip about morning coffee rituals"
				rows={4}
				className="w-full rounded-lg bg-neutral-950 border border-neutral-800 focus:border-emerald-500/40 focus:outline-none text-[13px] text-neutral-100 placeholder-neutral-600 p-3 resize-none"
			/>
			<div className="flex flex-wrap gap-1.5">
				{PROMPT_SUGGESTIONS.map((s) => (
					<button
						key={s}
						type="button"
						onClick={() => onChange(s)}
						className="text-[10px] px-2 py-1 rounded-full bg-neutral-800/70 hover:bg-neutral-700 text-neutral-400 hover:text-neutral-100 transition-colors"
					>
						{s}
					</button>
				))}
			</div>
			<Button
				variant="primary"
				size="md"
				accent="video"
				fullWidth
				disabled={!value.trim()}
				onClick={onStart}
				leadingIcon={<Sparkles className="h-3.5 w-3.5" />}
			>
				Generate
			</Button>
		</>
	);
}

function RunningView({
	stage,
	onCancel,
}: {
	stage: string;
	onCancel: () => void;
}) {
	const STAGES: Array<{ id: string; label: string }> = [
		{ id: "queued", label: "Queue" },
		{ id: "generating", label: "Compose" },
		{ id: "validating", label: "Validate" },
		{ id: "done", label: "Ready" },
	];
	const currentIdx = STAGES.findIndex((s) => s.id === stage);
	return (
		<>
			<div className="flex items-center gap-2 text-[13px] text-emerald-300">
				<Loader2 className="h-4 w-4 animate-spin" />
				<span>{STAGE_LABEL[stage] ?? stage}</span>
			</div>
			<div className="grid grid-cols-4 gap-1">
				{STAGES.map((s, idx) => {
					const isActive = idx === currentIdx;
					const isDone = idx < currentIdx;
					return (
						<div
							key={s.id}
							className="flex flex-col items-center gap-1 text-[10px]"
						>
							<div
								className={`h-1 w-full rounded-full transition-colors ${
									isDone
										? "bg-emerald-500"
										: isActive
										? "bg-emerald-500/50 animate-pulse"
										: "bg-neutral-800"
								}`}
							/>
							<span
								className={
									isActive
										? "text-emerald-300"
										: isDone
										? "text-neutral-400"
										: "text-neutral-600"
								}
							>
								{s.label}
							</span>
						</div>
					);
				})}
			</div>
			<p className="text-[11px] text-neutral-500 leading-relaxed">
				This usually takes 10–20 seconds. You can cancel anytime — your
				current project stays untouched until you tap Apply.
			</p>
			<Button variant="ghost" size="sm" fullWidth onClick={() => void onCancel()}>
				Cancel
			</Button>
		</>
	);
}

function DoneView({
	projectName,
	sceneCount,
	onApply,
	onDiscard,
}: {
	projectName: string;
	sceneCount: number;
	onApply: () => void;
	onDiscard: () => void;
}) {
	return (
		<>
			<div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
				<div className="text-[10px] uppercase tracking-wider text-emerald-300 font-semibold mb-1">
					Draft ready
				</div>
				<div className="text-[14px] text-white font-medium">{projectName}</div>
				<div className="text-[11px] text-neutral-400 mt-0.5">
					{sceneCount} scene{sceneCount === 1 ? "" : "s"} · ready to render
				</div>
			</div>
			<p className="text-[11px] text-neutral-500 leading-relaxed">
				Applying replaces the current project&apos;s scenes. Hit Render after
				to produce the MP4.
			</p>
			<div className="flex gap-2">
				<Button variant="ghost" size="md" fullWidth onClick={onDiscard}>
					Discard
				</Button>
				<Button
					variant="primary"
					size="md"
					accent="video"
					fullWidth
					onClick={onApply}
				>
					Apply to project
				</Button>
			</div>
		</>
	);
}

function ErrorView({ error, onRetry }: { error: string; onRetry: () => void }) {
	return (
		<>
			<div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-[12px] text-red-200 leading-relaxed whitespace-pre-wrap">
				{error}
			</div>
			<Button variant="primary" size="md" accent="video" fullWidth onClick={onRetry}>
				Try again
			</Button>
		</>
	);
}
