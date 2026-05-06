import { cancelRun } from "@/lib/agent/runner";

export const runtime = "nodejs";

export async function POST(
	_request: Request,
	{ params }: { params: Promise<{ runId: string }> },
) {
	const { runId } = await params;
	const ok = cancelRun(runId);
	if (!ok) {
		return Response.json(
			{ error: "run not found or already finished" },
			{ status: 404 },
		);
	}
	return Response.json({ ok: true });
}
