import type Anthropic from "@anthropic-ai/sdk";
import { dispatchAction } from "@/lib/actions/dispatch";
import type { Project, Scene, Voiceover } from "@/lib/scene-schema";
import { searchStock, type StockKind } from "@/lib/server/pexels";
import {
	getJob,
	startRenderJob,
} from "@/lib/server/render-jobs";
import { sampleVideo } from "@/lib/server/sample-frames";
import { generateTts } from "@/lib/server/tts";
import { critiqueDraft } from "./critic";

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
	/** Server-resolved request origin (e.g. https://vibevideoedit.com).
	 *  Needed by render_preview's preflight HEAD checks against any
	 *  scene-referenced URLs. */
	origin: string;
	/** Mutable per-turn counters. Tools can check + increment to
	 *  enforce caps (e.g. 1 critique per turn). */
	turnCounters: {
		critiqueCalls: number;
		renderPreviewCalls: number;
	};
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

const moveScene: ChatTool = {
	name: "move_scene",
	description:
		"Move a scene to a new position in the timeline. Use scene_id (preferred) or from_index. to_index is 0-based.",
	input_schema: {
		type: "object",
		required: ["to_index"],
		properties: {
			scene_id: { type: "string" },
			from_index: { type: "integer", minimum: 0 },
			to_index: { type: "integer", minimum: 0 },
		},
	},
	async run(ctx, args) {
		const a = args as { scene_id?: string; from_index?: number; to_index?: number };
		return dispatch(ctx.project, "scene.move", {
			id: a.scene_id,
			fromIndex: a.from_index,
			toIndex: a.to_index ?? 0,
		});
	},
};

const duplicateScene: ChatTool = {
	name: "duplicate_scene",
	description:
		"Duplicate a scene. The copy is inserted directly after the source and gets a fresh id.",
	input_schema: {
		type: "object",
		required: ["scene_id"],
		properties: {
			scene_id: { type: "string" },
		},
	},
	async run(ctx, args) {
		const a = args as { scene_id?: string };
		return dispatch(ctx.project, "scene.duplicate", { id: a.scene_id ?? "" });
	},
};

const retimeScene: ChatTool = {
	name: "retime_scene",
	description:
		"Change a scene's duration in seconds. Short-form pacing — 1.5–3.5s typical, 4s max.",
	input_schema: {
		type: "object",
		required: ["scene_id", "duration_sec"],
		properties: {
			scene_id: { type: "string" },
			duration_sec: { type: "number", minimum: 0.5, maximum: 12 },
		},
	},
	async run(ctx, args) {
		const a = args as { scene_id?: string; duration_sec?: number };
		return dispatch(ctx.project, "scene.update", {
			id: a.scene_id ?? "",
			patch: { duration: Math.max(0.5, Math.min(12, a.duration_sec ?? 3)) },
		});
	},
};

const setBackgroundMedia: ChatTool = {
	name: "set_background_media",
	description:
		"Set a scene's background image or video URL. kind = 'image' sets imageUrl; kind = 'video' sets videoUrl. Pass empty string to clear. Only use URLs that came from the user (project.uploads in the summary) — never fabricate URLs.",
	input_schema: {
		type: "object",
		required: ["scene_id", "url", "kind"],
		properties: {
			scene_id: { type: "string" },
			url: { type: "string" },
			kind: { type: "string", enum: ["image", "video"] },
		},
	},
	async run(ctx, args) {
		const a = args as { scene_id?: string; url?: string; kind?: string };
		const url = a.url ?? "";
		const patch: Record<string, unknown> = {};
		if (a.kind === "image") patch.backgroundImageUrl = url || undefined;
		else if (a.kind === "video") patch.backgroundVideoUrl = url || undefined;
		else
			return {
				project: ctx.project,
				content: `kind must be 'image' or 'video', got "${a.kind}"`,
				isError: true,
			};
		return dispatch(ctx.project, "scene.update", {
			id: a.scene_id ?? "",
			patch,
		});
	},
};

