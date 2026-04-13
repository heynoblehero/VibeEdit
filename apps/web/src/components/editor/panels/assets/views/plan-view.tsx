"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { executeAIActions } from "@/lib/ai/executor";
import type { VideoPlan, PlanStep } from "@/types/plan";
import type { AIActionResult } from "@/lib/ai/types";

function StepStatusIcon({ status }: { status: PlanStep["status"] }) {
	switch (status) {
		case "completed":
			return <span className="text-green-400">&#10003;</span>;
		case "executing":
			return <span className="animate-spin text-blue-400">&#9696;</span>;
		case "failed":
			return <span className="text-red-400">&#10007;</span>;
		case "skipped":
			return <span className="text-muted-foreground">&#8212;</span>;
		default:
			return <span className="text-muted-foreground">&#9675;</span>;
	}
}

function PlanStepRow({
	step,
	onExecute,
	isRunning,
}: {
	step: PlanStep;
	onExecute: () => void;
	isRunning: boolean;
}) {
	return (
		<div
			className={`flex items-start gap-2 rounded-md border px-3 py-2 text-sm ${
				step.status === "completed"
					? "border-green-500/30 bg-green-500/5"
					: step.status === "executing"
						? "border-blue-500/30 bg-blue-500/5"
						: step.status === "failed"
							? "border-red-500/30 bg-red-500/5"
							: "border-border"
			}`}
		>
			<div className="mt-0.5 shrink-0">
				<StepStatusIcon status={step.status} />
			</div>
			<div className="flex-1 min-w-0">
				<p className="font-medium">{step.title}</p>
				<p className="text-xs text-muted-foreground mt-0.5">
					{step.description}
				</p>
				{step.actions.length > 0 && (
					<div className="mt-1 flex flex-wrap gap-1">
						{step.actions.map((action, i) => {
							const result = step.actionResults?.[i];
							return (
								<span
									key={i}
									className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] ${
										result?.success
											? "bg-green-500/20 text-green-400"
											: result
												? "bg-red-500/20 text-red-400"
												: "bg-muted text-muted-foreground"
									}`}
								>
									{action.tool}
								</span>
							);
						})}
					</div>
				)}
			</div>
			{step.status === "pending" && (
				<Button
					variant="ghost"
					size="sm"
					className="shrink-0 text-xs"
					onClick={onExecute}
					disabled={isRunning}
				>
					Run
				</Button>
			)}
		</div>
	);
}

export function PlanView({
	plan: initialPlan,
	onPlanUpdate,
}: {
	plan: VideoPlan;
	onPlanUpdate?: (plan: VideoPlan) => void;
}) {
	const [plan, setPlan] = useState(initialPlan);
	const [isRunning, setIsRunning] = useState(false);

	const update = (updated: VideoPlan) => {
		setPlan(updated);
		onPlanUpdate?.(updated);
	};

	const executeStep = async (stepIndex: number) => {
		const step = plan.steps[stepIndex];
		if (!step || step.actions.length === 0) return;

		const updated = { ...plan, steps: [...plan.steps] };
		updated.steps[stepIndex] = { ...step, status: "executing" };
		updated.status = "executing";
		update(updated);

		try {
			const results: AIActionResult[] = await executeAIActions(
				step.actions,
			);
			updated.steps[stepIndex] = {
				...step,
				status: results.every((r) => r.success)
					? "completed"
					: "failed",
				actionResults: results,
			};
		} catch {
			updated.steps[stepIndex] = { ...step, status: "failed" };
		}

		const allDone = updated.steps.every(
			(s) =>
				s.status === "completed" ||
				s.status === "failed" ||
				s.status === "skipped",
		);
		updated.status = allDone ? "completed" : "executing";
		update({ ...updated });
	};

	const executeAll = async () => {
		setIsRunning(true);
		for (let i = 0; i < plan.steps.length; i++) {
			if (plan.steps[i].status !== "pending") continue;
			await executeStep(i);
		}
		setIsRunning(false);
	};

	const completedCount = plan.steps.filter(
		(s) => s.status === "completed",
	).length;
	const progress = plan.steps.length > 0
		? Math.round((completedCount / plan.steps.length) * 100)
		: 0;

	return (
		<div className="rounded-lg border bg-card p-3 space-y-3">
			{/* Header */}
			<div>
				<div className="flex items-center justify-between">
					<h3 className="font-semibold text-sm">{plan.title}</h3>
					<span className="text-xs text-muted-foreground">
						{completedCount}/{plan.steps.length} steps
					</span>
				</div>
				<p className="text-xs text-muted-foreground mt-0.5">
					{plan.description}
				</p>
				{/* Progress bar */}
				<div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
					<div
						className="h-full bg-primary rounded-full transition-all duration-300"
						style={{ width: `${progress}%` }}
					/>
				</div>
			</div>

			{/* Steps */}
			<div className="space-y-2">
				{plan.steps.map((step, i) => (
					<PlanStepRow
						key={step.id}
						step={step}
						onExecute={() => executeStep(i)}
						isRunning={isRunning}
					/>
				))}
			</div>

			{/* Actions */}
			{plan.status === "draft" && (
				<div className="flex gap-2">
					<Button
						onClick={executeAll}
						disabled={isRunning}
						size="sm"
						className="flex-1"
					>
						{isRunning ? "Executing..." : "Execute All Steps"}
					</Button>
				</div>
			)}

			{plan.status === "completed" && (
				<p className="text-xs text-green-400 text-center">
					All steps completed successfully
				</p>
			)}
		</div>
	);
}
