import { subscribe } from "@/lib/agent/runner";

export const runtime = "nodejs";
export const maxDuration = 600;

export async function GET(
	_request: Request,
	{ params }: { params: Promise<{ runId: string }> },
) {
	const { runId } = await params;
	const encoder = new TextEncoder();

	let unsubscribe: (() => void) | null = null;
	let closed = false;

	const stream = new ReadableStream<Uint8Array>({
		start(controller) {
			const closeStream = () => {
				if (closed) return;
				closed = true;
				try {
					controller.close();
				} catch {
					// already closed
				}
			};

			const send = (evt: string) => {
				if (closed) return;
				try {
					controller.enqueue(encoder.encode(evt));
				} catch {
					closed = true;
					return;
				}
				// Terminal events trigger stream close so the client's
				// EventSource.onerror doesn't hang the connection.
				if (
					evt.includes(`"type":"done"`) ||
					evt.includes(`"type":"failed"`) ||
					evt.includes(`"stage":"cancelled"`)
				) {
					setTimeout(closeStream, 50);
				}
			};

			unsubscribe = subscribe(runId, send);
		},
		cancel() {
			closed = true;
			if (unsubscribe) {
				unsubscribe();
				unsubscribe = null;
			}
		},
	});

	return new Response(stream, {
		headers: {
			"Content-Type": "text/event-stream",
			"Cache-Control": "no-cache, no-transform",
			Connection: "keep-alive",
			"X-Accel-Buffering": "no",
		},
	});
}
