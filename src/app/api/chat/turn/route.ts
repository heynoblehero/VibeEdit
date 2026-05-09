import type { NextRequest } from "next/server";
import type Anthropic from "@anthropic-ai/sdk";
import { runChatTurn } from "@/lib/agent/chat-runner";
import type { Project } from "@/lib/scene-schema";

export const runtime = "nodejs";
export const maxDuration = 600;

interface TurnRequest {
	project: Project;
	priorMessages: Anthropic.MessageParam[];
	userMessage: string;
}

/**
 * Single chat turn. Streams events back as SSE so the client UI can
 * show tokens and tool calls as they happen. Stateless server: every
 * turn carries its own project + history snapshot.
 */
export async function POST(request: NextRequest) {
	let body: TurnRequest;
	try {
		body = (await request.json()) as TurnRequest;
	} catch {
		return Response.json({ error: "invalid JSON body" }, { status: 400 });
	}
	if (!body?.project?.id) {
		return Response.json(
			{ error: "project snapshot required" },
			{ status: 400 },
		);
	}
	if (!body?.userMessage || typeof body.userMessage !== "string") {
		return Response.json({ error: "userMessage required" }, { status: 400 });
	}
	if (body.userMessage.length > 8000) {
		return Response.json(
			{ error: "userMessage too long (max 8000 chars)" },
			{ status: 400 },
		);
	}

	const encoder = new TextEncoder();
	const abort = new AbortController();
	let closed = false;

	const stream = new ReadableStream<Uint8Array>({
		async start(controller) {
			const send = (event: Record<string, unknown>) => {
				if (closed) return;
				try {
					controller.enqueue(
						encoder.encode(`data: ${JSON.stringify(event)}\n\n`),
					);
				} catch {
					closed = true;
				}
			};

			try {
				for await (const evt of runChatTurn({
					project: body.project,
					priorMessages: body.priorMessages ?? [],
					userMessage: body.userMessage,
					origin: request.nextUrl.origin,
					signal: abort.signal,
				})) {
					send(evt);
					if (evt.type === "done" || evt.type === "failed") {
						setTimeout(() => {
							if (closed) return;
							closed = true;
							try {
								controller.close();
							} catch {
								// already closed
							}
						}, 50);
						return;
					}
				}
			} catch (err) {
				send({
					type: "failed",
					error: err instanceof Error ? err.message : String(err),
				});
				setTimeout(() => {
					if (closed) return;
					closed = true;
					try {
						controller.close();
					} catch {
						// already closed
					}
				}, 50);
			}
		},
		cancel() {
			closed = true;
			abort.abort();
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
