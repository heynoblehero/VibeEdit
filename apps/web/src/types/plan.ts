import type { AIAction, AIActionResult } from "@/lib/ai/types";

export type PlanStatus = "draft" | "approved" | "executing" | "completed" | "failed";
export type StepStatus = "pending" | "executing" | "completed" | "failed" | "skipped";

export interface PlanStep {
	id: string;
	order: number;
	title: string;
	description: string;
	actions: AIAction[];
	actionResults?: AIActionResult[];
	timeRange?: { start: number; end: number };
	status: StepStatus;
}

export interface VideoPlan {
	id: string;
	title: string;
	description: string;
	estimatedDuration: number;
	steps: PlanStep[];
	status: PlanStatus;
	currentStepIndex: number;
}

export function createEmptyPlan(title: string, description: string): VideoPlan {
	return {
		id: crypto.randomUUID(),
		title,
		description,
		estimatedDuration: 0,
		steps: [],
		status: "draft",
		currentStepIndex: 0,
	};
}
