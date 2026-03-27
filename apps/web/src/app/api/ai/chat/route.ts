import { NextRequest, NextResponse } from "next/server";
import { spawnClaude } from "@/lib/ai/claude-bridge";
import { buildSystemPrompt } from "@/lib/ai/system-prompt";
import { AI_RESPONSE_SCHEMA } from "@/lib/ai/schema";
import type { AIRequest } from "@/lib/ai/types";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as AIRequest;
    const { message, sessionId, editorContext } = body;

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    const systemPrompt = buildSystemPrompt(editorContext);
    const schemaJson = JSON.stringify(AI_RESPONSE_SCHEMA, null, 2);

    const cliResult = await spawnClaude(
      systemPrompt,
      message,
      schemaJson,
      sessionId
    );

    // Extract actions from either structured_output or parse from result
    let actions: Array<{ tool: string; params: Record<string, unknown> }> = [];
    let text = cliResult.result || "";

    if (cliResult.structured_output) {
      actions = cliResult.structured_output.actions || [];
      text = cliResult.structured_output.message || text;
    } else {
      // Try to parse result as JSON (fallback)
      // Claude may wrap JSON in markdown code blocks
      let jsonStr = cliResult.result;
      const codeBlockMatch = jsonStr.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
      if (codeBlockMatch) {
        jsonStr = codeBlockMatch[1].trim();
      }
      try {
        const parsed = JSON.parse(jsonStr);
        if (parsed.actions) actions = parsed.actions;
        if (parsed.message) text = parsed.message;
      } catch {
        // result is plain text, no actions
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
