// Shared chat types + small pure helpers, extracted from Chat.tsx without any
// behavior change. These are the wire/UI shapes used across the chat thread,
// the streaming hook, and the message/tool renderers.

export type ContentBlock =
  | { type: "text"; text: string }
  | {
      type: "tool_use";
      id: string;
      name: string;
      input: Record<string, unknown>;
    }
  | {
      type: "tool_result";
      tool_use_id: string;
      content?: string;
      images?: Array<{ data: string; mimeType: string }>;
    };

export type ChatMessage = {
  id?: string;
  role: "user" | "assistant";
  content: string | ContentBlock[];
  // Set on assistant turns that produced a new composition version. Drives the
  // inline per-version player so users can scroll back and replay past versions.
  snapshotId?: string | null;
};

export type AspectRatio = "16:9" | "9:16" | "1:1";

// Mirrors AgentEvent in lib/ai/agent.ts (the SSE wire protocol). tool_start /
// tool_end are the structured tool-lifecycle events; everything else is the
// pre-existing protocol. Unknown event types are ignored by the consumer, so
// the stream degrades gracefully if the server emits something newer.
export type AgentEvent =
  | { type: "text"; text: string }
  | { type: "tool_use"; name: string; input: Record<string, unknown>; id: string }
  | {
      type: "tool_result";
      tool_use_id: string;
      result: string;
      images?: Array<{ data: string; mimeType: string }>;
    }
  | { type: "tool_start"; id: string; name: string; label: string }
  | { type: "tool_end"; id: string; name: string; ok: boolean }
  | { type: "turn_end"; usage?: Record<string, unknown> }
  | { type: "done"; stop_reason: string }
  | { type: "error"; message: string };

export type VariantInfo = {
  sceneSlug: string;
  dir: string;
  targetPath: string;
  paths: string[];
};

export type LiveEntry =
  | { kind: "text"; text: string }
  | {
      kind: "tool";
      name: string;
      inputSummary: string;
      input?: Record<string, unknown>;
      result?: string;
      images?: Array<{ data: string; mimeType: string }>;
      variants?: VariantInfo;
      prevContent?: string;
    }
  | { kind: "error"; message: string };

export function extractVariants(result: string): VariantInfo | null {
  const match = result.match(/<variants>([\s\S]*?)<\/variants>/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[1]) as VariantInfo;
    if (
      !parsed ||
      typeof parsed.sceneSlug !== "string" ||
      typeof parsed.targetPath !== "string" ||
      !Array.isArray(parsed.paths) ||
      parsed.paths.length === 0
    )
      return null;
    return parsed;
  } catch {
    return null;
  }
}

// Pulls the agent's end-of-turn next-step suggestions out of the last assistant
// message's suggest_next_steps tool call, to render as one-tap follow-up chips.
export function extractNextSteps(message: ChatMessage | undefined): string[] {
  if (!message || typeof message.content === "string") return [];
  for (const block of message.content) {
    if (block.type === "tool_use" && block.name === "suggest_next_steps") {
      const raw = (block.input as { suggestions?: unknown }).suggestions;
      if (Array.isArray(raw)) {
        return raw
          .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
          .slice(0, 4);
      }
    }
  }
  return [];
}

export function summarizeToolInput(name: string, input: Record<string, unknown>): string {
  if (name === "write_file") {
    const path = String(input.path || "");
    const len = String(input.content || "").length;
    return `${path}, ${len}B`;
  }
  if (name === "read_file" || name === "read_registry_block") {
    return String(input.path || input.name || "");
  }
  const entries = Object.entries(input);
  if (!entries.length) return "";
  return entries.map(([k, v]) => `${k}=${truncate(String(v).replace(/\s+/g, " "), 30)}`).join(", ");
}

export function truncate(text: string, n: number): string {
  return text.length > n ? text.slice(0, n) + "…" : text;
}