const setOrientation: ChatTool = {
	name: "set_orientation",
	description:
		"Set the project canvas orientation. portrait = 9:16 (TikTok/Reels/Shorts). landscape = 16:9.",
	input_schema: {
		type: "object",
		required: ["orientation"],
		properties: {
			orientation: { type: "string", enum: ["portrait", "landscape"] },
		},
	},
	async run(ctx, args) {
		const a = args as { orientation?: string };
		return dispatch(ctx.project, "project.orientation.set", {
			orientation: a.orientation ?? "portrait",
		});
	},
};

const applyPalette: ChatTool = {
	name: "apply_palette",
	description:
		"Apply a 2-6 color palette across the scene backgrounds. Colors cycle across scenes for visual variety. Hex format #rrggbb required. First color is the bg base.",
	input_schema: {
		type: "object",
		required: ["colors"],
		properties: {
			colors: {
				type: "array",
				minItems: 2,
				maxItems: 6,
				items: { type: "string", description: "#rrggbb hex" },
			},
		},
	},
	async run(ctx, args) {
		const a = args as { colors?: string[] };
		return dispatch(ctx.project, "project.palette.apply", {
			colors: a.colors ?? [],
		});
	},
};

const applyStylePreset: ChatTool = {
	name: "apply_style_preset",
	description:
		"Apply a named style preset (palette + typography + motion defaults) across all scenes. Examples: 'minimal', 'bold', 'punchy', 'pastel', 'editorial'.",
	input_schema: {
		type: "object",
		required: ["preset_id"],
		properties: {
			preset_id: { type: "string" },
		},
	},
	async run(ctx, args) {
		const a = args as { preset_id?: string };
		return dispatch(ctx.project, "project.style.preset.apply", {
			presetId: a.preset_id ?? "",
		});
	},
};

const setMusic: ChatTool = {
	name: "set_music",
	description:
		"Set the project's background music bed. Only use URLs from the user (project.uploads) — never fabricate.",
	input_schema: {
		type: "object",
		required: ["url"],
		properties: {
			url: { type: "string" },
			name: { type: "string" },
			volume: { type: "number", minimum: 0, maximum: 1 },
			ducked_volume: {
				type: "number",
				minimum: 0,
				maximum: 1,
				description:
					"Music volume while voiceover plays. Default 0.18 (heavily ducked).",
			},
		},
	},
	async run(ctx, args) {
		const a = args as {
			url?: string;
			name?: string;
			volume?: number;
			ducked_volume?: number;
		};
		return dispatch(ctx.project, "music.set", {
			url: a.url ?? "",
			name: a.name,
			volume: a.volume,
			duckedVolume: a.ducked_volume,
		});
	},
};

const upsertCut: ChatTool = {
	name: "upsert_cut",
	description:
		"Set or replace the transition between two consecutive scenes. kind = 'hard' (no transition, instant), 'fade' (cross-fade), or 'dissolve' (longer cross-fade). duration_frames at 30fps: 6 frames = 0.2s, 12 = 0.4s.",
	input_schema: {
		type: "object",
		required: ["from_scene_id", "to_scene_id", "kind", "duration_frames"],
		properties: {
			from_scene_id: { type: "string" },
			to_scene_id: { type: "string" },
			kind: { type: "string", enum: ["hard", "fade", "dissolve"] },
			duration_frames: { type: "integer", minimum: 0, maximum: 60 },
		},
	},
	async run(ctx, args) {
		const a = args as {
			from_scene_id?: string;
			to_scene_id?: string;
			kind?: string;
			duration_frames?: number;
		};
		return dispatch(ctx.project, "cut.upsert", {
			fromSceneId: a.from_scene_id ?? "",
			toSceneId: a.to_scene_id ?? "",
			kind: a.kind ?? "hard",
			durationFrames: a.duration_frames ?? 0,
		});
	},
};

const applyMotionPreset: ChatTool = {
	name: "apply_motion_preset",
	description:
		"Apply a motion preset to one of a scene's elements. element ∈ {text, emphasis, character, bg}. preset = none|drift_up|drift_down|pulse|shake|ken_burns_in|ken_burns_out|parallax_slow|parallax_fast|bounce_in|bounce_pop_in|stagger_fade_scale|fade_in_out|wobble.",
	input_schema: {
		type: "object",
		required: ["scene_id", "element", "preset"],
		properties: {
			scene_id: { type: "string" },
			element: {
				type: "string",
				enum: ["text", "emphasis", "character", "bg"],
			},
			preset: { type: "string" },
		},
	},
	async run(ctx, args) {
		const a = args as { scene_id?: string; element?: string; preset?: string };
		return dispatch(ctx.project, "motion.preset.set", {
			sceneId: a.scene_id ?? "",
			element: a.element ?? "text",
			preset: a.preset ?? "none",
		});
	},
};

