import type { NextRequest } from "next/server";
import { callClaude } from "@/lib/server/claude-bridge";

interface ScriptRequest {
  topic: string;
  targetLines?: number;
  orientation?: "landscape" | "portrait";
}

const SYSTEM_PROMPT = `You write scripts for faceless animated short-form videos in the Odd1sOut / TheOdd1sOut / Isaac / ZIO style — fast, punchy, self-deprecating, observational storytelling.

A line of output becomes one scene in the video. Rules:
- Write ${"{{TARGET_LINES}}"} lines, one idea per line. No bullet points, no numbers, no scene headings.
- First 2 lines are the hook: something surprising, relatable, or a question the viewer needs answered.
- Use SHORT PUNCHY LINES. 3-10 words most of the time.
- Mix normal sentences with occasional ALL-CAPS emphasis lines (the renderer treats those as big text beats).
- Use bare numbers on their own line (e.g. "10K", "3x", "$0") when a stat matters — they become animated counters.
- Cut filler. Every line should advance the story, land a joke, or set up the next beat.
- No outro like "like and subscribe" unless the topic demands it.

Emit the script via the emit_script tool as an array of line strings (no trailing punctuation-less markers, just the lines).`;

export async function POST(request: NextRequest) {
  const body = (await request.json()) as ScriptRequest;
  if (!body.topic?.trim()) {
    return Response.json({ error: "topic required" }, { status: 400 });
  }
  const targetLines = Math.max(6, Math.min(30, body.targetLines ?? 12));
  const systemPrompt = SYSTEM_PROMPT.replace("{{TARGET_LINES}}", String(targetLines));

  let data;
  try {
    data = await callClaude(
      {
        model: "claude-sonnet-4-5",
        max_tokens: 2048,
        system: [
          { type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } },
        ],
        tools: [
          {
            name: "emit_script",
            description: "Emit the finished script as an array of scene lines.",
            input_schema: {
              type: "object",
              properties: {
                lines: {
                  type: "array",
                  items: { type: "string" },
                  minItems: 4,
                },
              },
              required: ["lines"],
            },
          },
        ],
        tool_choice: { type: "tool", name: "emit_script" },
        messages: [
          {
            role: "user",
            content: `Topic: ${body.topic}${body.orientation === "portrait" ? "\n\nOutput format: 9:16 vertical (TikTok/Shorts) — keep lines very short." : ""}`,
          },
        ],
      },
      "script",
    );
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }

  const toolUse = data.content?.find((c) => c.type === "tool_use");
  const lines = toolUse?.input?.lines as string[] | undefined;
  if (!lines?.length) {
    return Response.json({ error: "No script returned" }, { status: 502 });
  }
  return Response.json({ script: lines.join("\n") });
}
