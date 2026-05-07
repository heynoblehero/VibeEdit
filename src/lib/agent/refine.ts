import type Anthropic from "@anthropic-ai/sdk";
import { AGENT_MODEL, getAnthropic } from "@/lib/server/anthropic-client";
import type { Critique } from "./critic";
import {
	type DraftProject,
	DraftProjectSchema,
	emitProjectInputSchema,
} from "./draft-schema";

/**
 * Refine stage. Given the previous draft + the Critic's notes, ask
 * Creator to emit a new improved draft. Single-shot, tool_choice
 * forces emit_project so we don't loop here.
 *
 * Phase D: this is the inner step of the critic loop. Returns the
 * validated DraftProject (already Zod-checked) so the runner can
 * push it through render→critique on the next round.
 */

const REFINE_SYSTEM_PROMPT = `You are the Creator agent inside VibeEdit. The previous draft was rendered and reviewed by a Critic agent. Emit a refined draft that addresses the critique.

# Refine rules
- Address the highest-severity issues first.
- Don't regress what was working — preserve good scenes, fix broken ones.
- Keep the same overall concept and orientation. Don't pivot the topic.
- Reuse asset URLs that were in the previous draft (montageUrls, background.imageUrl/videoUrl) — they're real files; invented URLs would 404.

# Same hard rules as Creator (still apply on every refine)
- Each scene 1.5–3.5s typical, NEVER 5+s.
- Total ≤ 60s.
- 6+ scenes for ≥ 15s targets.
- Vary background.color, background.colorGrade, scene types, and transitions across scenes.
- Narrative arc: hook (1.5-2.5s) → development → payoff. Three flat scenes is a fail.
- BANNED filler: "Make yours count.", "Start now.", "Brew better.", "X matters.", "Take it to the next level.", "Every X tells a story." — every line must say something specific.
- Hex colors must be \`#rrggbb\`.

# If the previous draft had pacing/filler issues, you MUST split scenes
If the Critic said "feels long" or "scenes drag", DO NOT just trim a word — split each long scene into 2 shorter ones with their own beat. Add scenes if the runtime budget allows.

Tool calls are your output. Don't narrate.`;

const REFINE_TOOL: Anthropic.Tool = {
	name: "emit_project",
	description:
		"Emit the revised draft. Validated against the same schema as the original.",
	input_schema: emitProjectInputSchema,
};

export async function refineDraft(input: {
	previous: DraftProject;
	critique: Critique;
}): Promise<DraftProject> {
	const { previous, critique } = input;
	const client = getAnthropic();

	const userMessage = [
		"## Previous draft",
		"```json",
		JSON.stringify(previous, null, 2),
		"```",
		"",
		`## Critic score: ${critique.score} / 10`,
		"",
		`### Summary`,
		critique.summary,
		"",
		`### Issues to address`,
		critique.issues.length > 0
			? critique.issues
					.map(
						(i, idx) =>
							`${idx + 1}. [${i.severity}]${
								i.sceneId ? ` (scene ${i.sceneId})` : ""
							} ${i.suggestion}`,
					)
					.join("\n")
			: "(no specific issues — focus on push from current score → 10)",
		"",
		"Now emit the revised draft via emit_project.",
	].join("\n");

	const response = await client.messages.create({
		model: AGENT_MODEL,
		max_tokens: 4096,
		system: REFINE_SYSTEM_PROMPT,
		tools: [REFINE_TOOL],
		tool_choice: { type: "tool", name: "emit_project" },
		messages: [{ role: "user", content: userMessage }],
	});

	const toolUse = response.content.find(
		(b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
	);
	if (!toolUse || toolUse.name !== "emit_project") {
		throw new Error("Refine: model did not call emit_project");
	}
	const parsed = DraftProjectSchema.safeParse(toolUse.input);
	if (!parsed.success) {
		const issues = parsed.error.issues
			.slice(0, 8)
			.map((i) => `· ${i.path.join(".") || "(root)"}: ${i.message}`)
			.join("\n");
		throw new Error(`Refine: draft failed validation:\n${issues}`);
	}
	return parsed.data;
}
