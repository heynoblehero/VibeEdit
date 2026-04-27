/**
 * LLM-as-judge for ambiguous cases. Used when programmatic judges
 * can't decide ("is Isaac10.png a reasonable pose for the scene
 * 'we found the answer'?"). The judge call is structured the same way
 * as the existing /api/agent/critic route — Sonnet, max_tokens 512,
 * tool_choice forced to emit_judgment.
 *
 * Costs ~$0.01 per call. Used sparingly — escalation only.
 */

import type { ToolCallTrace } from "../runner/agent-client";
import type { Project } from "../../src/lib/scene-schema";

export interface LlmJudgeArgs {
  /** What was asked of the agent. */
  userMessage: string;
  /** What the agent ended up with. */
  finalProject: Project;
  /** Tool calls the agent made. */
  toolTrace: ToolCallTrace[];
  /** Free-text rubric — describe what counts as a pass. */
  rubric: string;
}

export interface LlmJudgeResult {
  /** 1 (worst) to 5 (perfect). 4+ counts as pass. */
  score: number;
  /** Why it scored what it did (1-2 sentences). */
  reasoning: string;
  /** Did the call succeed at all. */
  ok: boolean;
  errorDetail?: string;
}

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

interface AnthropicResponse {
  content?: Array<{ type: string; text?: string; input?: unknown; name?: string }>;
}

/** Compact a Project to the fields a judge needs — full Project is
 *  ~50KB and most fields don't matter for intent fidelity. */
function compactProject(p: Project): unknown {
  return {
    name: p.name,
    width: p.width,
    height: p.height,
    sceneCount: p.scenes.length,
    totalDurationSec: p.scenes.reduce((acc, s) => acc + (s.duration ?? 0), 0),
    scenes: p.scenes.map((s, i) => ({
      idx: i,
      id: s.id,
      type: s.type,
      duration: s.duration,
      text: s.text?.slice(0, 80),
      emphasisText: (s as Scene & { emphasisText?: string }).emphasisText?.slice(0, 60),
      bg: s.background?.imageUrl ?? s.background?.videoUrl ?? s.background?.color,
      character: (s as Scene & { characterUrl?: string }).characterUrl,
      sfx: s.sceneSfxUrl,
      effectKinds: (s.effects ?? []).map(
        (e) => (e as { kind?: string; type?: string }).kind ?? (e as { type?: string }).type,
      ),
    })),
    qualityScore: (p as Project & { qualityScore?: number }).qualityScore,
  };
}
import type { Scene } from "../../src/lib/scene-schema";

const RUBRIC_SYSTEM = `You are a strict judge for a video-editor agent. You score 1–5:
- 5: agent did exactly what the user asked, on the right scope, with correct asset choices.
- 4: did what was asked but with a minor lapse (small extra change, sub-optimal asset).
- 3: half-right — got the shape but missed an important constraint.
- 2: did something tangentially related; user would not be satisfied.
- 1: ignored the request or did the opposite.
Always emit_judgment with a one-sentence reasoning.`;

export async function llmJudge(args: LlmJudgeArgs): Promise<LlmJudgeResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { ok: false, score: 0, reasoning: "", errorDetail: "ANTHROPIC_API_KEY not set" };
  }
  const userBlock = `RUBRIC FOR THIS CASE:
${args.rubric}

WHAT THE USER ASKED:
${args.userMessage}

TOOL CALLS THE AGENT MADE (${args.toolTrace.length} total):
${args.toolTrace.map((c) => `- ${c.name}(${JSON.stringify(c.args).slice(0, 200)})`).join("\n")}

FINAL PROJECT:
${JSON.stringify(compactProject(args.finalProject), null, 2)}

Emit your judgment.`;

  try {
    const res = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5",
        max_tokens: 512,
        system: RUBRIC_SYSTEM,
        tools: [
          {
            name: "emit_judgment",
            description: "Submit the score + reasoning for this case.",
            input_schema: {
              type: "object",
              properties: {
                score: { type: "integer", minimum: 1, maximum: 5 },
                reasoning: { type: "string" },
              },
              required: ["score", "reasoning"],
            },
          },
        ],
        tool_choice: { type: "tool", name: "emit_judgment" },
        messages: [{ role: "user", content: userBlock }],
      }),
    });
    if (!res.ok) {
      return {
        ok: false,
        score: 0,
        reasoning: "",
        errorDetail: `judge API error ${res.status}`,
      };
    }
    const data = (await res.json()) as AnthropicResponse;
    const tool = (data.content ?? []).find(
      (b) => b.type === "tool_use" && b.name === "emit_judgment",
    );
    const input = (tool?.input ?? {}) as { score?: number; reasoning?: string };
    return {
      ok: true,
      score: typeof input.score === "number" ? input.score : 0,
      reasoning: input.reasoning ?? "",
    };
  } catch (e) {
    return {
      ok: false,
      score: 0,
      reasoning: "",
      errorDetail: e instanceof Error ? e.message : String(e),
    };
  }
}