const setCaptionStyle: ChatTool = {
	name: "set_caption_style",
	description:
		"Patch the burned-in caption style (typography, position, highlight color). Only pass fields you want to change. Set highlight_color to '' to disable.",
	input_schema: {
		type: "object",
		properties: {
			font_size: { type: "number", minimum: 16, maximum: 200 },
			color: { type: "string" },
			stroke_color: { type: "string" },
			highlight_color: { type: "string" },
			position: { type: "string", enum: ["auto", "top", "center", "bottom"] },
			max_words_per_chunk: { type: "integer", minimum: 1, maximum: 8 },
			uppercase: { type: "boolean" },
		},
	},
	async run(ctx, args) {
		const a = args as Record<string, unknown>;
		const argMap: Record<string, string> = {
			font_size: "fontSize",
			color: "color",
			stroke_color: "strokeColor",
			highlight_color: "highlightColor",
			position: "position",
			max_words_per_chunk: "maxWordsPerChunk",
			uppercase: "uppercase",
		};
		const patch: Record<string, unknown> = {};
		for (const [snake, camel] of Object.entries(argMap)) {
			if (a[snake] !== undefined) patch[camel] = a[snake];
		}
		return dispatch(ctx.project, "caption.style.set", patch);
	},
};

const renameProject: ChatTool = {
	name: "rename_project",
	description:
		"Rename the project. Visible in the dashboard, the editor header, and exported file names.",
	input_schema: {
		type: "object",
		required: ["name"],
		properties: {
			name: { type: "string", maxLength: 80 },
		},
	},
	async run(ctx, args) {
		const a = args as { name?: string };
		return dispatch(ctx.project, "project.rename", { name: a.name ?? "" });
	},
};

/**
 * read_scene is server-only — no dispatchAction, no mutation. Returns
 * the full scene JSON to the agent so it can reason about details
 * the project summary omits (motion clips, keyframes, full styles).
 */
const readScene: ChatTool = {
	name: "read_scene",
	description:
		"Get the full JSON for a single scene by id. Use this when the project summary doesn't have enough detail (e.g. you need to read motion clips, keyframes, or background.imageCrop). Read-only — does not mutate.",
	input_schema: {
		type: "object",
		required: ["scene_id"],
		properties: {
			scene_id: { type: "string" },
		},
	},
	async run(ctx, args) {
		const a = args as { scene_id?: string };
		const scene = ctx.project.scenes.find((s) => s.id === a.scene_id);
		if (!scene) {
			return {
				project: ctx.project,
				content: `no scene with id ${a.scene_id}`,
				isError: true,
			};
		}
		return {
			project: ctx.project,
			content: JSON.stringify(scene, null, 2),
		};
	},
};

/* ------------------------------------------------------------------
 * Phase 3 — assets, voiceover, preview render, critique
 * ------------------------------------------------------------------ */

const searchStockTool: ChatTool = {
	name: "search_stock",
	description:
		"Search Pexels for stock photos or videos. Returns up to 6 results with URLs already cached locally so the renderer can use them. Use the returned URLs in `set_background_media`. Don't fabricate — only use URLs from this tool's output OR from project.uploads.",
	input_schema: {
		type: "object",
		required: ["query", "kind"],
		properties: {
			query: { type: "string", description: "Search term, e.g. 'morning coffee'" },
			kind: { type: "string", enum: ["photo", "video"] },
			count: { type: "integer", minimum: 1, maximum: 6, description: "How many results to fetch (default 3)" },
			orientation: {
				type: "string",
				enum: ["landscape", "portrait", "square"],
				description: "Match the project orientation when possible",
			},
		},
	},
	async run(_ctx, args) {
		const a = args as {
			query?: string;
			kind?: StockKind;
			count?: number;
			orientation?: "landscape" | "portrait" | "square";
		};
		try {
			const results = await searchStock({
				query: (a.query ?? "").trim(),
				kind: a.kind ?? "photo",
				count: a.count ?? 3,
				orientation: a.orientation,
			});
			if (results.length === 0) {
				return {
					project: _ctx.project,
					content: `No Pexels results for "${a.query}".`,
				};
			}
			const summary = results
				.map(
					(r, i) =>
						`${i + 1}. ${r.kind} · ${r.width}×${r.height} · credit ${r.credit} · url=${r.url}`,
				)
				.join("\n");
			return {
				project: _ctx.project,
				content: `${results.length} ${a.kind} result${results.length === 1 ? "" : "s"}:\n${summary}`,
			};
		} catch (err) {
			return {
				project: _ctx.project,
				content: err instanceof Error ? err.message : String(err),
				isError: true,
			};
		}
	},
};

