import type Anthropic from "@anthropic-ai/sdk";
import { emitProjectInputSchema } from "./draft-schema";

/**
 * Phase B toolbox.
 *
 * The agent picks which tool to call on each turn. The runner loops
 * until the model calls `emit_project` (terminal) or we hit the turn
 * cap. `ask_user` and `request_user_upload` pause the run — the
 * `tool_result` for those calls is supplied by the user via the
 * /respond endpoint, then the loop continues.
 *
 * Phases C/D add: web_fetch_pexels (skipped in v1), submit_critique,
 * patch_project.
 */
export const TOOLS: Anthropic.Tool[] = [
	{
		name: "ask_user",
		description:
			"Ask the user 1-4 clarifying questions before generating. Use this early when the prompt is ambiguous about audience, tone, length, or core message. The run pauses until the user answers — you'll get the answers back as a tool_result. Don't ask questions whose answers you can reasonably infer; reserve this for genuinely load-bearing decisions.",
		input_schema: {
			type: "object",
			required: ["questions"],
			properties: {
				questions: {
					type: "array",
					minItems: 1,
					maxItems: 4,
					description: "List of questions to ask in one batch.",
					items: {
						type: "object",
						required: ["id", "prompt"],
						properties: {
							id: {
								type: "string",
								description:
									"Stable id (snake_case, ≤ 32 chars). Used to thread answers back.",
							},
							prompt: {
								type: "string",
								description:
									"The question text. Phrase it conversationally and keep it short.",
							},
							suggestions: {
								type: "array",
								items: { type: "string" },
								maxItems: 4,
								description:
									"Optional 1-4 suggested answers the user can tap instead of typing.",
							},
						},
					},
				},
			},
		},
	},
	{
		name: "request_user_upload",
		description:
			"Ask the user to upload an asset (image, video, or audio). Use ONLY when the video genuinely needs media you don't have — e.g. user said 'a video about my dog' and there are no project uploads of a dog. The run pauses until the user uploads, then resumes with the public URL as the tool_result. If you have no need for media, skip this and pick scene types that don't require URLs (text_only, big_number, stat, bullet_list, quote).",
		input_schema: {
			type: "object",
			required: ["slotId", "description", "mediaType"],
			properties: {
				slotId: {
					type: "string",
					description: "Stable id (snake_case, ≤ 32 chars).",
				},
				description: {
					type: "string",
					description:
						"Short, friendly description of what to upload, e.g. 'A photo of your face for the intro scene' or 'A clip of you cooking, ~5 seconds'.",
				},
				mediaType: {
					type: "string",
					enum: ["image", "video", "audio"],
				},
			},
		},
	},
	{
		name: "emit_project",
		description:
			"Emit the final video project draft. Call this exactly once when you have enough context to produce a watchable video. The runner validates the output against a Zod schema and finishes the run — bad shapes get rejected and you'll be asked to retry.",
		input_schema: emitProjectInputSchema,
	},
];

export const TOOL_BY_NAME = Object.fromEntries(
	TOOLS.map((t) => [t.name, t]),
) as Record<string, Anthropic.Tool>;

export interface ClarifyQuestion {
	id: string;
	prompt: string;
	suggestions?: string[];
}

export interface UploadRequest {
	slotId: string;
	description: string;
	mediaType: "image" | "video" | "audio";
}
