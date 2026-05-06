import { z } from "zod";
import {
	type Project,
	type Scene,
	type SceneBackground,
	createId,
	DIMENSIONS,
} from "@/lib/scene-schema";

/**
 * Zod schema for the *agent's* draft project — a deliberately small
 * subset of the full `Project` / `Scene` types in scene-schema.ts.
 *
 * Two reasons to keep it narrow:
 * 1. Schema discipline — the agent can only emit fields we've verified
 *    the renderer handles cleanly. Untested combos (3D scenes, chroma
 *    keys, motion clips) stay locked away until we deliberately open them.
 * 2. Smaller `tool` schemas mean cheaper prompts and fewer hallucinations
 *    — the model isn't tempted to fill in 60 obscure optional fields.
 *
 * The runner's `materializeDraft()` converts a `DraftProject` into a
 * full `Project` (filling in ids, fps, dimensions, default background).
 */

export const DRAFT_SCENE_TYPES = [
	"text_only",
	"big_number",
	"stat",
	"bullet_list",
	"quote",
	"montage",
] as const;

const colorHex = z
	.string()
	.regex(/^#[0-9a-fA-F]{6}$/, "color must be #rrggbb hex");

const draftBackground = z.object({
	color: colorHex.default("#0a0a0a"),
	imageUrl: z.string().url().optional(),
	videoUrl: z.string().url().optional(),
	colorGrade: z
		.enum(["warm", "cool", "punchy", "bw", "neutral"])
		.optional(),
});

const draftSceneBase = z.object({
	id: z
		.string()
		.min(1)
		.optional()
		.describe("Stable id. Omit and the runner will mint one."),
	type: z.enum(DRAFT_SCENE_TYPES),
	durationSec: z
		.number()
		.min(0.5)
		.max(15)
		.describe("Scene duration in seconds (0.5 – 15). Will be converted to frames."),
	background: draftBackground.default({ color: "#0a0a0a" }),

	text: z.string().max(140).optional().describe("Primary headline text"),
	emphasisText: z
		.string()
		.max(60)
		.optional()
		.describe("Larger, accent-color sub-headline"),
	subtitleText: z.string().max(140).optional(),

	statValue: z
		.string()
		.max(8)
		.optional()
		.describe("e.g. '73%' — for type=stat or big_number"),
	statLabel: z.string().max(120).optional(),

	bulletItems: z
		.array(z.string().max(80))
		.min(2)
		.max(6)
		.optional()
		.describe("Lines for type=bullet_list (2–6 items)"),

	quoteText: z.string().max(220).optional(),
	quoteAttribution: z.string().max(60).optional(),

	montageUrls: z
		.array(z.string().url())
		.min(2)
		.max(8)
		.optional()
		.describe("Image URLs for type=montage. Plays in order."),

	transition: z
		.enum(["none", "beat_flash", "slide_left", "slide_right", "zoom_blur"])
		.optional(),
});

/**
 * Refine per-type invariants — Zod's discriminated unions get verbose
 * with this many shared fields, so do the cross-checks in `superRefine`.
 */
export const DraftSceneSchema = draftSceneBase.superRefine((scene, ctx) => {
	const fail = (path: string[], message: string) =>
		ctx.addIssue({ code: z.ZodIssueCode.custom, path, message });

	switch (scene.type) {
		case "text_only":
			if (!scene.text && !scene.emphasisText)
				fail(["text"], "text_only needs `text` or `emphasisText`");
			break;
		case "big_number":
			if (!scene.statValue) fail(["statValue"], "big_number needs `statValue`");
			break;
		case "stat":
			if (!scene.statValue) fail(["statValue"], "stat needs `statValue`");
			if (!scene.statLabel) fail(["statLabel"], "stat needs `statLabel`");
			break;
		case "bullet_list":
			if (!scene.bulletItems || scene.bulletItems.length < 2)
				fail(["bulletItems"], "bullet_list needs at least 2 items");
			break;
		case "quote":
			if (!scene.quoteText) fail(["quoteText"], "quote needs `quoteText`");
			break;
		case "montage":
			if (!scene.montageUrls || scene.montageUrls.length < 2)
				fail(["montageUrls"], "montage needs at least 2 image URLs");
			break;
	}
});

export type DraftScene = z.infer<typeof DraftSceneSchema>;

export const DraftProjectSchema = z.object({
	name: z.string().min(1).max(80).describe("Short project title"),
	orientation: z
		.enum(["landscape", "portrait"])
		.default("landscape")
		.describe("9:16 portrait for shorts/reels, 16:9 landscape otherwise"),
	scenes: z.array(DraftSceneSchema).min(1).max(20),
});

export type DraftProject = z.infer<typeof DraftProjectSchema>;

/**
 * Convert a validated DraftProject into a full Project that the
 * editor's `setProject()` can accept and the renderer can ingest.
 *
 * - mints scene ids when missing
 * - converts seconds → frames at 30fps
 * - fills in DEFAULT_BG fields the agent didn't bother with
 * - resolves orientation → width/height from DIMENSIONS
 *
 * Existing project id is reused so we don't proliferate drafts in
 * the project list when the agent is iterating.
 */
export function materializeDraft(
	draft: DraftProject,
	options: { existingProjectId?: string } = {},
): Project {
	const fps = 30;
	const dims = DIMENSIONS[draft.orientation];

	const scenes: Scene[] = draft.scenes.map((s) => {
		const background: SceneBackground = {
			color: s.background.color,
			...(s.background.imageUrl ? { imageUrl: s.background.imageUrl } : {}),
			...(s.background.videoUrl ? { videoUrl: s.background.videoUrl } : {}),
			...(s.background.colorGrade
				? { colorGrade: s.background.colorGrade }
				: {}),
		};
		const scene: Scene = {
			id: s.id ?? createId(),
			type: s.type,
			duration: Math.max(1, Math.round(s.durationSec * fps)),
			background,
			...(s.text ? { text: s.text } : {}),
			...(s.emphasisText ? { emphasisText: s.emphasisText } : {}),
			...(s.subtitleText ? { subtitleText: s.subtitleText } : {}),
			...(s.statValue ? { statValue: s.statValue } : {}),
			...(s.statLabel ? { statLabel: s.statLabel } : {}),
			...(s.bulletItems ? { bulletItems: s.bulletItems } : {}),
			...(s.quoteText ? { quoteText: s.quoteText } : {}),
			...(s.quoteAttribution ? { quoteAttribution: s.quoteAttribution } : {}),
			...(s.montageUrls ? { montageUrls: s.montageUrls } : {}),
			...(s.transition ? { transition: s.transition } : {}),
		};
		return scene;
	});

	return {
		id: options.existingProjectId ?? createId(),
		name: draft.name,
		script: "",
		fps,
		width: dims.width,
		height: dims.height,
		scenes,
		updatedAt: Date.now(),
	};
}

/**
 * The JSON-schema shape the model sees as the `emit_project` tool's
 * input_schema. Hand-rolled rather than zod-to-json so we can keep the
 * descriptions tight and Anthropic-friendly.
 */
export const emitProjectInputSchema = {
	type: "object" as const,
	required: ["name", "scenes"],
	properties: {
		name: {
			type: "string",
			description: "Short, memorable project title (≤ 80 chars)",
		},
		orientation: {
			type: "string",
			enum: ["landscape", "portrait"],
			description:
				"'portrait' = 9:16 (TikTok/Reels). 'landscape' = 16:9. Default landscape.",
		},
		scenes: {
			type: "array",
			minItems: 1,
			maxItems: 20,
			description:
				"Ordered scenes that play back-to-back. Aim for 3-8 scenes, ~3-6s each.",
			items: {
				type: "object",
				required: ["type", "durationSec"],
				properties: {
					type: {
						type: "string",
						enum: DRAFT_SCENE_TYPES,
						description:
							"text_only: hero text. big_number: a single huge stat. stat: number + label. bullet_list: 2-6 lines. quote: pull-quote. montage: image carousel.",
					},
					durationSec: {
						type: "number",
						minimum: 0.5,
						maximum: 15,
					},
					background: {
						type: "object",
						properties: {
							color: { type: "string", description: "#rrggbb hex" },
							imageUrl: { type: "string" },
							videoUrl: { type: "string" },
							colorGrade: {
								type: "string",
								enum: ["warm", "cool", "punchy", "bw", "neutral"],
							},
						},
					},
					text: { type: "string", maxLength: 140 },
					emphasisText: { type: "string", maxLength: 60 },
					subtitleText: { type: "string", maxLength: 140 },
					statValue: {
						type: "string",
						maxLength: 8,
						description: "e.g. '73%', '1M', '3.4x'",
					},
					statLabel: { type: "string", maxLength: 120 },
					bulletItems: {
						type: "array",
						items: { type: "string", maxLength: 80 },
						minItems: 2,
						maxItems: 6,
					},
					quoteText: { type: "string", maxLength: 220 },
					quoteAttribution: { type: "string", maxLength: 60 },
					montageUrls: {
						type: "array",
						items: { type: "string" },
						minItems: 2,
						maxItems: 8,
					},
					transition: {
						type: "string",
						enum: ["none", "beat_flash", "slide_left", "slide_right", "zoom_blur"],
					},
				},
			},
		},
	},
};
