import type { NextRequest } from "next/server";
import type { Scene } from "@/lib/scene-schema";
import { callClaude } from "@/lib/server/claude-bridge";

interface RefineRequest {
  scene: Scene;
  instruction: string;
}

const SYSTEM_PROMPT = `You refine a single scene in an Isaac/Odd1sOut-style animated video. The user gives you the existing scene JSON and a short natural-language instruction. Apply only the requested change — keep every other field exactly as-is.

Return the updated scene via the emit_scene tool.`;

export async function POST(request: NextRequest) {
  const body = (await request.json()) as RefineRequest;
  if (!body.scene || !body.instruction?.trim()) {
    return Response.json({ error: "scene and instruction required" }, { status: 400 });
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
            name: "emit_scene",
            description: "Emit the updated scene object (same schema as input).",
            input_schema: {
              type: "object",
              properties: {
                scene: {
                  type: "object",
                  description: "The full updated scene, matching the input scene schema.",
                },
              },
              required: ["scene"],
            },
          },
        ],
        tool_choice: { type: "tool", name: "emit_scene" },
        messages: [
          {
            role: "user",
            content: `Scene:\n${JSON.stringify(body.scene, null, 2)}\n\nInstruction: ${body.instruction}`,
          },
        ],
      },
      "refine",
    );
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }

  const toolUse = data.content?.find((c) => c.type === "tool_use");
  const updated = toolUse?.input?.scene as Partial<Scene> | undefined;
  if (!updated) {
    return Response.json({ error: "No scene returned" }, { status: 502 });
  }
  const { id: _ignored, ...rest } = updated as Scene;
  return Response.json({ patch: rest });
}
