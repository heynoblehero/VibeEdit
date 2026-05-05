import type { NextRequest } from "next/server";

export const runtime = "nodejs";

/**
 * Sink for client-side uncaught exceptions. Logs to stderr so the
 * server's existing observability captures them; no DB write yet —
 * upgrade to a real sink once the auth + storage adapter lands.
 */
export async function POST(request: NextRequest) {
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return Response.json({ error: "expected JSON body" }, { status: 400 });
	}
	console.error("[client-error]", JSON.stringify(body));
	return Response.json({ ok: true });
}
