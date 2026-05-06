import type Anthropic from "@anthropic-ai/sdk";
import { emitProjectInputSchema } from "./draft-schema";

/**
 * Phase A toolbox — only `emit_project`. Phase B+ adds clarify, upload,
 * web-fetch, patch, critique. Each tool stays here as a single source
 * of truth; stages reference the subset they want by name.
 */
export const TOOLS: Anthropic.Tool[] = [
	{
		name: "emit_project",
		description:
			"Emit the final video project draft. Call this exactly once when you're confident the scenes will produce a watchable video. The runner validates the output against a Zod schema and applies it to the editor — bad shapes get rejected and you'll be asked to retry.",
		input_schema: emitProjectInputSchema,
	},
];

export const TOOL_BY_NAME = Object.fromEntries(
	TOOLS.map((t) => [t.name, t]),
) as Record<string, Anthropic.Tool>;
