import type { NextRequest } from "next/server";
import { callClaude } from "@/lib/server/claude-bridge";

export const runtime = "nodejs";
export const maxDuration = 600;

interface MetadataRequest {
  platform: "youtube" | "tiktok" | "shorts" | "reels";
  script?: string;
  projectName: string;
  workflowName?: string;
  sceneSummary?: string;
}

const PROMPTS: Record<MetadataRequest["platform"], string> = {
  youtube: `Platform: YouTube long-form. Title should be 50-60 chars, curiosity-driven. Description: 2-3 paragraphs with timestamps if natural. Hashtags: 3-5 niche-focused (not generic).`,
  tiktok: `Platform: TikTok. Title can double as first-line hook (60 chars max). Description: 1-2 sentences, punchy, ends with a scroll-stopping question. Hashtags: 4-8 mixing broad + niche.`,
  shorts: `Platform: YouTube Shorts. Title should be under 40 chars, pattern-interrupt. Description: one short hook line. Hashtags: include #Shorts + 2-3 niche.`,
  reels: `Platform: Instagram Reels. Title = caption opener (60 chars). Description: 2-3 short lines with line breaks. Hashtags: 5-10 mixing broad + niche.`,
};

const SYSTEM_PROMPT = `You are generating publish-ready title / description / hashtags for a short-form video the creator just rendered. Match the platform's tone and algorithm quirks. Don't use clickbait, don't over-emoji. Emit exactly one set of fields via the emit_metadata tool.`;

export async function POST(request: NextRequest) {
  const body = (await request.json()) as MetadataRequest;
  if (!body.platform) {
    return Response.json({ error: "platform required" }, { status: 400 });
  }

  const context = [
    `Project: ${body.projectName}`,
    body.workflowName ? `Video type: ${body.workflowName}` : "",
    body.script ? `Script:\n${body.script}` : "",
    body.sceneSummary ? `Scenes: ${body.sceneSummary}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  let data;
  try {
    data = await callClaude(
      {
        model: "claude-sonnet-4-5",
        max_tokens: 1024,
        system: [
          {
            type: "text",
            text: `${SYSTEM_PROMPT}\n\n${PROMPTS[body.platform]}`,
            cache_control: { type: "ephemeral" },
          },
        ],
        tools: [
          {
            name: "emit_metadata",
            description: "Emit publish-ready metadata.",
            input_schema: {
              type: "object",
              properties: {
                title: { type: "string" },
                description: { type: "string" },
                hashtags: { type: "array", items: { type: "string" }, minItems: 1 },
              },
              required: ["title", "description", "hashtags"],
            },
          },
        ],
        tool_choice: { type: "tool", name: "emit_metadata" },
        messages: [{ role: "user", content: context }],
      },
      "export-metadata",
    );
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
  const toolUse = data.content?.find((c) => c.type === "tool_use");
  const metadata = toolUse?.input;
  if (!metadata) {
    return Response.json({ error: "no metadata emitted" }, { status: 502 });
  }
  return Response.json({ metadata });
}
