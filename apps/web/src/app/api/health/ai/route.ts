import { type NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TIMEOUT_MS = 15000;

// The chat UI probes this on every open. The probe makes a real (billed)
// Messages call through the agent proxy, so we cache the last result briefly:
// rapid re-opens / editor reloads reuse it instead of each hitting the proxy.
// A caller can force a live probe with `?fresh=1`.
const CACHE_TTL_MS = 30_000;

type ProbeResult = { payload: Record<string, unknown>; httpStatus: number };

let cached: { at: number; result: ProbeResult } | null = null;
let inflight: Promise<ProbeResult> | null = null;

async function probeAgent(): Promise<ProbeResult> {
  const start = Date.now();
  const baseURL = (process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com").replace(
    /\/$/,
    "",
  );
  const apiKey = process.env.ANTHROPIC_API_KEY || "";
  // Use the stable dated model ID for the raw Messages API call.
  // ANTHROPIC_MODEL env is the short alias used by the agent SDK, not the API.
  const model = "claude-sonnet-4-5-20250929";

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const response = await fetch(`${baseURL}/v1/messages`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 16,
        messages: [{ role: "user", content: "Reply with the word ONLINE only." }],
      }),
      signal: controller.signal,
    }).finally(() => clearTimeout(timer));

    const latencyMs = Date.now() - start;

    if (!response.ok) {
      const body = await response.text();
      return {
        httpStatus: 503,
        payload: {
          status: "error",
          agent: "offline",
          httpStatus: response.status,
          error: body.slice(0, 300),
          latencyMs,
          baseURL,
          timestamp: new Date().toISOString(),
        },
      };
    }

    const data = (await response.json()) as {
      model?: string;
      content?: Array<{ type: string; text?: string }>;
    };
    const text = data.content?.[0]?.type === "text" ? (data.content[0].text ?? "").trim() : "";

    return {
      httpStatus: 200,
      payload: {
        status: "ok",
        agent: "online",
        reply: text,
        latencyMs,
        model: data.model ?? model,
        baseURL,
        timestamp: new Date().toISOString(),
      },
    };
  } catch (error) {
    const latencyMs = Date.now() - start;
    const message =
      (error as Error).name === "AbortError"
        ? `timeout after ${TIMEOUT_MS}ms`
        : (error as Error).message;

    return {
      httpStatus: 503,
      payload: {
        status: "error",
        agent: "offline",
        error: message,
        latencyMs,
        baseURL,
        timestamp: new Date().toISOString(),
      },
    };
  }
}

export async function GET(request: NextRequest) {
  const fresh = request.nextUrl.searchParams.get("fresh") === "1";

  if (!fresh && cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return NextResponse.json(
      { ...cached.result.payload, cached: true, cachedAgeMs: Date.now() - cached.at },
      { status: cached.result.httpStatus },
    );
  }

  // Coalesce concurrent probes (e.g. two tabs opening chat at once) so only one
  // real call goes to the proxy.
  if (!inflight) {
    inflight = probeAgent().finally(() => {
      inflight = null;
    });
  }
  const result = await inflight;
  cached = { at: Date.now(), result };

  return NextResponse.json({ ...result.payload, cached: false }, { status: result.httpStatus });
}
