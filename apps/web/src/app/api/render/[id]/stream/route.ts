import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { renderJobs } from "@/lib/db/schema";
import { requireServerSession } from "@/lib/server-session";
import { onJobUpdate } from "@/lib/render/queue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
	_req: Request,
	context: { params: Promise<{ id: string }> },
) {
	const session = await requireServerSession().catch((r) => r);
	if (session instanceof Response) return session;
	const userId = session.user.id;
	const { id } = await context.params;
	const row = db
		.select()
		.from(renderJobs)
		.where(and(eq(renderJobs.id, id), eq(renderJobs.userId, userId)))
		.get();
	if (!row) return new Response("not found", { status: 404 });

	const stream = new ReadableStream({
		start(controller) {
			const encoder = new TextEncoder();
			const send = (data: unknown) => {
				try {
					controller.enqueue(
						encoder.encode(`data: ${JSON.stringify(data)}\n\n`),
					);
				} catch {
					/* closed */
				}
			};
			// Initial state
			send({
				status: row.status,
				progress: row.progress,
				outputPath: row.outputPath,
				error: row.error,
			});
			if (row.status === "done" || row.status === "failed") {
				controller.close();
				return;
			}
			const unsubscribe = onJobUpdate(id, (data) => {
				send(data);
				const d = data as { status?: string };
				if (d.status === "done" || d.status === "failed") {
					try {
						controller.close();
					} catch {
						/* */
					}
				}
			});
			(controller as unknown as { _close: () => void })._close =
				unsubscribe;
		},
		cancel() {
			(this as unknown as { _close?: () => void })._close?.();
		},
	});
	return new Response(stream, {
		headers: {
			"content-type": "text/event-stream",
			"cache-control": "no-store, no-transform",
			"x-accel-buffering": "no",
		},
	});
}
