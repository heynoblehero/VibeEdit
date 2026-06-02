import { query } from "@anthropic-ai/claude-agent-sdk";
import { ALLOWED_TOOL_NAMES, MCP_SERVER_NAME, buildToolServer, type ToolContext } from "./tools";
import { buildSystemPrompt, type BrandKitContext } from "./system-prompt";
import { listFiles } from "../storage/fs";
import { db } from "@/lib/db";
import { creatorInsights, userPreferences, brandKits } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// First-draft compositions need the strongest planner; incremental edits
// route to Sonnet to cut cost ~3-4× without losing edit quality.
const FIRST_DRAFT_MODEL = "claude-opus-4-7";
const EDIT_MODEL = "claude-sonnet-4-6";
const MODEL_OVERRIDE = process.env.ANTHROPIC_MODEL;

function pickModel(userId: string, projectId: string): string {
  if (MODEL_OVERRIDE) return MODEL_OVERRIDE;
  try {
    const files = listFiles(userId, projectId);
    const hasComposition = files.some(
      (path) => path === "index.html" || path.endsWith("/index.html"),
    );
    return hasComposition ? EDIT_MODEL : FIRST_DRAFT_MODEL;
  } catch {
    return FIRST_DRAFT_MODEL;
  }
}

export type ToolResultImage = {
  data: string;
  mimeType: "image/png" | "image/jpeg";
};

export type AgentEvent =
  | { type: "text"; text: string }
  | { type: "tool_use"; name: string; input: Record<string, unknown>; id: string }
  | {
      type: "tool_result";
      tool_use_id: string;
      result: string;
      images?: ToolResultImage[];
    }
  | { type: "turn_end"; usage?: unknown }
  | { type: "done"; stop_reason: string }
  | { type: "error"; message: string };

type AssistantContentBlock = {
  type: string;
  text?: string;
  name?: string;
  input?: Record<string, unknown>;
  id?: string;
  tool_use_id?: string;
  content?: unknown;
};

type SdkMessage = {
  type: string;
  message?: { content?: AssistantContentBlock[] };
  result?: string;
  subtype?: string;
  usage?: unknown;
};

function loadUserInsights(userId: string): string | undefined {
  try {
    const rows = db.select().from(creatorInsights).where(eq(creatorInsights.userId, userId)).all();
    if (rows.length === 0) return undefined;
    return rows
      .sort((a, b) => b.confidence - a.confidence)
      .map((row) => `${row.key} (confidence ${row.confidence.toFixed(2)}): ${row.value}`)
      .join("\n");
  } catch {
    return undefined;
  }
}

function loadBrandKit(userId: string): BrandKitContext | undefined {
  try {
    const row = db.select().from(brandKits).where(eq(brandKits.userId, userId)).get();
    if (!row) return undefined;
    const hasAny =
      row.channelName ||
      row.primaryColor ||
      row.accentColor ||
      row.fontFamily ||
      row.hostName ||
      row.hostDescription ||
      row.toneVoice ||
      row.targetAudience ||
      row.logoPath ||
      row.watermarkPath;
    if (!hasAny) return undefined;
    return {
      channelName: row.channelName,
      primaryColor: row.primaryColor,
      accentColor: row.accentColor,
      fontFamily: row.fontFamily,
      hostName: row.hostName,
      hostDescription: row.hostDescription,
      toneVoice: row.toneVoice,
      targetAudience: row.targetAudience,
      logoPath: row.logoPath,
      watermarkPath: row.watermarkPath,
    };
  } catch {
    return undefined;
  }
}

function loadUserPrefs(userId: string): {
  niche?: string;
  formatPreference?: string;
  postFrequency?: string;
} {
  try {
    const row = db.select().from(userPreferences).where(eq(userPreferences.userId, userId)).get();
    return {
      niche: row?.niche ?? undefined,
      formatPreference: row?.formatPreference ?? undefined,
      postFrequency: row?.postFrequency ?? undefined,
    };
  } catch {
    return {};
  }
}

// Hard cap on tool-use turns per chat request. Complex compositions with
// many asset downloads + retries can burn through 30 turns before writing.
// 60 gives room for: plan + 10 download attempts + write + lint + screenshot.
const MAX_TURNS = 60;

