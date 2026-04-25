// Sub-agent: a focused critic with NO editing tools and a clean view of
// the project. Modeled on Claude Code's code-reviewer subagent — the
// parent agent calls this via the selfCritique tool and gets back ranked
// findings. Critic doesn't see the parent's chain-of-thought, so it
// doesn't rationalize laziness.

import type { NextRequest } from "next/server";
import { callClaude } from "@/lib/server/claude-bridge";
import type { Project } from "@/lib/scene-schema";

export const runtime = "nodejs";
export const maxDuration = 120;

interface CriticRequest {
  project: Project;
  objective?: string;
  focus?: string;
}

const CRITIC_PROMPT = `You are VibeEdit's video critic. You evaluate a project's current state against the user's stated objective and return a ranked list of issues.

Be the smartest, harshest editor on the team. Look for:

- Visual gaps: scenes with no imagery, repetitive background colors, missing motion on key beats.
- Audio gaps: text without narration, no backing music on a 30s+ video, no SFX on transitions / hooks / reveals.
- Pacing: scenes too short (<1.5s feels rushed), too long (>4s drags), uniform durations (kills rhythm).
- Narrative: weak hook in scene 1, no payoff in last scene, unclear progression.
- Asset usage: user uploaded files but agent didn't use them, or agent generated duplicates of uploaded content.
- Workflow fit: scene types don't match the topic (e.g. character_text on a Pokemon story).
- Consistency: repeated colors back-to-back, mismatched voice tone vs. content.

Severity:
- high — blocks publish, must fix.
- medium — noticeable, should fix.
- low — polish.

Return ≤10 findings, ranked. Each maps to ONE scene or to "project" for global issues. Provide a concrete suggested fix.

Emit via emit_critique. If the project is genuinely good, return ≤2 low-severity findings.`;

const TOOL_SCHEMA = {
  name: "emit_critique",
  description: "Emit ranked critique findings.",
  input_schema: {
    type: "object",
    properties: {
      findings: {
        type: "array",
        items: {
          type: "object",
          properties: {
            sceneId: {
              type: "string",
              description:
                'Scene id, or "project" for global issues (music, pacing across video).',
            },
            severity: { type: "string", enum: ["high", "medium", "low"] },
            issue: { type: "string" },
            suggestion: { type: "string" },
          },
          required: ["sceneId", "severity", "issue", "suggestion"],
        },
      },
    },
    required: ["findings"],
  },
};

export async function POST(request: NextRequest) {
  const body = (await request.json()) as CriticRequest;
  if (!body.project?.scenes?.length) {
    return Response.json({ findings: [] });
  }

  const summary = body.project.scenes
    .map((s, i) => {
      const label = s.emphasisText || s.text || s.type;
      return `${i + 1}. id=${s.id} type=${s.type} dur=${s.duration}s ` +
        `bg=${s.background?.imageUrl ? "image" : s.background?.videoUrl ? "video" : `color(${s.background?.color ?? "?"})`} ` +
        `voice=${s.voiceover?.audioUrl ? "yes" : "no"} ` +
        `sfx=${s.sceneSfxUrl || s.sfxId ? "yes" : "no"} | "${label}"`;
    })
    .join("\n");

  const objectiveLine = body.objective
    ? `User's objective: ${body.objective}\n\n`
    : body.project.systemPrompt
      ? `User's objective: ${body.project.systemPrompt}\n\n`
      : "";
  const focusLine = body.focus ? `Focus: ${body.focus}\n\n` : "";
  const userMessage = `${objectiveLine}${focusLine}Project: "${body.project.name}" — ${body.project.scenes.length} scenes, ${body.project.width}x${body.project.height}, music=${body.project.music ? "yes" : "no"}, workflow=${body.project.workflowId ?? "blank"}\n\nScenes:\n${summary}`;

  try {
    const data = await callClaude(
      {
        model: "claude-sonnet-4-5",
        max_tokens: 4096,
        system: [
          { type: "text", text: CRITIC_PROMPT, cache_control: { type: "ephemeral" } },
        ],
        tools: [TOOL_SCHEMA],
        tool_choice: { type: "tool", name: "emit_critique" },
        messages: [{ role: "user", content: userMessage }],
      },
      "critic",
    );
    const toolUse = data.content?.find((c) => c.type === "tool_use");
    const findings = (toolUse?.input?.findings ?? []) as Array<{
      sceneId: string;
      severity: string;
      issue: string;
      suggestion: string;
    }>;
    return Response.json({ findings });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}
