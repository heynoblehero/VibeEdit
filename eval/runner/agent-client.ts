/**
 * SSE client for /api/agent. Mirrors the streaming-event handling in
 * src/components/editor/ChatSidebar.tsx:428-475 but collects events
 * into a structured trace instead of dispatching them to the UI.
 *
 * The harness uses one of these per case: build the request body,
 * await invoke(), assert against the returned trace.
 */

import type { Project } from "../../src/lib/scene-schema";

export interface ToolCallTrace {
  id: string;
  name: string;
  args: Record<string, unknown>;
  ok?: boolean;
  message?: string;
}

export interface ManualEditLogEntry {
  sceneId: string;
  sceneIndex: number;
  field: string;
  oldValue: string | number | null;
  newValue: string | number | null;
  at: number;
}

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface AgentInvokeArgs {
  /** Server base URL — default localhost:3000 for local dev. */
  baseUrl?: string;
  messages: ChatTurn[];
  project: Project;
  characters?: unknown[];
  sfx?: unknown[];
  focusedSceneId?: string | null;
  recentManualEdits?: ManualEditLogEntry[];
  /** Hard timeout in ms — abort the SSE if the agent doesn't finish. */
  timeoutMs?: number;
}

export interface AgentInvokeResult {
  /** All tool_start events, in order. ok/message filled when the
   *  matching tool_result arrives. */
  toolCalls: ToolCallTrace[];
  /** Concatenated assistant text across all rounds. */
  text: string;
  /** Final project from the `done` event, or null if the agent errored. */
  finalProject: Project | null;
  /** Any error event payload. */
  error: string | null;
  /** Wall-clock duration of the SSE stream, ms. */
  durationMs: number;
  /** Did we hit the timeout. */
  timedOut: boolean;
}

const DEFAULT_BASE = "http://localhost:3000";
const DEFAULT_TIMEOUT_MS = 5 * 60_000; // 5 min — agent loop is bounded to 32 rounds

export async function invokeAgent(
  args: AgentInvokeArgs,
): Promise<AgentInvokeResult> {
  const base = args.baseUrl ?? DEFAULT_BASE;
  const timeoutMs = args.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  const t0 = Date.now();

  const result: AgentInvokeResult = {
    toolCalls: [],
    text: "",
    finalProject: null,
    error: null,
    durationMs: 0,
    timedOut: false,
  };

  try {
    const res = await fetch(`${base}/api/agent`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: args.messages,
        project: args.project,
        characters: args.characters ?? [],
        sfx: args.sfx ?? [],
        focusedSceneId: args.focusedSceneId ?? null,
        recentManualEdits: args.recentManualEdits ?? [],
      }),
      signal: ac.signal,
    });

    if (!res.ok || !res.body) {
      const data = await res.json().catch(() => ({}));
      result.error = (data as { error?: string }).error ?? `agent failed (${res.status})`;
      return result;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buffer.indexOf("\n\n")) >= 0) {
        const frame = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        const line = frame.split("\n").find((l) => l.startsWith("data: "));
        if (!line) continue;
        const payload = line.slice("data: ".length);
        let evt: Record<string, unknown>;
        try {
          evt = JSON.parse(payload);
        } catch {
          continue;
        }
        if (evt.type === "text" && typeof evt.text === "string") {
          result.text += evt.text;
        } else if (evt.type === "tool_start") {
          result.toolCalls.push({
            id: String(evt.id ?? Math.random()),
            name: String(evt.name ?? "unknown"),
            args: (evt.args as Record<string, unknown>) ?? {},
          });
        } else if (evt.type === "tool_result") {
          const id = String(evt.id ?? "");
          const tc = result.toolCalls.find((c) => c.id === id);
          if (tc) {
            tc.ok = Boolean(evt.ok);
            tc.message = String(evt.message ?? "");
          }
        } else if (evt.type === "done" && evt.project) {
          result.finalProject = evt.project as Project;
        } else if (evt.type === "error") {
          result.error = String(evt.error ?? "agent error");
        }
      }
    }
  } catch (e) {
    if (ac.signal.aborted) {
      result.timedOut = true;
      result.error = `timeout after ${timeoutMs}ms`;
    } else {
      result.error = e instanceof Error ? e.message : String(e);
    }
  } finally {
    clearTimeout(timer);
    result.durationMs = Date.now() - t0;
  }

  return result;
}
