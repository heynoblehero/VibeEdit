import type { NextRequest } from "next/server";
import { type AssetSurvey, buildSurvey } from "@/lib/agent/asset-survey";
import { tryCharge } from "@/lib/agent/run-cap";
import { startRun } from "@/lib/agent/runner";
import type { Project } from "@/lib/scene-schema";

export const runtime = "nodejs";
export const maxDuration = 60;

interface StartRequest {
	prompt: string;
	project: Project;
	characters?: Array<{ id: string; name: string; src: string }>;
	sfx?: Array<{ id: string; name: string; src: string }>;
	/** When true, skip the Critic loop and finish on the first emit. */
	skipCritique?: boolean;
}

function ipFor(request: NextRequest): string {
	// dokku puts nginx in front so x-forwarded-for is canonical there.
	const xff = request.headers.get("x-forwarded-for");
	if (xff) return xff.split(",")[0].trim();
	const real = request.headers.get("x-real-ip");
	if (real) return real.trim();
	return "anon";
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

	const skipCritique = body.skipCritique === true;

	// Only charge full critic-loop runs against the daily cap. Skip-critique
	// runs are ~$0.05; gating those would just be friction.
	if (!skipCritique) {
		const ip = ipFor(request);
		const charge = tryCharge(`agent:${ip}`);
		if (!charge.ok) {
			return Response.json(
				{
					error: `Daily AI critic-loop cap reached (${charge.limit}/day). Try again tomorrow, or use 'Quick generate' to skip the critic.`,
				},
				{ status: 429 },
			);
		}
	}

	const survey: AssetSurvey = buildSurvey({
		project: body.project,
		characters: body.characters ?? [],
		sfx: body.sfx ?? [],
	});

	const run = startRun({
		prompt,
		survey,
		skipCritique,
		origin: request.nextUrl.origin,
	});
	return Response.json({ runId: run.id });
}
