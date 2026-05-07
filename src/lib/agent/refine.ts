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

const REFINE_SYSTEM_PROMPT = `You are the Creator agent inside VibeEdit. The previous draft was rendered and reviewed by a Critic agent. Your job: emit a refined draft that addresses the critique.

# Rules
- DO NOT regress the things that were working. The Critic flagged what to fix; preserve everything else.
- Address the highest-severity issues first. If the Critic listed 5 issues, the top 2 matter most.
- KEEP the same overall concept and orientation. Don't pivot the topic.
- Reuse asset URLs that were in the previous draft (montageUrls, background.imageUrl/videoUrl) — they're real files; new URLs would 404.
- If a scene is broken (e.g. text too dense), restructure it. Don't just trim a word.
- You can change scene count if the critique implies it (e.g. "video drags after scene 5" → cut scenes 6-7).

# Output
Tool calls are your output. Don't narrate, don't justify — call emit_project with the full revised draft.`;

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
