import { and, asc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import { messages, projects } from "@/lib/db/schema";
import { requireServerSession } from "@/lib/server-session";
import { runAgent, type AgentEvent } from "@/lib/ai/agent";
import { enqueue } from "@/lib/render/queue";
import { recordUsage } from "@/lib/billing/usage";
import { checkRateLimit, rateLimitHeaders } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_HISTORY_CHARS = 8000;

// Keyed by `${userId}:${projectId}` so the same user can have one in-flight
// chat per project. Lets the client (or HMR) cancel a runaway agent loop
// via DELETE /api/chat.
const RUNNING: Map<string, AbortController> = (
	globalThis as unknown as { __vibeedit_running?: Map<string, AbortController> }
).__vibeedit_running ?? new Map();
(
	globalThis as unknown as { __vibeedit_running?: Map<string, AbortController> }
).__vibeedit_running = RUNNING;

export async function DELETE(req: Request) {
	const session = await requireServerSession().catch((r) => r);
	if (session instanceof Response) return session;
	const url = new URL(req.url);
	const projectId = url.searchParams.get("projectId");
	if (!projectId) return new Response("projectId required", { status: 400 });
	const key = `${session.user.id}:${projectId}`;
	const controller = RUNNING.get(key);
	if (!controller) return new Response("not running", { status: 404 });
	controller.abort();
	RUNNING.delete(key);
	return Response.json({ aborted: true });
}

export async function POST(req: Request) {
	const session = await requireServerSession().catch((r) => r);
	if (session instanceof Response) return session;
	const userId = session.user.id;
	const body = (await req.json()) as {
		projectId: string;
		message: string;
		apiKeys?: Record<string, string>;
	};
	const projectId = body.projectId;
	const userMessage = body.message;
	if (!projectId || !userMessage)
		return new Response("projectId and message required", { status: 400 });

	// Validate & trim BYOK keys before handing to the agent. Anything unknown
	// is dropped so a malicious caller can't smuggle arbitrary header names.
	const ALLOWED_KEYS = [
		"replicate",
		"kling",
		"fal",
		"elevenlabs",
		"openai",
		"anthropic",
	] as const;
	const apiKeys: Record<string, string> = {};
	if (body.apiKeys && typeof body.apiKeys === "object") {
		for (const provider of ALLOWED_KEYS) {
			const value = body.apiKeys[provider];
			if (typeof value === "string" && value.trim().length > 4) {
				apiKeys[provider] = value.trim();
			}
		}
	}

	const owned = db
		.select()
		.from(projects)
		.where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
		.get();
	if (!owned) return new Response("not found", { status: 404 });

	// Per-user rate limit — protects us from a single account burning the
	// Anthropic bill in an afternoon. Limits are sliding windows; see
	// CHAT_PER_MINUTE / CHAT_PER_DAY envs to tune.
	const rate = checkRateLimit(`chat:${userId}`);
	if (!rate.ok) {
		return new Response(rate.reason || "rate limited", {
			status: 429,
			headers: rateLimitHeaders(rate),
		});
	}

	const prior = db
		.select()
		.from(messages)
		.where(eq(messages.projectId, projectId))
		.orderBy(asc(messages.createdAt))
		.all();
	const priorHistory = serializePriorHistory(prior);

	db.insert(messages)
		.values({
			id: nanoid(10),
			projectId,
			role: "user",
			content: JSON.stringify(userMessage),
			createdAt: new Date(),
		})
		.run();
	recordUsage(userId, "chat_turn", 1, { projectId });

	const assistantBlocks: Array<{
		type: string;
		text?: string;
		id?: string;
		name?: string;
		input?: Record<string, unknown>;
		tool_use_id?: string;
		images?: Array<{ data: string; mimeType: string }>;
	}> = [];

	const key = `${userId}:${projectId}`;
	// If a previous run for the same project is still going, abort it before
	// starting a new one (handles refresh/HMR/race).
	const previous = RUNNING.get(key);
	if (previous) previous.abort();
	const abortController = new AbortController();
	RUNNING.set(key, abortController);

	// Cancel the agent if the client closes the SSE stream.
	req.signal.addEventListener("abort", () => {
		const current = RUNNING.get(key);
		if (current === abortController) {
			abortController.abort();
			RUNNING.delete(key);
		}
	});

	const stream = new ReadableStream({
		async start(controller) {
			const encoder = new TextEncoder();
			const write = (event: AgentEvent) => {
				try {
					controller.enqueue(
						encoder.encode(`data: ${JSON.stringify(event)}\n\n`),
					);
				} catch {
					/* closed */
				}
				if (event.type === "text") {
					assistantBlocks.push({ type: "text", text: event.text });
				} else if (event.type === "tool_use") {
					assistantBlocks.push({
						type: "tool_use",
						id: event.id,
						name: event.name,
						input: event.input,
					});
				} else if (event.type === "tool_result" && event.images?.length) {
					assistantBlocks.push({
						type: "tool_result",
						tool_use_id: event.tool_use_id,
						images: event.images,
					});
				}
			};

			try {
				await runAgent({
					userMessage,
					priorHistory,
					ctx: {
						userId,
						projectId,
						apiKeys: apiKeys as {
							replicate?: string;
							kling?: string;
							fal?: string;
							elevenlabs?: string;
							openai?: string;
							anthropic?: string;
						},
						enqueueRender: (opts) =>
							enqueue({ userId, projectId, ...opts }),
					},
					onEvent: write,
					abortController,
				});

				if (assistantBlocks.length) {
					db.insert(messages)
						.values({
							id: nanoid(10),
							projectId,
							role: "assistant",
							content: JSON.stringify(assistantBlocks),
							createdAt: new Date(),
						})
						.run();
				}
				db.update(projects)
					.set({ updatedAt: new Date() })
					.where(eq(projects.id, projectId))
					.run();
			} catch (error) {
				write({ type: "error", message: (error as Error).message });
			} finally {
				if (RUNNING.get(key) === abortController) RUNNING.delete(key);
				try {
					controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
					controller.close();
				} catch {
					/* closed */
				}
			}
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

function serializePriorHistory(
	rows: Array<{ role: string; content: string }>,
): string {
	if (rows.length === 0) return "";
	const lines: string[] = [];
	for (const row of rows) {
		const parsed = safeParse(row.content);
		const text =
			typeof parsed === "string"
				? parsed
				: Array.isArray(parsed)
					? parsed
							.map((b) =>
								b && typeof b === "object" && "text" in b
									? (b as { text?: string }).text
									: "",
							)
							.filter(Boolean)
							.join(" ")
					: "";
		if (text) lines.push(`${row.role}: ${text}`);
	}
	const joined = lines.join("\n");
	return joined.length > MAX_HISTORY_CHARS
		? "…[earlier turns elided]…\n" + joined.slice(-MAX_HISTORY_CHARS)
		: joined;
}

function safeParse(s: string): unknown {
	try {
		return JSON.parse(s);
	} catch {
		return s;
	}
}
