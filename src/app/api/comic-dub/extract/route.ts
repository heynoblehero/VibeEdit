import type { NextRequest } from "next/server";
import { callClaude } from "@/lib/server/claude-bridge";

export const runtime = "nodejs";
export const maxDuration = 600;

interface ExtractRequest {
  panels: Array<{ id?: string; url: string; prompt?: string }>;
  comicTitle?: string;
}

const SYSTEM_PROMPT = `You are extracting dub narration for each panel of a comic / manga / webtoon.

For each panel image, produce:
- speaker: WHO is speaking. Use "narrator" for third-person narration, "sfx" for sound effects, or a character name when the speech bubble tail clearly points to someone. Reuse the same name consistently across panels so the same voice can be assigned to the same character.
- line: the 4-15 word dub line itself. Punchy, spoken-style.

Rules:
- One entry per panel, in the order given.
- Preserve dramatic SFX ("CRACK", "WHOOSH") with speaker="sfx".
- Don't number panels. Don't include "panel 1:" prefixes.

Emit via the emit_dub tool.`;

export async function POST(request: NextRequest) {
  const body = (await request.json()) as ExtractRequest;
  if (!Array.isArray(body.panels) || body.panels.length === 0) {
    return Response.json({ error: "panels required" }, { status: 400 });
  }

  const content: Array<
    | { type: "text"; text: string }
    | { type: "image"; source: { type: "base64"; media_type: string; data: string } | { type: "url"; url: string } }
  > = [
    {
      type: "text",
      text: `Comic title: ${body.comicTitle ?? "(untitled)"}\n\nPanels follow in reading order. Emit exactly ${body.panels.length} lines.`,
    },
  ];
  for (const panel of body.panels) {
    // Data URL inline, else by URL (must be publicly fetchable by Anthropic — usually fine in dev).
    if (panel.url.startsWith("data:")) {
      const match = panel.url.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        content.push({
          type: "image",
          source: { type: "base64", media_type: match[1], data: match[2] },
        });
      }
    } else if (panel.url.startsWith("http")) {
      content.push({ type: "image", source: { type: "url", url: panel.url } });
    }
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
            name: "emit_dub",
            description: "Emit dub lines with speakers, one per panel.",
            input_schema: {
              type: "object",
              properties: {
                entries: {
                  type: "array",
                  minItems: 1,
                  items: {
                    type: "object",
                    properties: {
                      speaker: { type: "string" },
                      line: { type: "string" },
                    },
                    required: ["speaker", "line"],
                  },
                },
              },
              required: ["entries"],
            },
          },
        ],
        tool_choice: { type: "tool", name: "emit_dub" },
        messages: [{ role: "user", content }],
      },
      "comic-dub/extract",
    );
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
  const toolUse = data.content?.find((c) => c.type === "tool_use");
  const entries = toolUse?.input?.entries as Array<{ speaker: string; line: string }> | undefined;
  if (!Array.isArray(entries)) {
    return Response.json({ error: "No entries returned" }, { status: 502 });
  }
  return Response.json({
    entries,
    script: entries.map((e) => e.line).join("\n"),
    speakers: Array.from(new Set(entries.map((e) => e.speaker))),
  });
}
