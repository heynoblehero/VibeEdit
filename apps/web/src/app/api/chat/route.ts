import { and, asc, desc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import { messages, projects, projectSnapshots } from "@/lib/db/schema";
import { listAssets, markAiAssets, readProjectText } from "@/lib/storage/fs";
import { requireServerSession } from "@/lib/server-session";
import { runAgent, type AgentEvent } from "@/lib/ai/agent";
import { enqueue } from "@/lib/render/queue";
import { getUserPlan, reserveUsage } from "@/lib/billing/usage";
import { upgradePaywall } from "@/lib/billing/paywall";
import { checkRateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { captureException } from "@/lib/observability/sentry";
import { captureEvent, FUNNEL } from "@/lib/observability/posthog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_HISTORY_CHARS = 14000;

// Keyed by `${userId}:${projectId}` so the same user can have one in-flight
// chat per project. Lets the client (or HMR) cancel a runaway agent loop
// via DELETE /api/chat.
const RUNNING: Map<string, AbortController> =
  (globalThis as unknown as { __vibeedit_running?: Map<string, AbortController> })
    .__vibeedit_running ?? new Map();
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
  const ALLOWED_KEYS = ["replicate", "elevenlabs", "openai", "anthropic"] as const;
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

  // Monthly chat-turn cap per plan (hard ceiling). Reserve atomically: the
  // count + the usage-event insert happen in one transaction so two parallel
  // turns can't both pass the gate and overshoot the cap. We reserve BEFORE
  // doing any agent work; the turn is committed the moment it's allowed.
  const plan = getUserPlan(userId);
  const chatReservation = reserveUsage(userId, "chat_turn", plan.chatTurnLimit, { projectId });
  if (!chatReservation.ok) {
    return Response.json(
      upgradePaywall("chat_limit_reached", {
        used: chatReservation.used,
        limit: chatReservation.limit,
      }),
      { status: 402 },
    );
  }

  // Per-user sliding-window rate limit — protects against a single account
  // burning the Anthropic bill in an afternoon (separate from the monthly cap).
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

  // Funnel: the first chat turn in a project is a key activation signal.
  if (prior.length === 0) {
    captureEvent(FUNNEL.firstMessageSent, userId, { projectId });
  }

  db.insert(messages)
    .values({
      id: nanoid(10),
      projectId,
      role: "user",
      content: JSON.stringify(userMessage),
      createdAt: new Date(),
    })
    .run();
  // Usage already reserved atomically above (chatReservation) — do not
  // double-count here.

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
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
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
        // Snapshot the asset set so we can tell which files the agent created
        // this turn (everything new = AI-made; uploads come in via /upload).
        const assetsBefore = new Set(listAssets(userId, projectId));
        await runAgent({
          userMessage,
          priorHistory,
          ctx: {
            userId,
            projectId,
            platform: owned.platform ?? undefined,
            aspectRatio: owned.aspectRatio ?? undefined,
            apiKeys: apiKeys as {
              replicate?: string;
              elevenlabs?: string;
              openai?: string;
              anthropic?: string;
            },
            enqueueRender: (opts) => enqueue({ userId, projectId, ...opts }),
          },
          onEvent: write,
          abortController,
        });

        const newAssets = listAssets(userId, projectId).filter((p) => !assetsBefore.has(p));
        markAiAssets(userId, projectId, newAssets);

        if (assistantBlocks.length) {
          const assistantMessageId = nanoid(10);
          db.insert(messages)
            .values({
              id: assistantMessageId,
              projectId,
              role: "assistant",
              content: JSON.stringify(assistantBlocks),
              createdAt: new Date(),
            })
            .run();
          // Snapshot the composition this turn produced so the chat can replay
          // each past version inline (skipped if nothing changed).
          captureChatSnapshot(userId, projectId, assistantMessageId);
        }
        db.update(projects).set({ updatedAt: new Date() }).where(eq(projects.id, projectId)).run();
      } catch (error) {
        captureException(error, { source: "api.chat", userId, projectId });
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

// Records the current index.html as a versioned snapshot tied to the assistant
// turn that produced it. De-duped: if the composition is byte-identical to the
// most recent snapshot, no new version is recorded (so Q&A turns that don't
// touch the composition don't spawn duplicate inline previews).
function captureChatSnapshot(userId: string, projectId: string, messageId: string): void {
  let html: string;
  try {
    html = readProjectText(userId, projectId, "index.html");
  } catch {
    return; // no composition yet — nothing to snapshot
  }
  const last = db
    .select({ html: projectSnapshots.html })
    .from(projectSnapshots)
    .where(eq(projectSnapshots.projectId, projectId))
    .orderBy(desc(projectSnapshots.createdAt))
    .limit(1)
    .get();
  if (last && last.html === html) return;
  db.insert(projectSnapshots)
    .values({
      id: nanoid(12),
      projectId,
      userId,
      messageId,
      html,
      createdAt: new Date(),
    })
    .run();
}

function serializePriorHistory(rows: Array<{ role: string; content: string }>): string {
  if (rows.length === 0) return "";
  const lines: string[] = [];
  for (const row of rows) {
    const parsed = safeParse(row.content);

    if (typeof parsed === "string") {
      if (parsed) lines.push(`${row.role}: ${parsed}`);
      continue;
    }

    if (!Array.isArray(parsed)) continue;

    const parts: string[] = [];
    for (const block of parsed as Array<Record<string, unknown>>) {
      if (!block || typeof block !== "object") continue;
      if (block.type === "text" && typeof block.text === "string" && block.text) {
        parts.push(block.text);
      } else if (block.type === "tool_use" && typeof block.name === "string") {
        const summary = summarizeToolForHistory(block.name, block.input as Record<string, unknown>);
        if (summary) parts.push(`[${summary}]`);
      }
    }

    const text = parts.join(" ").trim();
    if (text) lines.push(`${row.role}: ${text}`);
  }
  const joined = lines.join("\n");
  return joined.length > MAX_HISTORY_CHARS
    ? "…[earlier turns elided]…\n" + joined.slice(-MAX_HISTORY_CHARS)
    : joined;
}

function summarizeToolForHistory(name: string, input: Record<string, unknown>): string {
  switch (name) {
    case "write_file":
      return typeof input.path === "string" ? `wrote ${input.path}` : "wrote file";
    case "diff_file":
      return typeof input.path === "string" ? `edited ${input.path}` : "edited file";
    case "plan_composition": {
      const parts = [
        input.niche ?? "",
        input.format ?? "",
        input.totalDurationSeconds ? `${input.totalDurationSeconds}s` : "",
      ]
        .filter(Boolean)
        .join(" ");
      return `planned composition: ${parts}`;
    }
    case "plan_edit":
      return "planned edit";
    case "render_edl":
      return "rendered EDL";
    case "start_render":
      return "started render";
    case "generate_voiceover":
      return "generated voiceover";
    case "generate_broll":
      return typeof input.filename === "string"
        ? `generated broll: ${input.filename}`
        : "generated broll";
    case "download_asset":
      return typeof input.filename === "string"
        ? `downloaded ${input.filename}`
        : "downloaded asset";
    case "screenshot_at_time": {
      const ts = Array.isArray(input.timestamps) ? (input.timestamps as number[]).join(", ") : "";
      return ts ? `screenshotted at [${ts}]s` : "screenshotted";
    }
    default:
      return "";
  }
}

function safeParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}
