import type Anthropic from "@anthropic-ai/sdk";
import { dispatchAction } from "@/lib/actions/dispatch";
import type { Project, Scene } from "@/lib/scene-schema";

/**
 * Tool registry for the chat agent.
 *
 * Each tool is a thin adapter over `dispatchAction` from
 * `lib/actions/dispatch.ts`. The action layer is the single source of
 * truth for project mutations — both the chat agent AND the client
 * Zustand store flow through it, so behavior never drifts between
 * "user clicked the button" and "agent called the tool."
 *
 * Phase 1 ships 5 core tools: add_scene, update_scene, remove_scene,
 * replace_text, set_background_color. Phase 2 expands to ~17 tools.
 *
 * Each tool's `run` is given:
 *   - the working `Project` for this turn (already includes any prior
 *     tool's mutations earlier in the same turn)
 *   - the parsed args
 * Returns a new `Project` (passed forward to the next tool) plus a
 * tool_result content string (sent back to the model so it can decide
 * what to do next).
 */

export interface ChatToolContext {
	/** The current working project for this turn. */
	project: Project;
}

export interface ChatToolResult {
	/** New project state. Set the same as input.project on no-op. */
	project: Project;
	/** Content sent to the model as the tool_result. */
	content: string;
	/** True if the model should treat this as an error tool_result. */
	isError?: boolean;
}

export interface ChatTool {
	name: string;
	description: string;
	input_schema: Anthropic.Tool["input_schema"];
	run(ctx: ChatToolContext, args: Record<string, unknown>): Promise<ChatToolResult>;
}

/* ------------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------------ */

function dispatch(
	project: Project,
	name: string,
	args: Record<string, unknown>,
): ChatToolResult {
	const result = dispatchAction(project, name, args);
	return {
		project: result.project,
		content: result.message,
		isError: !result.ok,
	};
}

const SCENE_TYPES = [
	"text_only",
	"big_number",
	"stat",
	"bullet_list",
	"quote",
	"montage",
	"character_text",
	"character_pop",
	"split",
	"three_text",
	"three_card",
	"three_particles",
	"bar_chart",
] as const;

/* ------------------------------------------------------------------
 * Tools
 * ------------------------------------------------------------------ */

const addScene: ChatTool = {
	name: "add_scene",
	description:
		"Append a new scene to the project. Provide the type and duration_sec; other fields (text, emphasisText, statValue, etc.) are optional and depend on the scene type. Returns the new scene's id in the tool_result.",
	input_schema: {
		type: "object",
		required: ["type", "duration_sec"],
		properties: {
			type: {
				type: "string",
				enum: SCENE_TYPES as unknown as string[],
				description:
					"Scene template. text_only=hero text, big_number=one huge stat, stat=number+label, bullet_list=animated lines, quote=pull-quote, montage=image carousel, character_text=character image+text, character_pop=character beat, split=left+right halves.",
			},
			duration_sec: {
				type: "number",
				minimum: 0.5,
				maximum: 12,
				description: "Scene duration in seconds. 1.5–3.5s typical for short-form pacing.",
			},
			insert_at: {
				type: "integer",
				minimum: 0,
				description: "0-based index to insert at. Omit to append at the end.",
			},
			text: { type: "string", maxLength: 200 },
			emphasis_text: { type: "string", maxLength: 80 },
			subtitle_text: { type: "string", maxLength: 200 },
			stat_value: { type: "string", maxLength: 16 },
			stat_label: { type: "string", maxLength: 160 },
			bullet_items: {
				type: "array",
				items: { type: "string" },
				maxItems: 6,
			},
			quote_text: { type: "string", maxLength: 240 },
			quote_attribution: { type: "string", maxLength: 80 },
			background_color: {
				type: "string",
				description: "#rrggbb hex.",
			},
			background_image_url: { type: "string" },
			background_video_url: { type: "string" },
		},
	},
	async run(ctx, args) {
		const a = args as {
			type?: string;
			duration_sec?: number;
			insert_at?: number;
			text?: string;
			emphasis_text?: string;
			subtitle_text?: string;
			stat_value?: string;
			stat_label?: string;
			bullet_items?: string[];
			quote_text?: string;
			quote_attribution?: string;
			background_color?: string;
			background_image_url?: string;
			background_video_url?: string;
		};
		// scene.create only accepts a small subset directly (text,
		// emphasisText, etc.). Bridge: create the bare scene, then
		// scene.update for the rest in the same turn.
		const create = dispatch(ctx.project, "scene.create", {
			type: a.type as Scene["type"],
			duration: a.duration_sec ?? 3,
			insertAt: a.insert_at,
			text: a.text,
			emphasisText: a.emphasis_text,
			textColor: undefined,
			backgroundColor: a.background_color,
			backgroundImageUrl: a.background_image_url,
			backgroundVideoUrl: a.background_video_url,
		});
		if (create.isError) return create;

		const newId = (
			(create as { project: Project } & { content: string }).project.scenes.at(-1)?.id ??
			""
		);

		// Apply the rest via scene.update if any are set.
		const patch: Record<string, unknown> = {};
		if (a.subtitle_text !== undefined) patch.subtitleText = a.subtitle_text;
		if (a.stat_value !== undefined) patch.statValue = a.stat_value;
		if (a.stat_label !== undefined) patch.statLabel = a.stat_label;
		if (a.bullet_items !== undefined) patch.bulletItems = a.bullet_items;
		if (a.quote_text !== undefined) patch.quoteText = a.quote_text;
		if (a.quote_attribution !== undefined)
			patch.quoteAttribution = a.quote_attribution;

		if (Object.keys(patch).length === 0) {
			return {
				project: create.project,
				content: `${create.content}. Scene id: ${newId}`,
			};
		}
		const update = dispatch(create.project, "scene.update", {
			id: newId,
			patch,
		});
		return {
			project: update.project,
			content: `${create.content}; ${update.content}. Scene id: ${newId}`,
			isError: update.isError,
		};
	},
};

