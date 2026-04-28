import type { Project } from "@/lib/scene-schema";

/**
 * Pure action over Project state. Same handler can run on the server
 * (agent route, mutates ctx.project) or on the client (Zustand store,
 * via setProject). One source of truth for every "thing the user can
 * do" — replaces the parallel UI-store-actions vs agent-tools split.
 */
export interface ActionResult {
  ok: boolean;
  /** Human-readable summary of what changed. Surfaced in agent
   *  conversation, also goes into project.agentLog. */
  message: string;
  /** Updated project. Always returned (even on no-op) so callers can
   *  unconditionally apply it. When ok=false, project is unchanged. */
  project: Project;
  /** Optional: for tools that need to surface a payload to the agent
   *  beyond a message — e.g. inspectScene returns the scene JSON,
   *  renderPreviewFrame returns base64 PNG. Free-form. */
  data?: unknown;
}

export interface Action<Args extends Record<string, unknown> = Record<string, unknown>> {
  /** Canonical dotted name, e.g. "scene.update", "music.set". */
  name: string;
  /** One-line summary surfaced to the agent's dispatchAction tool. */
  description: string;
  /** Best-effort runtime validation of args. Returns null when valid,
   *  an error string otherwise. Don't bother with deep type checks
   *  here — Claude's tool input_schema already covers most of that. */
  validate?: (args: Args) => string | null;
  /** Pure handler: returns the new project + a result. Do NOT mutate
   *  the input project. */
  handler: (project: Project, args: Args) => ActionResult;
}

export type AnyAction = Action<Record<string, unknown>>;
