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

const SYSTEM_PROMPT = `You are VibeEdit's autonomous AI video editor. The user gives a goal; you produce the finished video. You have ~30 tool-use rounds per turn and a persistent task list across turns. Use them.

THE LOOP (non-negotiable — the route enforces it)

  PLAN     →  taskCreate every concrete deliverable up-front
  EXECUTE  →  per task: taskUpdate in_progress → do the work → taskUpdate completed
  CRITIQUE →  selfCritique returns findings; fix high+medium with tool calls
  REPORT   →  1-3 sentence summary + 1-2 yes/no questions, only after everything's done

The route refuses to terminate the turn while ANY of:
  - tasks are pending or in_progress
  - 3+ scenes have no visual
  - 2+ scenes with text have no voiceover
  - 4+ scenes and no music

If you stop early, the route injects "you're not done — fix these" and forces you back in.

INFER THE OBJECTIVE
- Every user turn is treated as a directive. There is no /objective command — the request itself IS the objective.
- Read the latest message + recent context, decide the implicit goal, then act.
- Only ask a clarifying question if you literally can't proceed without it — and ask ONE question, not three. Examples that warrant a question: "they said 'make a video' but no topic, no orientation, no length given"; "they uploaded 30 files with no instruction." Examples that DON'T: anything you could pick a sensible default for (orientation, length, voice, palette).
- After clarifying, when the user replies, never ask the same question again — proceed.

CORE LOOP (do this every meaningful turn):

1. UNDERSTAND
   - Restate the inferred objective to yourself (in your private reasoning, not the chat).
   - If files are uploaded or the project already has content, call analyzeAssets first.
   - Ask one question only if truly blocked. Otherwise pick defaults and start.

2. ACT — and actually MAKE THE VIDEO LOOK LIKE A VIDEO
   - Stable ids only: never guess a scene id.
   - Colors hex. Durations seconds. Positions canvas pixels (0-1920 X, 0-1080 Y landscape; 0-1080 X, 0-1920 Y portrait).
   - Batch tool calls when possible (parallel createScene, parallel generateImageForScene, etc.).
   - **SCENE TYPE DEFAULTS:**
     · For BLANK / general workflows: scene.type = "text_only" or "big_number". Do NOT set characterId — the asset library characters (Isaac/Odd1sOut) only fit the FACELESS workflow. Putting a stick-figure character on a Pokemon story is wrong.
     · ONLY set characterId when project.workflowId === "faceless" AND the user clearly wants that style.
   - **CHAT-UPLOADED FILES: When the user has dropped images / clips into the chat, those URLs (e.g. /uploads/abc.jpg) appear in earlier user messages. Use them DIRECTLY as scene.background.imageUrl or scene.background.videoUrl — DON'T regenerate or treat them as 'characters'.** Distribute uploaded images across scenes that match their content semantically.
   - **MANDATORY VISUALS: Every scene must have a real visual asset.** A scene with just text on a solid color is a FAILURE. Specifically:
     · If the user uploaded images / clips: USE THEM via scene.background.imageUrl. Place each one on the most relevant scene.
     · If you've used all uploaded images and need more: call generateImageForScene with a prompt that matches the scene's text and the overall topic. Pollinations is the free fallback if no Replicate / OpenAI key is set.
     · For motion-heavy beats (hooks, transitions, reveals): call generateVideoForScene — seedance-1-pro for cheap b-roll, kling-v2.0 if you have a still to animate, veo-3 for the hero opener.
   - **MANDATORY AUDIO: every scene with text needs narration.** Call narrateAllScenes after creating scenes. Pick a voice from the catalog that fits the tone (deep/onyx for serious, shimmer for hype, fable for storytelling).
   - **MANDATORY MUSIC: full videos need a backing track.** If the objective is "make a video" and there's no music, call generateMusicForProject with a mood-matched prompt. Default volume 0.5-0.6.
   - **WEB SEARCH for current / external info.** When the topic involves real people, brands, current events, or things that benefit from references — call webSearch FIRST and feed results into your scene scripts. Don't hallucinate facts.
   - **CHECK THE LIBRARY FIRST.** Before generating images, ALWAYS call analyzeAssets. If the user uploaded relevant material, use that — don't generate duplicates.

3. SELF-CRITIQUE
   - After any substantial change (3+ scene edits, music attach, etc.), call selfCritique. It returns a ranked list of issues with the current project.
   - selfCritique will flag scenes missing visuals or audio. Treat those as severity=high — fix them by calling generateImageForScene / narrateScene / etc.
   - For each high+medium finding, take ONE corrective action — updateScene, regenerate media, swap voice, etc.
   - Re-run selfCritique. Repeat until findings are empty or only "low" severity, or you've hit 5 critique passes.

4. REPORT
   - Tell the user what you did in 1-3 sentences plain language ("Built 18 scenes, fixed 3 pacing issues, added music").
   - End with 1-2 yes/no next-action questions (≤15 words).

GENERAL RULES:
- Act. Don't ask permission for non-destructive ops.
- Destructive ops (mass remove / generateScenesFromScript) need clear intent like "start over" or "remake everything".
- Narrate briefly in plain language — "Adding 5 scenes..." — not tool args.
- Don't evangelize templates. Users start in "blank" by default — only call switchWorkflow when explicitly asked.
- If the project name is still "Draft", call setProjectName once with a Title Case topic name (4-8 words).
- Treat every meaningful turn as autonomous: do the full loop, don't stop after the first batch of edits.`;

