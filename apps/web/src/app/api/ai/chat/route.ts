import { NextRequest, NextResponse } from "next/server";
import { spawnClaude } from "@/lib/ai/claude-bridge";
import { buildSystemPrompt } from "@/lib/ai/system-prompt";
import { AI_RESPONSE_SCHEMA } from "@/lib/ai/schema";
import type { AIRequest } from "@/lib/ai/types";
import { logSecurity } from "@/lib/ai/security-log";
import { deductCredits, hasEnoughCredits } from "@/lib/credits";
import { getCreditCost } from "@/lib/credits/costs";
import { auth } from "@/lib/auth/server";
import { headers } from "next/headers";

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 20;
const RATE_WINDOW = 60_000;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW });
    return true;
  }
  entry.count++;
  return entry.count <= RATE_LIMIT;
}

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

    // CSRF protection: verify request comes from our own origin
    const origin = request.headers.get("origin");
    const host = request.headers.get("host") || "localhost:3001";
    const allowedOrigin = `http://${host}`;
    const allowedOriginHttps = `https://${host}`;

    if (origin && origin !== allowedOrigin && origin !== allowedOriginHttps) {
      logSecurity("error", "csrf_blocked", { ip, origin, endpoint: "/api/ai/chat" });
      return NextResponse.json({ error: "Forbidden: invalid origin" }, { status: 403 });
    }

    if (!checkRateLimit(ip)) {
      logSecurity("warn", "rate_limit_hit", { ip, endpoint: "/api/ai/chat" });
      return NextResponse.json(
        { error: "Too many requests. Try again later." },
        { status: 429 }
      );
    }

    const session = await auth.api.getSession({ headers: await headers() });
    const userId = session?.user?.id || "anonymous";
    const chatCost = getCreditCost("ai_message");
    if (chatCost > 0) {
      const hasCredits = hasEnoughCredits(userId, chatCost);
      if (!hasCredits) {
        return NextResponse.json(
          { error: "No credits remaining. Purchase more credits to continue.", text: "", actions: [], sessionId: "" },
          { status: 402 }
        );
      }
    }

    const body = (await request.json()) as AIRequest;
    const { message, sessionId, editorContext } = body;

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    if (message.length > 10000) {
      return NextResponse.json(
        { error: "Message too long (max 10000 chars)" },
        { status: 400 }
      );
    }

    logSecurity("info", "ai_chat_request", { ip, messageLength: message.length });

    const systemPrompt = buildSystemPrompt(editorContext);
    const schemaJson = JSON.stringify(AI_RESPONSE_SCHEMA, null, 2);

    const cliResult = await spawnClaude(
      systemPrompt,
      message,
      schemaJson,
      sessionId
    );

    // Extract actions — prefer structured_output (from --json-schema), fall back to parsing result text
    let actions: Array<{ tool: string; params: Record<string, unknown> }> = [];
    let text = cliResult.result || "";

    if (cliResult.structured_output) {
      actions = cliResult.structured_output.actions || [];
      text = cliResult.structured_output.message || text;
      console.log(`[AI] structured_output: ${actions.length} actions`);
    } else {
      console.log(`[AI] No structured_output, parsing result text (${text.length} chars)`);
      let jsonStr = cliResult.result;
      const codeBlockMatch = jsonStr.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
      if (codeBlockMatch) {
        jsonStr = codeBlockMatch[1].trim();
      }
      if (jsonStr.length > 100000) {
        text = "Response was too large to process.";
      } else {
        try {
          const parsed = JSON.parse(jsonStr);
          if (typeof parsed.message === "string") text = parsed.message;
          if (Array.isArray(parsed.actions)) {
            actions = parsed.actions
              .filter(
                (a: unknown) =>
                  a &&
                  typeof a === "object" &&
                  typeof (a as Record<string, unknown>).tool === "string" &&
                  typeof (a as Record<string, unknown>).params === "object" &&
                  (a as Record<string, unknown>).params !== null
              )
              .slice(0, 20);
          }
        } catch {
          console.warn(`[AI] Failed to parse result as JSON, treating as plain text`);
        }
      }
    }

    if (actions.length === 0) {
      console.warn(`[AI] No actions extracted from response for message: "${message.slice(0, 80)}"`);
    } else {
      console.log(`[AI] Executing ${actions.length} actions: ${actions.map(a => a.tool).join(", ")}`);
    }

    // Deduct credits for the chat message
    if (chatCost > 0) {
      deductCredits(userId, chatCost, "ai_message", `AI chat: "${message.slice(0, 50)}..."`);
    }

    // Also deduct for any paid actions in the response
    for (const action of actions) {
      const actionCost = getCreditCost(action.tool);
      if (actionCost > 0) {
        deductCredits(userId, actionCost, action.tool, `AI action: ${action.tool}`);
      }
    }

    return NextResponse.json({
      text,
      actions,
      sessionId: cliResult.session_id || sessionId || "",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("AI chat error:", message);

    if (message.includes("Failed to spawn")) {
      return NextResponse.json(
        {
          error:
            "Claude CLI not found. Make sure 'claude' is installed and in PATH.",
          text: "",
          actions: [],
          sessionId: "",
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: message, text: "", actions: [], sessionId: "" },
      { status: 500 }
    );
  }
}