const generateVoiceoverTool: ChatTool = {
	name: "generate_voiceover",
	description:
		"Generate a TTS voiceover for a scene using OpenAI's text-to-speech and attach it to the scene. The scene's duration auto-extends to fit the audio if needed.",
	input_schema: {
		type: "object",
		required: ["scene_id", "text"],
		properties: {
			scene_id: { type: "string" },
			text: {
				type: "string",
				maxLength: 4000,
				description: "The script to speak. Keep it tight — short-form pacing.",
			},
			voice: {
				type: "string",
				enum: [
					"alloy",
					"ash",
					"ballad",
					"coral",
					"echo",
					"fable",
					"onyx",
					"nova",
					"sage",
					"shimmer",
					"verse",
				],
				description:
					"OpenAI voice ID. nova/coral/ballad work well for energetic shorts; onyx/echo for serious/dramatic.",
			},
		},
	},
	async run(ctx, args) {
		const a = args as { scene_id?: string; text?: string; voice?: string };
		const sceneIdx = ctx.project.scenes.findIndex((s) => s.id === a.scene_id);
		if (sceneIdx < 0) {
			return {
				project: ctx.project,
				content: `no scene with id ${a.scene_id}`,
				isError: true,
			};
		}
		try {
			const tts = await generateTts({
				text: a.text ?? "",
				voice: a.voice,
			});
			const voiceover: Voiceover = {
				audioUrl: tts.url,
				audioDurationSec: tts.durationSec,
				provider: "openai",
				voice: tts.voice,
				text: a.text ?? "",
			};
			const update = dispatch(ctx.project, "scene.update", {
				id: a.scene_id ?? "",
				patch: { voiceover },
			});
			return {
				project: update.project,
				content: `${update.content}; voiceover ${(tts.durationSec).toFixed(1)}s @ ${tts.voice}`,
				isError: update.isError,
			};
		} catch (err) {
			return {
				project: ctx.project,
				content: err instanceof Error ? err.message : String(err),
				isError: true,
			};
		}
	},
};

const renderPreview: ChatTool = {
	name: "render_preview",
	description:
		"Submit a low-res 540p render of the current project for preview. Returns a job_id IMMEDIATELY (does NOT block — renders take 30-90s). Call check_render(job_id) on a later turn to poll status, or critique_current_project(job_id) once it's done. Don't await this in the same turn — submit it then continue your work.",
	input_schema: {
		type: "object",
		properties: {},
	},
	async run(ctx) {
		if (ctx.project.scenes.length === 0) {
			return {
				project: ctx.project,
				content: "Cannot render an empty project — add at least one scene first.",
				isError: true,
			};
		}
		ctx.turnCounters.renderPreviewCalls += 1;
		try {
			const job = startRenderJob({
				project: ctx.project,
				characters: {},
				sfx: {},
				origin: ctx.origin,
				presetId: "540p_internal",
			});
			return {
				project: ctx.project,
				content: `Render job submitted: job_id=${job.id}. Use check_render to poll, or critique_current_project once it's done. Renders typically take 30-60s for short videos.`,
			};
		} catch (err) {
			return {
				project: ctx.project,
				content: err instanceof Error ? err.message : String(err),
				isError: true,
			};
		}
	},
};

