/**
 * Prompt mutator. Given a failure cluster and ~10 sample failed cases,
 * asks Sonnet for ONE surgical edit to SYSTEM_PROMPT. Returns a unified
 * diff + description + rationale. Returns null on API error.
 *
 * Same fetch-to-Anthropic pattern as eval/judges/llm-judge.ts. Sonnet,
 * tool_choice forced to emit_mutation, max_tokens 2048.
 */

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { CaseResult } from "../runner/case-types";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

const ROUTE_PATH = resolve(__dirname, "../../src/app/api/agent/route.ts");

interface AnthropicResponse {
  content?: Array<{ type: string; text?: string; input?: unknown; name?: string }>;
}

export interface ProposedMutation {
  description: string;
  diff: string;
  rationale: string;
}

const MUTATOR_SYSTEM = `You're improving a video-editor agent's SYSTEM_PROMPT to fix a specific failure cluster. Read the current prompt and the failing cases, then propose ONE surgical edit — add a constraint, clarify a rule, or fix an ambiguity.

Output a unified diff (use \`+\` and \`-\` line markers, no @@ hunk headers needed; describe the change in plain English in the description). The change must be MINIMAL — one new sentence, one tweaked rule, one added constraint. Don't rewrite paragraphs.

Avoid these anti-patterns:
- "DO NOT EVER..." — agents game it. Use specific behavioural rules instead.
- Adding examples — they bloat the prompt without changing behaviour.
- Telling the agent to "think harder" — never works.
- Conflicting with existing rules — read the prompt, find harmony.

Emit emit_mutation with description (one sentence what changes), diff (the unified diff), rationale (why this fixes the cluster).`;

/**
 * Extract the SYSTEM_PROMPT template-literal body from the agent route
 * source. Looks for `const SYSTEM_PROMPT = \`...\`;`.
 */
export async function readCurrentPrompt(routePath: string = ROUTE_PATH): Promise<string> {
  const src = await readFile(routePath, "utf8");
  // Greedy match across template literal — backticks don't legally
  // appear inside this prompt body so plain regex is fine.
  const m = src.match(/const SYSTEM_PROMPT = `([\s\S]*?)`;/);
  if (!m || !m[1]) {
    throw new Error(`Could not extract SYSTEM_PROMPT from ${routePath}`);
  }
  return m[1];
}

function summarizeCase(r: CaseResult): string {
  const fails = r.failures.map((f) => `${f.kind}: ${f.detail}`).join("; ");
  const tools = r.toolTrace
    .slice(0, 12)
    .map((t) => t.name)
    .join(" → ");
  return `[${r.caseId} t${r.tier}/${r.category}] failures=${fails || "(none)"} tools=${tools || "(no calls)"}`;
}

export async function proposeMutation(
  cluster: string,
  samples: CaseResult[],
  opts: { apiKey?: string; routePath?: string } = {},
): Promise<ProposedMutation | null> {
  const apiKey = opts.apiKey ?? process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  let currentPrompt: string;
  try {
    currentPrompt = await readCurrentPrompt(opts.routePath);
  } catch {
    return null;
  }

  const trimmed = samples.slice(0, 10);
  const userBlock = `FAILURE CLUSTER: ${cluster}

CURRENT SYSTEM_PROMPT:
\`\`\`
${currentPrompt}
\`\`\`

FAILING CASES (${trimmed.length} samples):
${trimmed.map(summarizeCase).join("\n")}

Propose ONE surgical edit. Emit emit_mutation.`;

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
        max_tokens: 2048,
        system: MUTATOR_SYSTEM,
        tools: [
          {
            name: "emit_mutation",
            description: "Submit one surgical edit to SYSTEM_PROMPT.",
            input_schema: {
              type: "object",
              properties: {
                description: { type: "string" },
                diff: { type: "string" },
                rationale: { type: "string" },
              },
              required: ["description", "diff", "rationale"],
            },
          },
        ],
        tool_choice: { type: "tool", name: "emit_mutation" },
        messages: [{ role: "user", content: userBlock }],
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as AnthropicResponse;
    const tool = (data.content ?? []).find(
      (b) => b.type === "tool_use" && b.name === "emit_mutation",
    );
    const input = (tool?.input ?? {}) as Partial<ProposedMutation>;
    if (!input.description || !input.diff || !input.rationale) return null;
    return {
      description: input.description,
      diff: input.diff,
      rationale: input.rationale,
    };
  } catch {
    return null;
  }
}
