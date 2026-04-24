import type { NextRequest } from "next/server";
import { callClaude } from "@/lib/server/claude-bridge";

export const runtime = "nodejs";
export const maxDuration = 600;

interface StyleExtractRequest {
  /** Up to ~8 frame data URLs from the reference video. */
  frames: string[];
  note?: string;
}

const SYSTEM_PROMPT = `You analyze reference video frames and extract a reusable style pack.

Look at the frames and infer:
- accentColors: an ordered array of 4-6 bright hex accents used for emphasis text / callouts.
- textColor + emphasisColor: the two main text palette hex values.
- backgroundColor: the dominant neutral background hex.
- vignette: 0-0.8 strength of the vignette effect you see.
- transition: "beat_flash" | "beat_flash_colored" | "none" (what cuts feel like).
- zoomPunch: 0 or 1.1-1.2 (whether scenes pulse).
- shakeIntensity: 0-12 (how much screen shake).
- captionStyle: { fontSize (px, assume 1920x1080 canvas), color, strokeColor, position ("top"|"center"|"bottom"|"auto"), uppercase (boolean), maxWordsPerChunk (1-6) }.

Emit via the emit_style tool.`;

export async function POST(request: NextRequest) {
  const body = (await request.json()) as StyleExtractRequest;
  if (!Array.isArray(body.frames) || body.frames.length === 0) {
    return Response.json({ error: "frames required" }, { status: 400 });
  }

  const content: Array<
    | { type: "text"; text: string }
    | { type: "image"; source: { type: "base64"; media_type: string; data: string } }
  > = [
    {
      type: "text",
      text: `Reference frames follow. ${body.note ? `Note: ${body.note}. ` : ""}Emit a style pack that matches.`,
    },
  ];
  for (const frame of body.frames.slice(0, 12)) {
    const match = frame.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) continue;
    content.push({
      type: "image",
      source: { type: "base64", media_type: match[1], data: match[2] },
    });
  }

  let data;
  try {
    data = await callClaude(
      {
        model: "claude-sonnet-4-5",
        max_tokens: 2048,
        system: [
          { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
        ],
        tools: [
          {
            name: "emit_style",
            description: "Emit a StylePack.",
            input_schema: {
              type: "object",
              properties: {
                accentColors: { type: "array", items: { type: "string" } },
                textColor: { type: "string" },
                emphasisColor: { type: "string" },
                backgroundColor: { type: "string" },
                vignette: { type: "number" },
                transition: { type: "string" },
                zoomPunch: { type: "number" },
                shakeIntensity: { type: "number" },
                captionStyle: {
                  type: "object",
                  properties: {
                    fontSize: { type: "number" },
                    color: { type: "string" },
                    strokeColor: { type: "string" },
                    position: { type: "string" },
                    uppercase: { type: "boolean" },
                    maxWordsPerChunk: { type: "number" },
                  },
                },
              },
              required: ["accentColors", "emphasisColor", "backgroundColor"],
            },
          },
        ],
        tool_choice: { type: "tool", name: "emit_style" },
        messages: [{ role: "user", content }],
      },
      "style-extract",
    );
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
  const toolUse = data.content?.find((c) => c.type === "tool_use");
  const style = toolUse?.input;
  if (!style) {
    return Response.json({ error: "no style emitted" }, { status: 502 });
  }
  return Response.json({ style });
}