const updateScene: ChatTool = {
	name: "update_scene",
	description:
		"Patch a scene's fields by scene_id. Pass only the fields you want to change. Use replace_text for text content, set_background_color for backgrounds — those have cleaner schemas.",
	input_schema: {
		type: "object",
		required: ["scene_id", "patch"],
		properties: {
			scene_id: { type: "string" },
			patch: {
				type: "object",
				description:
					"Partial Scene. Common fields: duration, transition, locked, muted, colorTag.",
			},
		},
	},
	async run(ctx, args) {
		const a = args as { scene_id?: string; patch?: Record<string, unknown> };
		return dispatch(ctx.project, "scene.update", {
			id: a.scene_id ?? "",
			patch: a.patch ?? {},
		});
	},
};

const removeScene: ChatTool = {
	name: "remove_scene",
	description:
		"Delete a scene from the project by id. Locked scenes are refused. Drops cuts that touched the deleted scene.",
	input_schema: {
		type: "object",
		required: ["scene_id"],
		properties: {
			scene_id: { type: "string" },
		},
	},
	async run(ctx, args) {
		const a = args as { scene_id?: string };
		return dispatch(ctx.project, "scene.remove", { id: a.scene_id ?? "" });
	},
};

const replaceText: ChatTool = {
	name: "replace_text",
	description:
		"Replace the text in one of a scene's text slots. slot must be one of: 'text' (primary headline), 'emphasis' (the keyword/phrase the viewer should remember), 'subtitle' (smaller line under the headline), 'stat_label' (the label under a big number for type=stat).",
	input_schema: {
		type: "object",
		required: ["scene_id", "slot", "value"],
		properties: {
			scene_id: { type: "string" },
			slot: {
				type: "string",
				enum: ["text", "emphasis", "subtitle", "stat_label", "stat_value", "quote_text", "quote_attribution"],
			},
			value: {
				type: "string",
				maxLength: 240,
				description: "New text. Empty string clears the slot.",
			},
		},
	},
	async run(ctx, args) {
		const a = args as { scene_id?: string; slot?: string; value?: string };
		const slotMap: Record<string, string> = {
			text: "text",
			emphasis: "emphasisText",
			subtitle: "subtitleText",
			stat_label: "statLabel",
			stat_value: "statValue",
			quote_text: "quoteText",
			quote_attribution: "quoteAttribution",
		};
		const field = slotMap[a.slot ?? ""];
		if (!field) {
			return {
				project: ctx.project,
				content: `unknown slot "${a.slot}". Use one of: ${Object.keys(slotMap).join(", ")}.`,
				isError: true,
			};
		}
		const value = a.value ?? "";
		return dispatch(ctx.project, "scene.update", {
			id: a.scene_id ?? "",
			patch: { [field]: value === "" ? undefined : value },
		});
	},
};

const setBackgroundColor: ChatTool = {
	name: "set_background_color",
	description:
		"Set a scene's solid background color. Format must be #rrggbb hex.",
	input_schema: {
		type: "object",
		required: ["scene_id", "color"],
		properties: {
			scene_id: { type: "string" },
			color: { type: "string", description: "#rrggbb hex" },
		},
	},
	async run(ctx, args) {
		const a = args as { scene_id?: string; color?: string };
		const color = a.color ?? "";
		if (!/^#[0-9a-fA-F]{6}$/.test(color)) {
			return {
				project: ctx.project,
				content: `invalid color "${color}" — must be #rrggbb hex`,
				isError: true,
			};
		}
		return dispatch(ctx.project, "scene.update", {
			id: a.scene_id ?? "",
			patch: { backgroundColor: color },
		});
	},
};

/* ------------------------------------------------------------------
 * Registry
 * ------------------------------------------------------------------ */

export const CHAT_TOOLS: ChatTool[] = [
	addScene,
	updateScene,
	removeScene,
	replaceText,
	setBackgroundColor,
];

export const CHAT_TOOL_BY_NAME: Record<string, ChatTool> = Object.fromEntries(
	CHAT_TOOLS.map((t) => [t.name, t]),
);

/** The Anthropic-shaped tool definitions, ready to pass to messages.create. */
export function anthropicToolDefs(): Anthropic.Tool[] {
	return CHAT_TOOLS.map((t) => ({
		name: t.name,
		description: t.description,
		input_schema: t.input_schema,
	}));
}