export async function runAgent(opts: {
  userMessage: string;
  priorHistory?: string;
  ctx: ToolContext;
  onEvent: (event: AgentEvent) => void;
  abortController?: AbortController;
}): Promise<void> {
  // Defensive: never log raw keys server-side. They live on ctx.apiKeys for
  // this single run and never get serialized into messages/history.
  if (opts.ctx.apiKeys) {
    Object.freeze(opts.ctx.apiKeys);
  }
  const server = buildToolServer(opts.ctx);
  const prefix = opts.priorHistory
    ? `Prior conversation context:\n${opts.priorHistory}\n\nNew user message:\n`
    : "";
  const model = pickModel(opts.ctx.userId, opts.ctx.projectId);
  const insights = loadUserInsights(opts.ctx.userId);
  const prefs = loadUserPrefs(opts.ctx.userId);
  const brandKit = loadBrandKit(opts.ctx.userId);
  try {
    const byokKey = opts.ctx.apiKeys?.anthropic;
    const agentEnv: Record<string, string | undefined> = { ...process.env };
    if (byokKey) agentEnv.ANTHROPIC_API_KEY = byokKey;

    for await (const message of query({
      prompt: prefix + opts.userMessage,
      options: {
        systemPrompt: buildSystemPrompt({
          insights,
          brandKit,
          platform: opts.ctx.platform,
          aspectRatio: opts.ctx.aspectRatio,
          userNiche: prefs.niche,
          formatPreference: prefs.formatPreference,
          postFrequency: prefs.postFrequency,
        }),
        model,
        mcpServers: { [MCP_SERVER_NAME]: server },
        allowedTools: [...ALLOWED_TOOL_NAMES, "WebSearch", "WebFetch"],
        permissionMode: "bypassPermissions",
        maxTurns: MAX_TURNS,
        abortController: opts.abortController,
        env: agentEnv,
      },
    }) as AsyncIterable<SdkMessage>) {
      handle(message, opts.onEvent);
    }
    opts.onEvent({ type: "done", stop_reason: "end_turn" });
  } catch (error) {
    const message = (error as Error).message || "agent error";
    if (message.toLowerCase().includes("abort")) {
      opts.onEvent({ type: "done", stop_reason: "aborted" });
      return;
    }
    opts.onEvent({ type: "error", message });
    throw error;
  }
}

function handle(message: SdkMessage, emit: (event: AgentEvent) => void) {
  if (message.type === "assistant" && message.message?.content) {
    for (const block of message.message.content) {
      if (block.type === "text" && block.text) {
        emit({ type: "text", text: block.text });
      } else if (block.type === "tool_use" && block.name && block.id) {
        emit({
          type: "tool_use",
          name: stripMcpPrefix(block.name),
          input: block.input || {},
          id: block.id,
        });
      }
    }
  } else if (message.type === "user" && message.message?.content) {
    for (const block of message.message.content) {
      if (block.type === "tool_result" && block.tool_use_id) {
        let result = "";
        const images: ToolResultImage[] = [];
        if (typeof block.content === "string") {
          result = block.content;
        } else if (Array.isArray(block.content)) {
          const items = block.content as Array<{
            type?: string;
            text?: string;
            data?: string;
            mimeType?: string;
            source?: { data?: string; media_type?: string };
          }>;
          const textParts: string[] = [];
          for (const item of items) {
            if (item.type === "text" && item.text) {
              textParts.push(item.text);
            } else if (item.type === "image") {
              const data = item.data || item.source?.data;
              const mime =
                (item.mimeType as ToolResultImage["mimeType"]) ||
                (item.source?.media_type as ToolResultImage["mimeType"]) ||
                "image/png";
              if (data) images.push({ data, mimeType: mime });
            }
          }
          result = textParts.join("\n");
        } else {
          result = JSON.stringify(block.content);
        }
        emit({
          type: "tool_result",
          tool_use_id: block.tool_use_id,
          result,
          images: images.length ? images : undefined,
        });
      }
    }
  } else if (message.type === "result") {
    emit({ type: "turn_end", usage: message.usage });
  }
}

function stripMcpPrefix(name: string): string {
  const prefix = `mcp__${MCP_SERVER_NAME}__`;
  return name.startsWith(prefix) ? name.slice(prefix.length) : name;
}
