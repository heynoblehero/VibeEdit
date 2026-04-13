/**
 * Iterative refinement loop for AI-generated canvas code.
 *
 * After the initial action generation, this module sends canvas code
 * back to Claude for self-critique and improvement. It iterates until
 * the quality score reaches the threshold or max iterations are hit.
 */

import { spawnClaudeRefine } from "./claude-bridge";
import { validateUserCode } from "./code-validator";

const QUALITY_THRESHOLD = 8;
const MAX_REFINEMENT_ITERATIONS = 1;

interface RefinableAction {
	tool: string;
	params: Record<string, unknown>;
}

export async function refineActions(
	actions: RefinableAction[],
	userPrompt: string,
): Promise<RefinableAction[]> {
	const refined = [...actions];

	for (let i = 0; i < refined.length; i++) {
		const action = refined[i];

		if (action.tool !== "insert_generated_image") continue;
		if (!action.params.code && !action.params.color) continue;

		// Only refine actions that have canvas drawing code (not just solid colors)
		const hasCode = typeof action.params.code === "string" && action.params.code.length > 0;
		if (!hasCode) continue;

		let currentCode = action.params.code as string;
		const color = (action.params.color as string) || undefined;

		for (let iter = 0; iter < MAX_REFINEMENT_ITERATIONS; iter++) {
			const prompt = buildRefinePrompt(userPrompt, currentCode, color, iter);
			const result = await spawnClaudeRefine(prompt);

			if (!result) {
				console.log(`[refine] Iteration ${iter + 1} failed (no response), keeping current code`);
				break;
			}

			console.log(`[refine] Iteration ${iter + 1}: score=${result.score}/10 — ${result.explanation.slice(0, 80)}`);

			if (result.score >= QUALITY_THRESHOLD) {
				console.log(`[refine] Quality threshold met (${result.score}/10), done`);
				break;
			}

			// Validate the improved code before accepting it
			const violation = validateUserCode(result.improved_code);
			if (violation) {
				console.log(`[refine] Improved code blocked by validator: ${violation}`);
				break;
			}

			if (result.improved_code && result.improved_code.length > 10) {
				currentCode = result.improved_code;
			}
		}

		refined[i] = {
			...action,
			params: { ...action.params, code: currentCode },
		};
	}

	return refined;
}

function buildRefinePrompt(
	userPrompt: string,
	code: string,
	color: string | undefined,
	iteration: number,
): string {
	const context = iteration === 0
		? "This is the INITIAL generation. Review it critically and improve it significantly."
		: "This is a REVISED version. Push the quality higher — add more detail, better shading, smoother curves.";

	return `The user asked: "${userPrompt}"

${context}

${color ? `Base color fill: ${color} (applied before this code runs)` : "No base color — the code must fill the entire canvas."}

Current Canvas 2D drawing code:
\`\`\`
${code}
\`\`\`

Score this code 1-10 on visual quality, then provide an improved version.

Improvement priorities:
- Characters: add facial features (eyes with pupils + white highlights, curved smile), rounded body with bezierCurveTo, small limbs, drop shadow beneath
- Backgrounds: use multi-stop gradients, subtle noise/texture layers, depth
- Shapes: precise geometry, glow effects (shadowBlur + shadowColor), anti-aliased edges
- General: use ctx.save()/ctx.restore(), layer multiple drawing passes for depth, add subtle details

If the code is already 8+/10 quality, keep it as-is but return the same code with your score.`;
}