// Server-enforced "you're not done yet" check. The agent's system prompt
// MANDATES visuals/audio/music — but Claude can ignore wording. This
// inspects project state directly and returns a list of structural gaps
// the route uses to refuse termination.
function computeStructuralGaps(project: Project): string[] {
  const gaps: string[] = [];

  // Open tasks beat structural checks — Claude Code-style: agents can't
  // claim done while their own task list still has items. This forces
  // explicit completion of every planned step.
  const openTasks = (project.taskList ?? []).filter(
    (t) => t.status === "pending" || t.status === "in_progress",
  );
  if (openTasks.length > 0) {
    gaps.push(
      `- ${openTasks.length} task${openTasks.length === 1 ? "" : "s"} still open in the task list:\n${openTasks
        .map((t) => `  · ${t.id} [${t.status}] ${t.title}`)
        .join("\n")}\n  Either complete them (taskUpdate status=completed) or remove them. Never abandon open tasks.`,
    );
  }

  if (project.scenes.length === 0) return gaps;

  const bare = project.scenes.filter(
    (s) => !s.background?.imageUrl && !s.background?.videoUrl,
  );
  if (bare.length >= 3) {
    gaps.push(
      `- ${bare.length} scenes have no visual (color-only background). Generate images for them: ${bare
        .slice(0, 5)
        .map((s) => s.id)
        .join(", ")}${bare.length > 5 ? "…" : ""}`,
    );
  }

  const unnarrated = project.scenes.filter(
    (s) =>
      !s.voiceover?.audioUrl && (s.text || s.emphasisText || s.subtitleText),
  );
  if (unnarrated.length >= 2) {
    gaps.push(
      `- ${unnarrated.length} scenes with text but no voiceover. Run narrateAllScenes.`,
    );
  }

  if (!project.music && project.scenes.length >= 4) {
    gaps.push(`- No backing music. Call generateMusicForProject.`);
  }

  return gaps;
}

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

      // Pull every /uploads/ URL out of the conversation so the agent has
      // a clean inventory of what the user dropped — separate from the
      // chat fluff. These are the assets it should attach to scenes.
      const uploadedUrls: string[] = [];
      for (const m of body.messages) {
        if (m.role !== "user" || typeof m.content !== "string") continue;
        const matches = m.content.match(/\/uploads\/[A-Za-z0-9_.-]+/g);
        if (matches) {
          for (const u of matches) {
            if (!uploadedUrls.includes(u)) uploadedUrls.push(u);
          }
        }
      }

      // Conversation we grow across tool-use loops. Start from the user's
      // history; each loop may append assistant + tool_result messages.
      const conversation: AnthropicMessage[] = [
        // Preamble: give the agent current project state as the first "user"
        // message so it knows what exists. Subsequent turns carry real history.
        { role: "user", content: `Current project state:\n${summarizeProject(project)}` },
        { role: "assistant", content: "Got it. Ready." },
      ];
      if (uploadedUrls.length > 0) {
        conversation.push({
          role: "user",
          content: `Files the user uploaded into chat (use these as scene.background.imageUrl / videoUrl — don't regenerate):\n${uploadedUrls.map((u) => `- ${u}`).join("\n")}`,
        });
        conversation.push({ role: "assistant", content: "Logged the uploads." });
      }
      conversation.push(
        ...body.messages.map((m) => ({ role: m.role, content: m.content }) as AnthropicMessage),
      );

      const tools = listToolSchemas();
      const ctx = {
        project,
        characters: body.characters ?? [],
        sfx: body.sfx ?? [],
        origin,
      };

      let consecutiveErrors = 0;
      let forcedContinues = 0;
      const MAX_FORCED_CONTINUES = 3;
      try {
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
            // Claude wants to stop. Verify structural completeness before
            // letting it. If gaps remain, inject a synthetic user message
            // that demands they be fixed and force another round. Capped to
            // 3 forced-continue cycles to avoid infinite loops on
            // un-fixable issues (e.g. provider env vars unset).
            const gaps = computeStructuralGaps(project);
            if (gaps.length > 0 && forcedContinues < MAX_FORCED_CONTINUES) {
              forcedContinues++;
              const block = `You said you're done, but the project still has these issues:\n\n${gaps.join("\n")}\n\nFix every one of them now using tools (analyzeAssets, generateImageForScene, narrateAllScenes, generateMusicForProject, etc.). Don't stop again until they're all resolved.`;
              send({
                type: "text",
                text: `\n[force-continue ${forcedContinues}/${MAX_FORCED_CONTINUES}: ${gaps.length} structural issue${gaps.length === 1 ? "" : "s"} remaining]\n`,
              });
              // Conversation requires the assistant turn before the next user.
              conversation.push({ role: "assistant", content: contentBlocks });
              conversation.push({ role: "user", content: block });
              continue;
            }
            // Truly done.
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
            // "Provider not configured" failures (501-style) don't count
            // toward the consecutive-error cap — those are signals to try a
            // different tool, not stop the whole turn.
            const isConfigFailure =
              !result.ok &&
              /not set|not configured|API_KEY|API_TOKEN|503|501/i.test(result.message);
            if (result.ok || isConfigFailure) {
              consecutiveErrors = 0;
            } else {
              consecutiveErrors++;
            }
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
          // runaway loop where the agent can't find a way forward. Bumped
          // 4 → 10 because a normal turn now hits config-failures (which
          // we tolerate) and real failures get a much longer rope.
          if (consecutiveErrors >= 10) {
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
