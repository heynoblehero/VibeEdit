"use client";

import { useCallback, useRef, useState } from "react";
import { isPaywall, type PaywallData } from "@/components/Paywall";
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
  list_scenes: "Mapping the scenes",
  read_scene: "Reading a scene",
  edit_scene: "Editing a scene",
  delegate_scenes: "Assembling the team",
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

// One scene handed to the team by the lead's delegate_scenes call.
export type DelegatedScene = { sceneId: string; name: string; brief: string };

export type ChatStream = {
  busy: boolean;
  live: LiveEntry[];
  // Human-readable description of what the agent is doing right now (e.g.
  // "Searching b-roll…"), or null when idle / between tools. Driven by the
  // structured tool_start / tool_end lifecycle events, falling back to legacy
  // tool_use events so it works even if those events never arrive.
  activity: string | null;
  // Per-lane "what's happening now" during a parallel batch (Phase 2b): keyed by
  // scene lane (e.g. "scene-1"), value is the current activity label or null.
  // Empty on ordinary single-agent runs.
  laneActivity: Record<string, string | null>;
  // Set when the server returns a 402 with a structured paywall payload (out of
  // credits / plan limit). The UI shows the full upgrade popup; null otherwise.
  paywall: PaywallData | null;
  dismissPaywall: () => void;
  /**
   * Streams one agent turn for `userMessage`. Resolves when the SSE stream
   * closes. Returns false if the request never started (so the caller can skip
   * a history reload), true otherwise.
   */
  runStream: (projectId: string, userMessage: string, sceneId?: string | null) => Promise<boolean>;
  /**
   * Run several scene-targeted instructions CONCURRENTLY (Phase 2b). Streams one
   * SSE connection whose events are lane-tagged; resolves when the batch closes.
   */
  runBatch: (
    projectId: string,
    items: Array<{ message: string; sceneHint?: string | number; sceneId?: string | null }>,
  ) => Promise<boolean>;
  /**
   * Reattach to an agent run that's still executing server-side for this project
   * (e.g. after the user closed and reopened the tab mid-build). Replays what's
   * happened so far then streams live. Returns true if a run was attached (so
   * the caller reloads history when it finishes), false if nothing was running.
   */
  resumeStream: (projectId: string) => Promise<boolean>;
  /**
   * If the run just observed a `delegate_scenes` call from the lead agent, returns
   * (and clears) the scenes to fan out as a parallel build batch — else null.
   */
  takePendingDelegation: () => DelegatedScene[] | null;
};

