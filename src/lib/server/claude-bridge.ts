/**
 * Claude-Code-as-backend bridge.
 *
 * Lets the dev-mode app run without an ANTHROPIC_API_KEY. Every Claude call
 * goes through callClaude(). In bridge mode the request is written to
 * .ai-bridge/pending/<id>.json and the route long-polls .ai-bridge/done/<id>.json.
 * The Claude Code session running alongside fills in the response. The shape
 * we return is the same as api.anthropic.com/v1/messages so routes don't have
 * to branch on mode.
 */
import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { applyStoredKeys } from "@/lib/server/runtime-keys";

export interface ClaudeContentBlock {
  type: string;
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  source?: { type: "url" | "base64"; url?: string; data?: string; media_type?: string };
}

export interface ClaudeResponse {
  id: string;
  type: "message";
  role: "assistant";
  model: string;
  content: ClaudeContentBlock[];
  stop_reason: string | null;
  stop_sequence: string | null;
  usage?: { input_tokens?: number; output_tokens?: number };
}

export function isBridgeMode(): boolean {
  if (process.env.USE_LOCAL_BRIDGE === "true") return true;
  // Implicit bridge: if no real key is set, fall through to the bridge rather
  // than fail with 503.
  if (!process.env.ANTHROPIC_API_KEY) return true;
  return false;
}

const BRIDGE_DIR = path.join(process.cwd(), ".ai-bridge");
const PENDING_DIR = path.join(BRIDGE_DIR, "pending");
const DONE_DIR = path.join(BRIDGE_DIR, "done");
const ERROR_DIR = path.join(BRIDGE_DIR, "error");

async function ensureDirs() {
  await fs.mkdir(PENDING_DIR, { recursive: true });
  await fs.mkdir(DONE_DIR, { recursive: true });
  await fs.mkdir(ERROR_DIR, { recursive: true });
}

async function writeAtomic(filePath: string, contents: string): Promise<void> {
  // Write to a sibling tmp file then rename, so the reader never sees a half
  // written JSON blob.
  const tmp = `${filePath}.tmp`;
  await fs.writeFile(tmp, contents, "utf8");
  await fs.rename(tmp, filePath);
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

const POLL_INTERVAL_MS = 500;
// 120s default — long enough for a Claude Code session that's actively
// watching to answer, short enough to fail fast if no one's home.
const BRIDGE_TIMEOUT_MS = Number(process.env.BRIDGE_TIMEOUT_MS ?? 120 * 1000);

async function waitForResponse(id: string): Promise<ClaudeResponse> {
  const donePath = path.join(DONE_DIR, `${id}.json`);
  const errorPath = path.join(ERROR_DIR, `${id}.json`);
  const started = Date.now();
  while (Date.now() - started < BRIDGE_TIMEOUT_MS) {
    if (await pathExists(errorPath)) {
      const raw = await fs.readFile(errorPath, "utf8");
      const parsed = JSON.parse(raw) as { error: string };
      throw new Error(parsed.error ?? "bridge error");
    }
    if (await pathExists(donePath)) {
      const raw = await fs.readFile(donePath, "utf8");
      // Keep the done file around for audit — the Claude Code session can
      // clean up stale ones periodically.
      return JSON.parse(raw) as ClaudeResponse;
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  throw new Error(
    `Claude Code backend didn't respond in ${Math.round(BRIDGE_TIMEOUT_MS / 1000)}s. Start a session that watches .ai-bridge/pending/, or set ANTHROPIC_API_KEY to call the real API.`,
  );
}

async function callClaudeViaBridge(
  body: Record<string, unknown>,
  label: string,
): Promise<ClaudeResponse> {
  await ensureDirs();
  const id = randomUUID();
  const pendingPath = path.join(PENDING_DIR, `${id}.json`);
  // Drop stream: true — the bridge is strictly request/response. Streaming
  // callers synthesize SSE from the full response.
  const { stream: _stream, ...bodyNoStream } = body as { stream?: unknown } & Record<string, unknown>;
  void _stream;
  const envelope = {
    id,
    label,
    createdAt: new Date().toISOString(),
    request: bodyNoStream,
  };
  await writeAtomic(pendingPath, JSON.stringify(envelope, null, 2));
  const response = await waitForResponse(id);
  // Best-effort: remove the pending file now that we have a response.
  await fs.rm(pendingPath, { force: true });
  return response;
}

async function callClaudeViaApi(
  body: Record<string, unknown>,
): Promise<ClaudeResponse> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");
  const { stream: _stream, ...bodyNoStream } = body as { stream?: unknown } & Record<string, unknown>;
  void _stream;
  // ANTHROPIC_BASE_URL lets us point at a local Claude-Code-subscription
  // proxy (e.g. CLIProxyAPI) without code changes. Strip a trailing slash so
  // both "http://host:8317" and "http://host:8317/" work.
  const base = (process.env.ANTHROPIC_BASE_URL ?? "https://api.anthropic.com").replace(/\/$/, "");
  const res = await fetch(`${base}/v1/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(bodyNoStream),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Claude API ${res.status}: ${text.slice(0, 300)}`);
  }
  return (await res.json()) as ClaudeResponse;
}

/**
 * Make a request against Claude. Same return shape as api.anthropic.com/v1/messages.
 * `label` is a short descriptor (e.g. "agent", "script") shown to the Claude
 * Code bridge operator so they know what they're answering.
 */
export async function callClaude(
  body: Record<string, unknown>,
  label: string,
): Promise<ClaudeResponse> {
  // Pull in user-pasted keys before any provider call. Idempotent.
  applyStoredKeys();
  if (isBridgeMode()) return callClaudeViaBridge(body, label);
  return callClaudeViaApi(body);
}
