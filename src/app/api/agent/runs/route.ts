import type { NextRequest } from "next/server";
import { type AssetSurvey, buildSurvey } from "@/lib/agent/asset-survey";
import { startRun } from "@/lib/agent/runner";
import type { Project } from "@/lib/scene-schema";

export const runtime = "nodejs";
export const maxDuration = 60;

interface StartRequest {
	prompt: string;
	/**
	 * Snapshot of the user's project + asset stores at run-start.
	 * Sent because asset state is client-side (Zustand-persisted) —
	 * the server has no other way to see it. Trimmed to what the
	 * agent actually needs to plan with.
	 */
	project: Project;
	characters?: Array<{ id: string; name: string; src: string }>;
	sfx?: Array<{ id: string; name: string; src: string }>;
}

export async function POST(request: NextRequest) {
	let body: StartRequest;
	try {
		body = (await request.json()) as StartRequest;
	} catch {
		return Response.json({ error: "invalid JSON body" }, { status: 400 });
	}
	const prompt = (body?.prompt ?? "").trim();
	if (!prompt) {
		return Response.json({ error: "prompt is required" }, { status: 400 });
	}
	if (prompt.length > 4000) {
		return Response.json(
			{ error: "prompt is too long (max 4000 chars)" },
			{ status: 400 },
		);
	}
	if (!body?.project?.id) {
		return Response.json(
			{ error: "project snapshot is required" },
			{ status: 400 },
		);
	}

	const survey: AssetSurvey = buildSurvey({
		project: body.project,
		characters: body.characters ?? [],
		sfx: body.sfx ?? [],
	});

	const run = startRun({ prompt, survey });
	return Response.json({ runId: run.id });
}
