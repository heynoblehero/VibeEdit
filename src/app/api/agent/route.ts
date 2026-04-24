import type { NextRequest } from "next/server";
import type { Project } from "@/lib/scene-schema";
import type { CharacterAsset, SfxAsset } from "@/store/asset-store";
import {
  listToolSchemas,
  runTool,
  summarizeProject,
} from "@/lib/server/agent-tools";
import { callClaude, type ClaudeContentBlock } from "@/lib/server/claude-bridge";
import { getWorkflow, WORKFLOWS } from "@/lib/workflows/registry";

export const runtime = "nodejs";
export const maxDuration = 600;

type ChatMessage =
  | { role: "user"; content: string }
  | { role: "assistant"; content: string };

interface AgentRequest {
  messages: ChatMessage[];
  project: Project;
  characters: CharacterAsset[];
  sfx: SfxAsset[];
}

const SYSTEM_PROMPT = `You are VibeEdit's AI agent — a video editor the user controls by talking. You have tools for scenes, style, music, voice, render.

Principles:
- Act. Don't ask permission for non-destructive ops.
- Destructive ops (mass remove / generateScenesFromScript) need clear intent like "start over" or "remake everything".
- Narrate briefly in plain language — "Adding 5 scenes..." — not tool args.
- Stable ids only: never guess a scene id.
- Vague request → pick sensible defaults and ship. Refine next turn.
- Colors hex. Durations seconds. Positions canvas pixels (0-1920 X, 0-1080 Y landscape; 0-1080 X, 0-1920 Y portrait).
- Move fast. End each turn with 1-2 yes/no next-action questions (≤15 words).
- If the project name is still "Draft", call setProjectName once with a Title Case topic name (4-8 words).
- After 5+ scene changes, one self-review pass — fix up to 3 issues (repeat colors, bad durations, empty scenes) and stop.`;

