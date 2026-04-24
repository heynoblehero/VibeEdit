import type { NextRequest } from "next/server";
import { callClaude } from "@/lib/server/claude-bridge";

interface PoseRequest {
  scenes: Array<{ id: string; text: string; type: string }>;
  availablePoses: string[];
}

const SYSTEM_PROMPT = `You pick the best character pose for each scene in an Isaac/Odd1sOut-style video based on what's being said.

Rules:
- Match the pose to the emotion of the line. "watch" = neutral observation, "point" = explaining/pointing out something, "celebrate" = excitement/win, "frustrated" = annoyance/failure, "tablet" = showing data/stats, "shrug" = uncertainty, "hero" = confidence/triumph, "wide" = open/reveal, "closeup" = intensity.
- Use the poses actually available. Don't invent ids.
- Vary consecutive scenes so the video doesn't feel static — even if the emotion is similar, occasionally pick a different fitting pose.
- flipCharacter: set true when the character should face left (e.g., looking at text on the right side of the frame).
- If the scene has no characterId need (type "text_only" or "big_number"), still return the scene id but with characterId = "" (empty) to skip.

Return via the emit_poses tool.`;

export async function POST(request: NextRequest) {
  const body = (await request.json()) as PoseRequest;
  if (!body.scenes?.length) {
    return Response.json({ error: "scenes required" }, { status: 400 });
  }
  if (!body.availablePoses?.length) {
    return Response.json({ error: "availablePoses required" }, { status: 400 });
  }

  const sceneList = body.scenes
    .map((s, i) => `${i + 1}. id=${s.id} type=${s.type}: "${s.text}"`)
    .join("\n");

  let data;
  try {
    data = await callClaude(
      {
        model: "claude-sonnet-4-5",
        max_tokens: 4096,
        system: [
          { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
        ],
        tools: [
          {
            name: "emit_poses",
            description: "Emit a pose pick per scene.",
            input_schema: {
              type: "object",
              properties: {
                picks: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      sceneId: { type: "string" },
                      characterId: { type: "string" },
                      flipCharacter: { type: "boolean" },
                      rationale: { type: "string" },
                    },
                    required: ["sceneId", "characterId"],
                  },
                },
              },
              required: ["picks"],
            },
          },
        ],
        tool_choice: { type: "tool", name: "emit_poses" },
        messages: [
          {
            role: "user",
            content: `Available poses: [${body.availablePoses.join(", ")}]\n\nScenes:\n${sceneList}`,
          },
        ],
      },
      "pose-suggest",
    );
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
  const toolUse = data.content?.find((c) => c.type === "tool_use");
  const picks = toolUse?.input?.picks;
  if (!Array.isArray(picks)) {
    return Response.json({ error: "No picks returned" }, { status: 502 });
  }
  return Response.json({ picks });
}
