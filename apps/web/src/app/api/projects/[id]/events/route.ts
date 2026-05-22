import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { requireServerSession } from "@/lib/server-session";
import { subscribe } from "@/lib/files/watcher";

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
		.from(projects)
		.where(and(eq(projects.id, id), eq(projects.userId, userId)))
		.get();
	if (!row) return new Response("not found", { status: 404 });

	const stream = new ReadableStream({
		start(controller) {
			const encoder = new TextEncoder();
			controller.enqueue(encoder.encode(": connected\n\n"));
			const unsubscribe = subscribe(userId, id, (path) => {
				try {
					controller.enqueue(
						encoder.encode(
							`event: change\ndata: ${JSON.stringify({ path })}\n\n`,
						),
					);
				} catch {
					/* stream closed */
				}
			});
			const keepalive = setInterval(() => {
				try {
					controller.enqueue(encoder.encode(": keepalive\n\n"));
				} catch {
					/* closed */
				}
			}, 25_000);
			(controller as unknown as { _close: () => void })._close = () => {
				clearInterval(keepalive);
				unsubscribe();
			};
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
