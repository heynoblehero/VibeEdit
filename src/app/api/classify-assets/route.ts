import type { NextRequest } from "next/server";
import { callClaude } from "@/lib/server/claude-bridge";

export const runtime = "nodejs";
export const maxDuration = 600;

// Category labels are workflow-defined. The client sends the list of
// categories it cares about, and we return a category per uploaded asset.

interface ClassifyAsset {
  /** Stable key the caller uses to map the returned classification back. */
  id: string;
  /** Display name (usually the filename) — helps Claude with non-visual hints. */
  name: string;
  /** Data URL for images. We only classify images in v1. */
  dataUrl?: string;
}

interface ClassifyRequest {
  assets: ClassifyAsset[];
  categories: Array<{ id: string; description: string }>;
}

const SYSTEM_PROMPT = `You are classifying uploaded assets into one of a set of named slots for a video project. For each asset, pick the SINGLE best slot id it belongs to. Use the slot descriptions to decide. If nothing fits, return "unknown".

Return the classifications via the emit_classifications tool.`;

export async function POST(request: NextRequest) {
  const body = (await request.json()) as ClassifyRequest;
  if (!Array.isArray(body.assets) || body.assets.length === 0) {
    return Response.json({ error: "assets required" }, { status: 400 });
  }
  if (!Array.isArray(body.categories) || body.categories.length === 0) {
    return Response.json({ error: "categories required" }, { status: 400 });
  }

  const categoriesList = body.categories
    .map((c) => `- ${c.id}: ${c.description}`)
    .join("\n");

  // Build a multimodal user message with images + filename hints.
  const content: Array<
    | { type: "text"; text: string }
    | { type: "image"; source: { type: "base64"; media_type: string; data: string } }
  > = [
    {
      type: "text",
      text: `Available slots:\n${categoriesList}\n\nAssets to classify (in order, use the same ids):\n${body.assets
        .map((a) => `${a.id}: "${a.name}"`)
        .join("\n")}`,
    },
  ];
  for (const asset of body.assets) {
    if (!asset.dataUrl || !asset.dataUrl.startsWith("data:")) continue;
    const match = asset.dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) continue;
    const mediaType = match[1];
    if (!mediaType.startsWith("image/")) continue;
    content.push({
      type: "image",
      source: { type: "base64", media_type: mediaType, data: match[2] },
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
            name: "emit_classifications",
            description: "Emit a category id per asset.",
            input_schema: {
              type: "object",
              properties: {
                classifications: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      assetId: { type: "string" },
                      categoryId: { type: "string" },
                    },
                    required: ["assetId", "categoryId"],
                  },
                },
              },
              required: ["classifications"],
            },
          },
        ],
        tool_choice: { type: "tool", name: "emit_classifications" },
        messages: [{ role: "user", content }],
      },
      "classify-assets",
    );
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }

  const toolUse = data.content?.find((c) => c.type === "tool_use");
  const classifications = toolUse?.input?.classifications;
  if (!Array.isArray(classifications)) {
    return Response.json({ error: "No classifications returned" }, { status: 502 });
  }
  return Response.json({ classifications });
}
