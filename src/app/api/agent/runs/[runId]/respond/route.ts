import type { NextRequest } from "next/server";
import { respondToRun } from "@/lib/agent/runner";

export const runtime = "nodejs";

interface RespondBody {
	kind: "clarify" | "upload";
	answers?: Record<string, string>;
	uploadUrl?: string;
}

export async function POST(
	request: NextRequest,
	{ params }: { params: Promise<{ runId: string }> },
) {
	const { runId } = await params;
	let body: RespondBody;
	try {
		body = (await request.json()) as RespondBody;
	} catch {
		return Response.json({ error: "invalid JSON body" }, { status: 400 });
	}

	if (body.kind === "clarify") {
		const result = respondToRun(runId, {
			kind: "clarify",
			answers: body.answers ?? {},
		});
		if (!result.ok) return Response.json({ error: result.error }, { status: 400 });
		return Response.json({ ok: true });
	}
	if (body.kind === "upload") {
		const result = respondToRun(runId, {
			kind: "upload",
			uploadUrl: body.uploadUrl ?? "",
		});
		if (!result.ok) return Response.json({ error: result.error }, { status: 400 });
		return Response.json({ ok: true });
	}
	return Response.json({ error: "kind must be 'clarify' or 'upload'" }, { status: 400 });
}