const checkRender: ChatTool = {
	name: "check_render",
	description:
		"Check the status of a render job submitted via render_preview. Returns state (queued/rendering/done/failed) + progress. When done, ready for critique_current_project.",
	input_schema: {
		type: "object",
		required: ["job_id"],
		properties: {
			job_id: { type: "string" },
		},
	},
	async run(ctx, args) {
		const a = args as { job_id?: string };
		const job = getJob(a.job_id ?? "");
		if (!job) {
			return {
				project: ctx.project,
				content: `unknown job_id ${a.job_id}`,
				isError: true,
			};
		}
		const pct = Math.round(job.progress * 100);
		const status =
			job.state === "done"
				? `done (${pct}%, ${(job.sizeBytes ?? 0) / 1024 / 1024 < 0.05 ? "tiny" : `${((job.sizeBytes ?? 0) / 1024 / 1024).toFixed(1)} MB`})`
				: job.state === "failed"
				? `failed: ${job.error ?? "unknown error"}`
				: `${job.state} ${pct}% (${job.renderedFrames}/${job.totalFrames || "?"} frames, stage=${job.stage})`;
		return {
			project: ctx.project,
			content: `job ${job.id}: ${status}`,
			isError: job.state === "failed",
		};
	},
};

const critiqueProject: ChatTool = {
	name: "critique_current_project",
	description:
		"Run the Critic agent against a finished render. Samples 8 frames + audio peaks, sends to a vision-capable Sonnet, returns score (1-10) + summary + specific issues. Capped to 1 invocation per chat turn (each call costs ~$0.05). Pass the job_id from a render_preview that has finished.",
	input_schema: {
		type: "object",
		required: ["job_id"],
		properties: {
			job_id: { type: "string" },
		},
	},
	async run(ctx, args) {
		if (ctx.turnCounters.critiqueCalls >= 1) {
			return {
				project: ctx.project,
				content:
					"Critique already called once this turn. Apply the suggestions then ask the user (or wait for the next turn) before re-critiquing.",
				isError: true,
			};
		}
		const a = args as { job_id?: string };
		const job = getJob(a.job_id ?? "");
		if (!job) {
			return {
				project: ctx.project,
				content: `unknown job_id ${a.job_id}`,
				isError: true,
			};
		}
		if (job.state !== "done" || !job.outputPath) {
			return {
				project: ctx.project,
				content: `job ${job.id} is ${job.state} — wait until done before critiquing`,
				isError: true,
			};
		}
		ctx.turnCounters.critiqueCalls += 1;
		try {
			const fps = ctx.project.fps || 30;
			const durationSec = job.totalFrames > 0 ? job.totalFrames / fps : 0;
			if (durationSec <= 0) {
				return {
					project: ctx.project,
					content: "render duration unknown — cannot sample frames",
					isError: true,
				};
			}
			const sampled = await sampleVideo(job.outputPath, durationSec);
			const critique = await critiqueDraft({
				draft: ctx.project,
				frames: sampled.frames,
				audioPeaks: sampled.audioPeaks,
			});
			const issues =
				critique.issues.length > 0
					? critique.issues
							.map(
								(i, idx) =>
									`${idx + 1}. [${i.severity}]${
										i.sceneId ? ` (scene ${i.sceneId.slice(0, 6)})` : ""
									} ${i.suggestion}`,
							)
							.join("\n")
					: "(no specific issues)";
			return {
				project: ctx.project,
				content: `Critic score: ${critique.score}/10\n\n${critique.summary}\n\nIssues:\n${issues}`,
			};
		} catch (err) {
			return {
				project: ctx.project,
				content: err instanceof Error ? err.message : String(err),
				isError: true,
			};
		}
	},
};

export const CHAT_TOOLS: ChatTool[] = [
	addScene,
	updateScene,
	removeScene,
	replaceText,
	setBackgroundColor,
	moveScene,
	duplicateScene,
	retimeScene,
	setBackgroundMedia,
	setOrientation,
	applyPalette,
	applyStylePreset,
	setMusic,
	upsertCut,
	applyMotionPreset,
	setCaptionStyle,
	renameProject,
	readScene,
	searchStockTool,
	generateVoiceoverTool,
	renderPreview,
	checkRender,
	critiqueProject,
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
