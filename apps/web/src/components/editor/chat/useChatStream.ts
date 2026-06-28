"use client";

import { useCallback, useRef, useState } from "react";
import {
  type AgentEvent,
  type LiveEntry,
  extractVariants,
  summarizeToolInput,
  truncate,
} from "./types";

// Broadcasts the agent's working state to the rest of the editor (Preview
// overlay, "Saved" pulse). Kept identical to the prior inline dispatch so those
// listeners behave exactly as before.
function dispatchAgentStatus(working: boolean, label?: string) {
  window.dispatchEvent(
    new CustomEvent("vibeedit:agent-status", {
      detail: label === undefined ? { working } : { working, label },
    }),
  );
}

// Client-side fallback labels for the live activity indicator when a tool_start
// event (which carries a server-computed `label`) is absent — e.g. an older
// server that only emits tool_use. Mirrors a subset of the server map; unknown
// names are humanized so new tools still read sensibly.
const FALLBACK_TOOL_LABELS: Record<string, string> = {
  plan_composition: "Planning the composition",
  plan_edit: "Planning the edit",
  write_file: "Writing the composition",
  diff_file: "Editing the composition",
  search_media: "Searching b-roll",
  find_stock: "Finding stock media",
  generate_image: "Generating an image",
  generate_voiceover: "Recording the voiceover",
  render_edl: "Rendering",
  start_render: "Starting the render",
};

function fallbackLabel(name: string): string {
  return (
    FALLBACK_TOOL_LABELS[name] ?? name.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase())
  );
}

export type ChatStream = {
  busy: boolean;
  live: LiveEntry[];
  // Human-readable description of what the agent is doing right now (e.g.
  // "Searching b-roll…"), or null when idle / between tools. Driven by the
  // structured tool_start / tool_end lifecycle events, falling back to legacy
  // tool_use events so it works even if those events never arrive.
  activity: string | null;
  /**
   * Streams one agent turn for `userMessage`. Resolves when the SSE stream
   * closes. Returns false if the request never started (so the caller can skip
   * a history reload), true otherwise.
   */
  runStream: (projectId: string, userMessage: string) => Promise<boolean>;
};

export function useChatStream(): ChatStream {
  const [busy, setBusy] = useState(false);
  const [live, setLive] = useState<LiveEntry[]>([]);
  const [activity, setActivity] = useState<string | null>(null);
  // Tracks the most recent content written to each path so the inline write_file
  // bubble can show a +/- diff against the prior version within a single turn.
  const fileHistoryRef = useRef<Map<string, string>>(new Map());
  // Count of in-flight tools, so the indicator only clears once everything the
  // agent kicked off this beat has resolved.
  const inFlightRef = useRef(0);

  const handleEvent = useCallback((event: AgentEvent) => {
    // Structured lifecycle events drive the live activity indicator. They are
    // additive — the tool log below is still built from tool_use / tool_result.
    if (event.type === "tool_start") {
      if (event.name === "suggest_next_steps") return;
      inFlightRef.current += 1;
      setActivity(event.label || fallbackLabel(event.name));
      return;
    }
    if (event.type === "tool_end") {
      inFlightRef.current = Math.max(0, inFlightRef.current - 1);
      if (inFlightRef.current === 0) setActivity(null);
      return;
    }

    // suggest_next_steps is surfaced as one-tap chips, not as a tool-log line.
    if (event.type === "tool_use" && event.name === "suggest_next_steps") return;
    if (event.type === "text") {
      setLive((l) => [...l, { kind: "text", text: event.text }]);
    } else if (event.type === "tool_use") {
      // Legacy status broadcast (raw tool name) kept for back-compat, but the
      // friendly label is what the Preview overlay now shows.
      dispatchAgentStatus(true, fallbackLabel(event.name));
      // Fallback for servers that don't emit tool_start: still show activity.
      if (inFlightRef.current === 0) setActivity(fallbackLabel(event.name));
      let prevContent: string | undefined;
      if (
        event.name === "write_file" &&
        typeof event.input.path === "string" &&
        typeof event.input.content === "string"
      ) {
        prevContent = fileHistoryRef.current.get(event.input.path);
        fileHistoryRef.current.set(event.input.path, event.input.content as string);
      }
      setLive((l) => [
        ...l,
        {
          kind: "tool",
          name: event.name,
          inputSummary: summarizeToolInput(event.name, event.input),
          input: event.input,
          prevContent,
        },
      ]);
    } else if (event.type === "tool_result") {
      setLive((l) => {
        const next = [...l];
        for (let i = next.length - 1; i >= 0; i--) {
          const entry = next[i];
          if (entry.kind === "tool" && !entry.result) {
            const variants = extractVariants(event.result);
            next[i] = {
              ...entry,
              result: truncate(event.result, 240),
              images: event.images,
              variants: variants || undefined,
            };
            return next;
          }
        }
        return next;
      });
    } else if (event.type === "error") {
      setLive((l) => [...l, { kind: "error", message: event.message }]);
    }
  }, []);

  const runStream = useCallback(
    async (projectId: string, userMessage: string): Promise<boolean> => {
      setBusy(true);
      setLive([]);
      setActivity(null);
      inFlightRef.current = 0;
      dispatchAgentStatus(true, "thinking");

      const { getAllApiKeys } = await import("@/lib/api-keys/store");
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          projectId,
          message: userMessage,
          apiKeys: getAllApiKeys(),
        }),
      });
      if (!response.ok || !response.body) {
        let message = `error: ${response.statusText}`;
        if (response.status === 402) {
          // Graceful paywall: show the server's friendly upgrade copy, not "Payment Required".
          const body = (await response.json().catch(() => null)) as {
            title?: string;
            message?: string;
          } | null;
          message =
            body?.message || body?.title || "You've hit your plan limit — upgrade to continue.";
        }
        setLive([{ kind: "error", message }]);
        setBusy(false);
        setActivity(null);
        dispatchAgentStatus(false);
        return false;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      // Cap the inter-chunk buffer so a misbehaving server can't push us into
      // unbounded memory by streaming without a terminator. 1 MiB is already
      // 10× larger than any legitimate single SSE frame here.
      const MAX_BUFFER = 1024 * 1024;
      let buffer = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        if (buffer.length > MAX_BUFFER) {
          buffer = buffer.slice(-MAX_BUFFER);
        }
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";
        for (const block of lines) {
          const dataLine = block.split("\n").find((line) => line.startsWith("data:"));
          if (!dataLine) continue;
          const payload = dataLine.slice(5).trim();
          if (payload === "[DONE]") continue;
          try {
            const event = JSON.parse(payload) as AgentEvent;
            handleEvent(event);
          } catch {
            /* ignore */
          }
        }
      }
      setBusy(false);
      setLive([]);
      setActivity(null);
      dispatchAgentStatus(false);
      return true;
    },
    [handleEvent],
  );

  return { busy, live, activity, runStream };
}
