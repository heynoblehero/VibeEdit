import type { NextRequest } from "next/server";
import { startRun } from "@/lib/agent/runner";

export const runtime = "nodejs";
export const maxDuration = 60;

interface StartRequest {
	prompt: string;
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

	const run = startRun({ prompt });
	return Response.json({ runId: run.id });
}
