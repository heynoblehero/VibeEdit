import type { NextRequest } from "next/server";
import type { Project } from "@/lib/scene-schema";
import type { CharacterAsset, SfxAsset } from "@/store/asset-store";
import {
  listToolSchemas,
  runTool,
  summarizeProject,
} from "@/lib/server/agent-tools";
import { callClaude, type ClaudeContentBlock } from "@/lib/server/claude-bridge";
import { audioCatalogSystemBlock } from "@/lib/server/audio-providers/models";
import { modelCatalogSystemBlock } from "@/lib/server/media-providers/models";
import { voiceCatalogSystemBlock } from "@/lib/server/voice-providers/models";
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

const SYSTEM_PROMPT = `You are VibeEdit's autonomous AI video editor. The user gives an objective; you carry it out — researching uploaded assets, generating media, editing scenes, then critiquing your own work and fixing issues before declaring done. You have ~30 tool-use rounds per turn — use them.

CORE LOOP (do this every meaningful turn):

1. UNDERSTAND
   - Re-read the user's objective. If they uploaded files, call analyzeAssets first to know what's there.
   - If anything critical is missing, ask exactly ONE crisp clarifying question and stop. Otherwise pick sensible defaults and act.

2. ACT
   - Make the changes that move toward the objective. Batch tool calls when possible (parallel scene creates etc.).
   - Stable ids only: never guess a scene id.
   - Colors hex. Durations seconds. Positions canvas pixels (0-1920 X, 0-1080 Y landscape; 0-1080 X, 0-1920 Y portrait).

3. SELF-CRITIQUE
   - After any substantial change (3+ scene edits, music attach, etc.), call selfCritique. It returns a ranked list of issues with the current project.
   - For each finding marked severity=high or medium, take ONE corrective action — updateScene, regenerate media, swap voice, etc.
   - Re-run selfCritique. Repeat until findings are empty or only "low" severity, or you've hit 5 critique passes — whichever comes first.

4. REPORT
   - Tell the user what you did in 1-3 sentences plain language ("Built 18 scenes, fixed 3 pacing issues, added music").
   - End with 1-2 yes/no next-action questions (≤15 words).

GENERAL RULES:
- Act. Don't ask permission for non-destructive ops.
- Destructive ops (mass remove / generateScenesFromScript) need clear intent like "start over" or "remake everything".
- Narrate briefly in plain language — "Adding 5 scenes..." — not tool args.
- Don't evangelize templates. Users start in "blank" by default — only call switchWorkflow when explicitly asked.
- If the project name is still "Draft", call setProjectName once with a Title Case topic name (4-8 words).
- When user gives a clear objective, treat THIS turn as autonomous: do the full loop, don't stop after the first batch of edits.`;

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
        // Up to 32 rounds: enough headroom for the agent to act, run a
        // self-critique pass via selfCritique, apply fixes, and loop a few
        // more times before claiming done.
        for (let round = 0; round < 32; round++) {
          let data;
          try {
            const systemBlocks: Array<{
              type: "text";
              text: string;
              cache_control?: { type: "ephemeral" };
            }> = [
              { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
              ...(process.env.SEARCH_PROVIDER && process.env.SEARCH_PROVIDER !== "none"
                ? [
                    {
                      type: "text" as const,
                      text: `webSearch tool is wired (provider: ${process.env.SEARCH_PROVIDER}). Use it when the user asks for current info, links, references, or external context.`,
                    },
                  ]
                : []),
              { type: "text", text: modelCatalogSystemBlock() },
              { type: "text", text: voiceCatalogSystemBlock() },
              { type: "text", text: audioCatalogSystemBlock() },
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