export function useChatStream(): ChatStream {
  const [busy, setBusy] = useState(false);
  const [live, setLive] = useState<LiveEntry[]>([]);
  const [activity, setActivity] = useState<string | null>(null);
  const [laneActivity, setLaneActivity] = useState<Record<string, string | null>>({});
  // Per-lane in-flight tool count, so a lane's activity clears only once all its
  // tools have resolved (mirrors inFlightRef for the default, unlaned run).
  const laneInFlightRef = useRef<Record<string, number>>({});
  const [paywall, setPaywall] = useState<PaywallData | null>(null);
  // Tracks the most recent content written to each path so the inline write_file
  // bubble can show a +/- diff against the prior version within a single turn.
  const fileHistoryRef = useRef<Map<string, string>>(new Map());
  // Count of in-flight tools, so the indicator only clears once everything the
  // agent kicked off this beat has resolved.
  const inFlightRef = useRef(0);
  // Scenes the lead handed to the team via delegate_scenes this run; the caller
  // drains them into a parallel build batch once the lead's turn finishes.
  const pendingDelegationRef = useRef<DelegatedScene[] | null>(null);

  const handleEvent = useCallback((event: AgentEvent) => {
    // Structured lifecycle events drive the live activity indicator. They are
    // additive — the tool log below is still built from tool_use / tool_result.
    if (event.type === "tool_start") {
      if (event.name === "suggest_next_steps") return;
      const label = event.label || fallbackLabel(event.name);
      if (event.lane) {
        const lane = event.lane;
        laneInFlightRef.current[lane] = (laneInFlightRef.current[lane] ?? 0) + 1;
        setLaneActivity((prev) => ({ ...prev, [lane]: label }));
      } else {
        inFlightRef.current += 1;
        setActivity(label);
      }
      return;
    }
    if (event.type === "tool_end") {
      if (event.lane) {
        const lane = event.lane;
        const next = Math.max(0, (laneInFlightRef.current[lane] ?? 0) - 1);
        laneInFlightRef.current[lane] = next;
        if (next === 0) setLaneActivity((prev) => ({ ...prev, [lane]: null }));
      } else {
        inFlightRef.current = Math.max(0, inFlightRef.current - 1);
        if (inFlightRef.current === 0) setActivity(null);
      }
      return;
    }

    // The lead delegating scenes to the team — capture the scene list so the
    // caller can fan them out into a parallel build batch when this run ends.
    if (event.type === "tool_use" && event.name === "delegate_scenes") {
      const scenes = (event.input as { scenes?: unknown }).scenes;
      if (Array.isArray(scenes)) {
        pendingDelegationRef.current = scenes.filter(
          (s): s is DelegatedScene =>
            !!s &&
            typeof (s as DelegatedScene).sceneId === "string" &&
            typeof (s as DelegatedScene).brief === "string",
        );
      }
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
      // Fallback for servers that don't emit tool_start: still show activity,
      // routed to the event's lane during a parallel batch.
      if (event.lane) {
        const lane = event.lane;
        if ((laneInFlightRef.current[lane] ?? 0) === 0)
          setLaneActivity((prev) => ({ ...prev, [lane]: fallbackLabel(event.name) }));
      } else if (inFlightRef.current === 0) {
        setActivity(fallbackLabel(event.name));
      }
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

  // Parse an SSE response body, dispatching each event through handleEvent until
  // the stream closes. Shared by runStream (POST) and resumeStream (GET).
  const consume = useCallback(
    async (body: ReadableStream<Uint8Array>): Promise<void> => {
      const reader = body.getReader();
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
    },
    [handleEvent],
  );

  // Shared POST + SSE-consume lifecycle for both a single message and a parallel
  // batch — the only difference is the request body.
  const runRequest = useCallback(
    async (payload: Record<string, unknown>): Promise<boolean> => {
      setBusy(true);
      setLive([]);
      setActivity(null);
      setLaneActivity({});
      laneInFlightRef.current = {};
      inFlightRef.current = 0;
      pendingDelegationRef.current = null;
      dispatchAgentStatus(true, "thinking");

      const { getAllApiKeys } = await import("@/lib/api-keys/store");
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...payload, apiKeys: getAllApiKeys() }),
      });
      if (!response.ok || !response.body) {
        let message = `error: ${response.statusText}`;
        if (response.status === 402) {
          // Graceful paywall: show the full upgrade popup when the server sends a
          // structured payload, and a friendly inline line either way.
          const body = (await response.json().catch(() => null)) as unknown;
          if (isPaywall(body)) setPaywall(body);
          const info = body as { title?: string; message?: string } | null;
          message =
            info?.message || info?.title || "You've hit your plan limit — upgrade to continue.";
        }
        setLive([{ kind: "error", message }]);
        setBusy(false);
        setActivity(null);
        setLaneActivity({});
        dispatchAgentStatus(false);
        return false;
      }

      await consume(response.body);
      setBusy(false);
      setLive([]);
      setActivity(null);
      setLaneActivity({});
      dispatchAgentStatus(false);
      return true;
    },
    [consume],
  );

  const runStream = useCallback(
    (projectId: string, userMessage: string, sceneId?: string | null): Promise<boolean> =>
      runRequest({ projectId, message: userMessage, sceneId: sceneId ?? undefined }),
    [runRequest],
  );

  const runBatch = useCallback(
    (
      projectId: string,
      items: Array<{ message: string; sceneHint?: string | number; sceneId?: string | null }>,
    ): Promise<boolean> => runRequest({ projectId, batch: items }),
    [runRequest],
  );

  const resumeStream = useCallback(
    async (projectId: string): Promise<boolean> => {
      // 204 = nothing running for this project → caller keeps its loaded history.
      let response: Response;
      try {
        response = await fetch(`/api/chat?projectId=${encodeURIComponent(projectId)}`);
      } catch {
        return false;
      }
      if (response.status === 204 || !response.ok || !response.body) return false;

      // A run is live — mirror runStream's UI lifecycle so the reconnected tab
      // shows the in-progress activity, then reloads history on completion.
      setBusy(true);
      setLive([]);
      setActivity(null);
      setLaneActivity({});
      laneInFlightRef.current = {};
      inFlightRef.current = 0;
      dispatchAgentStatus(true, "thinking");
      await consume(response.body);
      setBusy(false);
      setLive([]);
      setActivity(null);
      setLaneActivity({});
      dispatchAgentStatus(false);
      return true;
    },
    [consume],
  );

  return {
    busy,
    live,
    activity,
    laneActivity,
    paywall,
    dismissPaywall: () => setPaywall(null),
    runStream,
    runBatch,
    resumeStream,
    takePendingDelegation: () => {
      const scenes = pendingDelegationRef.current;
      pendingDelegationRef.current = null;
      return scenes;
    },
  };
}
