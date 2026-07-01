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

type AssistantBlock = {
  type: string;
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  tool_use_id?: string;
  images?: Array<{ data: string; mimeType: string }>;
};

// A subscriber is one connected viewer (the POSTing tab, or a reconnecting one).
type Subscriber = { send: (event: AgentEvent) => void; finish: () => void };

// A detached, in-flight agent run. The run's lifecycle is INDEPENDENT of any
// HTTP connection: closing the browser detaches the viewer but the agent keeps
// going server-side and persists its result. Viewers replay `events` on attach
// then stream live; `done` + the grace-period GC let late reconnects still see
// the tail before the run is dropped.
type RunState = {
  controller: AbortController;
  events: AgentEvent[];
  done: boolean;
  subs: Set<Subscriber>;
};

// Keyed by `${userId}:${projectId}` — one in-flight chat per project. Backed by
// globalThis so it survives HMR in dev and module re-eval.
const RUNS: Map<string, RunState> =
  (globalThis as unknown as { __vibeedit_runs?: Map<string, RunState> }).__vibeedit_runs ??
  new Map();
(globalThis as unknown as { __vibeedit_runs?: Map<string, RunState> }).__vibeedit_runs = RUNS;

// How long to keep a finished run's buffer around so a tab that reconnects just
// after completion can still replay the final events before we GC it.
const RUN_GRACE_MS = 120_000;

// Buffered copy of an event for later replay — strip heavy base64 image payloads
// (they're persisted to the DB assistant message + on disk, so a reconnecting
// client gets them from history; live viewers still receive the full event).
function slimEvent(event: AgentEvent): AgentEvent {
  if (event.type === "tool_result" && event.images && event.images.length) {
    return { ...event, images: undefined };
  }
  return event;
}

// SSE response that replays a run's buffered events then streams live until the
// run finishes. Client disconnect detaches this viewer only — never aborts the
// run (that's what DELETE is for).
function streamRun(state: RunState, signal: AbortSignal): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      let closed = false;
      const enqueue = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          closed = true;
        }
      };
      const send = (event: AgentEvent) => enqueue(`data: ${JSON.stringify(event)}\n\n`);
      const close = () => {
        if (closed) return;
        closed = true;
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };

      // Replay buffered events, then subscribe — synchronous, so no event can
      // slip between the two and be lost or duplicated.
      for (const event of state.events) send(event);
      if (state.done) {
        enqueue(`data: [DONE]\n\n`);
        close();
        return;
      }
      const sub: Subscriber = {
        send,
        finish: () => {
          enqueue(`data: [DONE]\n\n`);
          close();
          state.subs.delete(sub);
        },
      };
      state.subs.add(sub);
      signal.addEventListener("abort", () => {
        state.subs.delete(sub);
        close();
      });
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

// Start a detached agent run for this project. Aborts any previous run for the
// same key first. The agent executes independently of the request that started
// it and persists its assistant message + snapshot on completion.
function startRun(params: {
  key: string;
  userId: string;
  projectId: string;
  userMessage: string;
  priorHistory: string;
  platform?: string;
  aspectRatio?: string;
  apiKeys: { replicate?: string; elevenlabs?: string; anthropic?: string };
}): RunState {
  const previous = RUNS.get(params.key);
  if (previous) {
    previous.controller.abort();
    RUNS.delete(params.key);
  }

  const controller = new AbortController();
  const state: RunState = { controller, events: [], done: false, subs: new Set() };
  RUNS.set(params.key, state);

  const assistantBlocks: AssistantBlock[] = [];
  const write = (event: AgentEvent) => {
    state.events.push(slimEvent(event));
    for (const sub of [...state.subs]) sub.send(event);
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

  void (async () => {
    try {
      const assetsBefore = new Set(listAssets(params.userId, params.projectId));
      await runAgent({
        userMessage: params.userMessage,
        priorHistory: params.priorHistory,
        ctx: {
          userId: params.userId,
          projectId: params.projectId,
          platform: params.platform,
          aspectRatio: params.aspectRatio,
          apiKeys: params.apiKeys,
          enqueueRender: (opts) =>
            enqueue({ userId: params.userId, projectId: params.projectId, ...opts }),
        },
        onEvent: write,
        abortController: controller,
      });

      const newAssets = listAssets(params.userId, params.projectId).filter(
        (p) => !assetsBefore.has(p),
      );
      markAiAssets(params.userId, params.projectId, newAssets);

      if (assistantBlocks.length) {
        const assistantMessageId = nanoid(10);
        db.insert(messages)
          .values({
            id: assistantMessageId,
            projectId: params.projectId,
            role: "assistant",
            content: JSON.stringify(assistantBlocks),
            createdAt: new Date(),
          })
          .run();
        captureChatSnapshot(params.userId, params.projectId, assistantMessageId);
      }
      db.update(projects)
        .set({ updatedAt: new Date() })
        .where(eq(projects.id, params.projectId))
        .run();
    } catch (error) {
      captureException(error, {
        source: "api.chat",
        userId: params.userId,
        projectId: params.projectId,
      });
      write({ type: "error", message: (error as Error).message });
    } finally {
      state.done = true;
      for (const sub of [...state.subs]) sub.finish();
      setTimeout(() => {
        if (RUNS.get(params.key) === state) RUNS.delete(params.key);
      }, RUN_GRACE_MS);
    }
  })();

  return state;
}

export async function DELETE(req: Request) {
  const session = await requireServerSession().catch((r) => r);
  if (session instanceof Response) return session;
  const url = new URL(req.url);
  const projectId = url.searchParams.get("projectId");
  if (!projectId) return new Response("projectId required", { status: 400 });
  const key = `${session.user.id}:${projectId}`;
  const state = RUNS.get(key);
  if (!state) return new Response("not running", { status: 404 });
  state.controller.abort();
  return Response.json({ aborted: true });
}

// Resume/attach to an in-flight (or just-finished, within grace) run for this
// project. 204 when nothing is running — the client then just relies on the
// persisted history it already loaded.
export async function GET(req: Request) {
  const session = await requireServerSession().catch((r) => r);
  if (session instanceof Response) return session;
  const url = new URL(req.url);
  const projectId = url.searchParams.get("projectId");
  if (!projectId) return new Response("projectId required", { status: 400 });
  const key = `${session.user.id}:${projectId}`;
  const state = RUNS.get(key);
  if (!state) return new Response(null, { status: 204 });
  return streamRun(state, req.signal);
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
  const ALLOWED_KEYS = ["replicate", "elevenlabs", "anthropic"] as const;
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

  // Start the run DETACHED from this request: the agent executes and persists
  // independently, so closing the browser mid-run no longer loses the work.
  // This POST just attaches a viewer to the run's live event stream.
  const key = `${userId}:${projectId}`;
  const state = startRun({
    key,
    userId,
    projectId,
    userMessage,
    priorHistory,
    platform: owned.platform ?? undefined,
    aspectRatio: owned.aspectRatio ?? undefined,
    apiKeys: apiKeys as { replicate?: string; elevenlabs?: string; anthropic?: string },
  });

  return streamRun(state, req.signal);
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