function workflowContext(project: Project): string {
  const wf = getWorkflow(project.workflowId);
  const catalogLine = WORKFLOWS.map(
    (w) => `- ${w.id}${w.enabled ? "" : " (coming soon)"}: ${w.name} — ${w.tagline}`,
  ).join("\n");
  if (!project.workflowId || project.workflowId === "blank") {
    return [
      `Project has no specific template ('blank' workflow). Act on what the user asks directly — don't push them toward a template unless they explicitly want one. Templates exist as library data for switchWorkflow if useful, but blank is the default and stays fine for most sessions.`,
      project.systemPrompt
        ? `The user's project-specific instructions are above in another system block; honour those over generic defaults.`
        : "",
      `Available templates (only switch if the user asks):\n${catalogLine}`,
    ]
      .filter(Boolean)
      .join("\n\n");
  }
  const slots = wf.slots
    .map(
      (s) =>
        `  - ${s.id} (${s.type}${s.required ? ", required" : ""}): ${s.label}${
          s.description ? ` — ${s.description}` : ""
        }`,
    )
    .join("\n");
  return [
    `Active workflow: ${wf.name} — ${wf.tagline}`,
    `Shape guidance:\n${wf.reviewCriteria ?? "(no specific guidance)"}`,
    `Workflow slots (fields on project.workflowInputs):\n${slots || "  (no slots)"}`,
    `Default orientation: ${wf.defaultOrientation}. Accent color: ${wf.accentColor}.`,
    wf.autoPipeline
      ? `Auto-pipeline exists: topic slot "${wf.autoPipeline.topicSlotId}" → ${wf.autoPipeline.steps.map((s) => s.label).join(" → ")}.`
      : "",
    `Other workflows the user could switch to:\n${catalogLine}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

function sseLine(data: unknown): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

type AnthropicContent = ClaudeContentBlock;

interface AnthropicMessage {
  role: "user" | "assistant";
  content: string | AnthropicContent[];
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as AgentRequest;
  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return Response.json({ error: "messages required" }, { status: 400 });
  }
  if (!body.project) {
    return Response.json({ error: "project required" }, { status: 400 });
  }

  const origin = request.nextUrl.origin;
  // Deep-copy the project so we can mutate safely per-request.
  const project: Project = JSON.parse(JSON.stringify(body.project));

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const send = (data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(sseLine(data)));
        } catch {
          // already closed
        }
      };
      const close = () => {
        if (closed) return;
        closed = true;
        try {
          controller.close();
        } catch {
          // already closed
        }
      };

      // Conversation we grow across tool-use loops. Start from the user's
      // history; each loop may append assistant + tool_result messages.
      const conversation: AnthropicMessage[] = [
        // Preamble: give the agent current project state as the first "user"
        // message so it knows what exists. Subsequent turns carry real history.
        { role: "user", content: `Current project state:\n${summarizeProject(project)}` },
        { role: "assistant", content: "Got it. Ready." },
        ...body.messages.map((m) => ({ role: m.role, content: m.content }) as AnthropicMessage),
      ];

      const tools = listToolSchemas();
      const ctx = {
        project,
        characters: body.characters ?? [],
        sfx: body.sfx ?? [],
        origin,
      };

      let consecutiveErrors = 0;
      try {
        // Up to 16 tool-use rounds — a full video build can hit 10+ calls.
        for (let round = 0; round < 16; round++) {
          let data;
          try {
            const systemBlocks: Array<{
              type: "text";
              text: string;
              cache_control?: { type: "ephemeral" };
            }> = [
              { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
              { type: "text", text: workflowContext(project) },
            ];
            // Per-project override appended at the end so it takes priority.
            if (project.systemPrompt?.trim()) {
              systemBlocks.push({
                type: "text",
                text: `User's project-specific instructions (honour these):\n${project.systemPrompt.trim()}`,
              });
            }
            data = await callClaude(
              {
                model: "claude-sonnet-4-5",
                max_tokens: 8192,
                system: systemBlocks,
                tools,
                messages: conversation,
              },
              "agent",
            );
          } catch (err) {
            send({
              type: "error",
              error: err instanceof Error ? err.message : String(err),
            });
            break;
          }
          const contentBlocks = (data.content ?? []) as AnthropicContent[];

          // Surface any text the assistant emitted this round.
          for (const block of contentBlocks) {
            if (block.type === "text" && block.text) {
              send({ type: "text", text: block.text });
            }
          }

          const toolUses = contentBlocks.filter((b) => b.type === "tool_use");
          if (toolUses.length === 0) {
            // No more tool calls — the assistant is done.
            break;
          }

          // Append the assistant turn to the conversation as-is (preserves ids).
          conversation.push({ role: "assistant", content: contentBlocks });

          // Execute each tool and build Anthropic-shaped tool_result blocks.
          const toolResultBlocks: Array<{
            type: "tool_result";
            tool_use_id: string;
            content: Array<{ type: "text"; text: string }>;
            is_error?: boolean;
          }> = [];
          for (const tu of toolUses) {
            const args = (tu.input ?? {}) as Record<string, unknown>;
            send({ type: "tool_start", id: tu.id, name: tu.name, args });
            const result = await runTool(tu.name ?? "", args, ctx);
            consecutiveErrors = result.ok ? 0 : consecutiveErrors + 1;
            send({
              type: "tool_result",
              id: tu.id,
              name: tu.name,
              ok: result.ok,
              message: result.message,
            });
            toolResultBlocks.push({
              type: "tool_result",
              tool_use_id: tu.id ?? "",
              content: [{ type: "text", text: result.message }],
              is_error: !result.ok,
            });
          }
          conversation.push({
            role: "user",
            // Cast: our local AnthropicContent is a subset of Anthropic's real
            // content block union, which allows tool_result.
            content: toolResultBlocks as unknown as AnthropicContent[],
          });

          // Bail if the same kind of failure keeps repeating — prevents a
          // runaway loop where the agent can't find a way forward.
          if (consecutiveErrors >= 4) {
            send({
              type: "error",
              error:
                "Too many consecutive tool failures — stopping. Try rephrasing or check API keys.",
            });
            break;
          }
        }
      } catch (err) {
        send({ type: "error", error: err instanceof Error ? err.message : String(err) });
      } finally {
        send({ type: "done", project });
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
