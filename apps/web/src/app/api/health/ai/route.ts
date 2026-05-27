import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TIMEOUT_MS = 15000;

export async function GET() {
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
      return NextResponse.json(
        {
          status: "error",
          agent: "offline",
          httpStatus: response.status,
          error: body.slice(0, 300),
          latencyMs,
          baseURL,
          timestamp: new Date().toISOString(),
        },
        { status: 503 },
      );
    }

    const data = (await response.json()) as {
      model?: string;
      content?: Array<{ type: string; text?: string }>;
    };
    const text = data.content?.[0]?.type === "text" ? (data.content[0].text ?? "").trim() : "";

    return NextResponse.json({
      status: "ok",
      agent: "online",
      reply: text,
      latencyMs,
      model: data.model ?? model,
      baseURL,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const latencyMs = Date.now() - start;
    const message =
      (error as Error).name === "AbortError"
        ? `timeout after ${TIMEOUT_MS}ms`
        : (error as Error).message;

    return NextResponse.json(
      {
        status: "error",
        agent: "offline",
        error: message,
        latencyMs,
        baseURL,
        timestamp: new Date().toISOString(),
      },
      { status: 503 },
    );
  }
}
