import type { NextRequest } from "next/server";
import type { Scene } from "@/lib/scene-schema";
import { callClaude } from "@/lib/server/claude-bridge";

export const runtime = "nodejs";
export const maxDuration = 600;

interface ReviewRequest {
  scenes: Scene[];
  orientation?: "landscape" | "portrait";
  /** Workflow id — lets us append workflow-specific review criteria. */
  workflowId?: string;
  /** Workflow-specific review criteria to inject into the system prompt. */
  workflowCriteria?: string;
}

const BASE_PROMPT = `You are an editor reviewing a short-form video scene-by-scene. Identify concrete problems a creator should fix before shipping, and propose a minimal JSON patch for each.

Rules:
- Only flag things that actually hurt the video: pacing (too long / too short), visual monotony, text that doesn't fit the scene, missing SFX, missing transitions, wrong scene type for the content.
- Be specific and short. "Scene 3 drags at 4s — tighten to 2.5s" beats "consider adjusting duration".
- Each finding maps to ONE scene (by sceneId) and ONE patch (partial Scene fields to merge). The patch must be minimal — only the keys you're changing.
- Severity: "high" = blocks publish, "medium" = noticeable nit, "low" = polish.
- Return at most 10 findings. If the video is already good, return fewer (or zero).

Emit the review via the emit_review tool.`;

const TOOL_SCHEMA = {
  name: "emit_review",
  description: "Emit review findings with minimal JSON patches.",
  input_schema: {
    type: "object",
    properties: {
      findings: {
        type: "array",
        items: {
          type: "object",
          properties: {
            sceneId: { type: "string" },
            severity: { type: "string", enum: ["high", "medium", "low"] },
            issue: { type: "string" },
            suggestion: { type: "string" },
            patch: {
              type: "object",
              description: "Minimal Scene field patch to apply. May be empty if no autofix.",
            },
          },
          required: ["sceneId", "severity", "issue", "suggestion"],
        },
      },
    },
    required: ["findings"],
  },
};

function sseLine(data: unknown): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as ReviewRequest;
  if (!body.scenes?.length) {
    return Response.json({ error: "scenes required" }, { status: 400 });
  }

  const summary = body.scenes
    .map((s, i) => {
      const label = s.emphasisText || s.text || `${s.type}`;
      return `${i + 1}. id=${s.id} type=${s.type} dur=${s.duration}s char=${s.characterId ?? "-"}@(${s.characterX ?? "-"},${s.characterY ?? "-"}) enter=${s.enterFrom ?? "-"} emphasisColor=${s.emphasisColor ?? "-"} transition=${s.transition ?? "-"} sfx=${s.sfxId ?? "-"} | "${label}"`;
    })
    .join("\n");

  const systemPrompt = body.workflowCriteria
    ? `${BASE_PROMPT}\n\nWorkflow-specific criteria:\n${body.workflowCriteria}`
    : BASE_PROMPT;

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (data: unknown) => {
        try {
          controller.enqueue(encoder.encode(sseLine(data)));
        } catch {
          // closed
        }
      };
      const close = () => {
        try {
          controller.close();
        } catch {
          // already closed
        }
      };

      try {
        const data = await callClaude(
          {
            model: "claude-sonnet-4-5",
            max_tokens: 4096,
            system: [
              { type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } },
            ],
            tools: [TOOL_SCHEMA],
            tool_choice: { type: "tool", name: "emit_review" },
            messages: [
              {
                role: "user",
                content: `Orientation: ${body.orientation ?? "landscape"}\nTotal scenes: ${body.scenes.length}\n\nScenes:\n${summary}`,
              },
            ],
          },
          "review",
        );
        const toolUse = data.content?.find((c) => c.type === "tool_use");
        const findings =
          (toolUse?.input?.findings as Array<Record<string, unknown>> | undefined) ?? [];
        // Synthesize the streaming UX by emitting findings one-by-one with a
        // small gap so the UI still animates.
        for (const finding of findings) {
          send({ type: "finding", finding });
          await new Promise((r) => setTimeout(r, 40));
        }
        send({ type: "done", count: findings.length });
      } catch (err) {
        send({ type: "error", error: err instanceof Error ? err.message : String(err) });
      } finally {
        close();
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
