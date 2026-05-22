import { z } from "zod";
import {
	tool,
	createSdkMcpServer,
} from "@anthropic-ai/claude-agent-sdk";
import {
	listFiles,
	listAssets,
	readProjectText,
	readProjectFile,
	writeProjectFile,
	projectDir,
} from "../storage/fs";
import { listRegistry, readRegistryBlock } from "./registry";
import { readBrandKit } from "../brand-kit";
import { searchStock, type StockKind } from "../stock/registry";
import { replicateGenerateImage } from "./providers/replicate";
import { nanoid } from "nanoid";

export type ToolContext = {
	userId: string;
	projectId: string;
	enqueueRender: (opts: { fps?: number; quality?: string }) => Promise<string>;
	// BYOK keys forwarded from the browser's localStorage per chat request.
	// Tools check this map before falling back to process.env (dev-only) and
	// return a friendly error if neither is present.
	apiKeys?: Partial<
		Record<
			"replicate" | "kling" | "fal" | "elevenlabs" | "openai" | "anthropic",
			string
		>
	>;
};

// Tool names are surfaced to the agent as `mcp__hyperframes__<name>`.
export const MCP_SERVER_NAME = "hyperframes";

export function buildToolServer(ctx: ToolContext) {
	const planCompositionTool = tool(
		"plan_composition",
		"REQUIRED FIRST STEP for any NEW composition (not edits). Emit a structured scene plan. After this returns, STOP your turn — say 'Approve this plan and I'll build it' and wait for the user's next message before any write_file call.",
		{
			format: z
				.enum(["16:9", "9:16", "1:1"])
				.describe("Output aspect ratio."),
			totalDurationSeconds: z
				.number()
				.int()
				.min(5)
				.max(900)
				.describe(
					"Total composition length, in seconds (max 900 = 15 min). For long-form (>5min) use fewer scenes but longer holds.",
				),
			niche: z
				.string()
				.describe("e.g. 'comic facts', 'sleep story', 'finance intro'."),
			palette: z
				.string()
				.describe("Short color/typography palette description."),
			scenes: z
				.array(
					z.object({
						index: z.number().int().min(1),
						durationSeconds: z.number(),
						intent: z
							.string()
							.describe("What this scene communicates in 1 line."),
						beats: z
							.array(z.string())
							.describe("2-4 key visual/text beats in this scene."),
						fx: z
							.array(z.string())
							.describe(
								"FX hits (glass-crack, whip-pan, white-flash, shimmer-sweep, none).",
							),
					}),
				)
				.min(1)
				.max(12)
				.describe("Scenes in render order."),
		},
		async (plan) => {
			const warnings: string[] = [];
			if (plan.totalDurationSeconds > 600 && plan.scenes.length < 5) {
				warnings.push(
					`WARNING: ${plan.totalDurationSeconds}s with only ${plan.scenes.length} scene${plan.scenes.length === 1 ? "" : "s"} → very long holds per scene. Long-form videos this length usually need 6+ scenes (chapter cards, B-roll cuts, beat changes) to keep retention. Consider revising before the user approves.`,
				);
			}
			const avgSeconds = plan.totalDurationSeconds / plan.scenes.length;
			if (avgSeconds > 90) {
				warnings.push(
					`WARNING: average scene length ${avgSeconds.toFixed(0)}s — viewers fall off without a beat change. Break long scenes into chaptered segments.`,
				);
			}
			const lines = [
				`OK: plan recorded — ${plan.scenes.length} scenes / ${plan.totalDurationSeconds}s / ${plan.format}.`,
				...warnings,
				`Now stop and ask the user to approve before writing any HTML.`,
			];
			return {
				content: [{ type: "text", text: lines.join("\n") }],
			};
		},
	);

	const listFilesTool = tool(
		"list_files",
		"List all files in the current project directory. Returns one relative path per line.",
		{},
		async () => {
			const files = listFiles(ctx.userId, ctx.projectId);
			const text = files.length ? files.join("\n") : "(empty project)";
			return { content: [{ type: "text", text }] };
		},
	);

	const readFileTool = tool(
		"read_file",
		"Read a text file in the project. Returns up to 50KB. Path is relative to the project root.",
		{
			path: z
				.string()
				.describe("Relative path, e.g. 'index.html' or 'compositions/scene1.html'."),
		},
		async ({ path }) => {
			try {
				const raw = readProjectText(ctx.userId, ctx.projectId, path);
				const text =
					raw.length > 50_000
						? raw.slice(0, 50_000) + "\n<-- truncated -->"
						: raw;
				return { content: [{ type: "text", text }] };
			} catch (error) {
				return {
					content: [
						{ type: "text", text: `ERROR: ${(error as Error).message}` },
					],
					isError: true,
				};
			}
		},
	);

	const diffFileTool = tool(
		"diff_file",
		"Make a SURGICAL edit to an existing file by replacing a unique text block. Prefer this over write_file for small edits — it's faster and uses way fewer tokens. The old_text must appear EXACTLY ONCE in the file. For multi-edit changes, call this multiple times.",
		{
			path: z.string().describe("Relative path to the file."),
			old_text: z
				.string()
				.describe("Exact text to find. Must be unique in the file."),
			new_text: z
				.string()
				.describe("Text to replace it with. Can be empty to delete."),
		},
		async ({ path, old_text, new_text }) => {
			try {
				const current = readProjectText(ctx.userId, ctx.projectId, path);
				const occurrences = current.split(old_text).length - 1;
				if (occurrences === 0)
					return {
						content: [
							{
								type: "text",
								text: `ERROR: old_text not found in ${path}. Try a more specific snippet.`,
							},
						],
						isError: true,
					};
				if (occurrences > 1)
					return {
						content: [
							{
								type: "text",
								text: `ERROR: old_text appears ${occurrences} times in ${path}. Need a unique snippet — add surrounding context.`,
							},
						],
						isError: true,
					};
				const updated = current.replace(old_text, new_text);
				writeProjectFile(ctx.userId, ctx.projectId, path, updated);
				return {
					content: [
						{
							type: "text",
							text: `OK: ${path} updated (${old_text.length}B → ${new_text.length}B).`,
						},
					],
				};
			} catch (error) {
				return {
					content: [
						{ type: "text", text: `ERROR: ${(error as Error).message}` },
					],
					isError: true,
				};
			}
		},
	);

	const findStockTool = tool(
		"find_stock",
		"Search the curated stock library for SFX, b-roll video, character illustrations, or MUSIC beds. Returns matching assets with their URLs. URLs are publicly served — reference them directly as `src=\"...\"`. For 'music', search by mood keywords (energetic / calm / ominous / playful / mysterious / dark / warm). Every composition should include exactly ONE music track unless the brief says otherwise.",
		{
			query: z
				.string()
				.describe(
					"Keywords. Examples: 'dramatic riser', 'glitch overlay', 'host narrator', or for music: 'calm peaceful sleep' / 'ominous tense' / 'energetic punchy comic'.",
				),
			kind: z
				.enum(["sfx", "broll", "character", "music"])
				.optional()
				.describe("Restrict to one kind. Omit to search all."),
		},
		async ({ query, kind }) => {
			const results = searchStock(query, kind as StockKind | undefined);
			if (results.length === 0) {
				return {
					content: [
						{
							type: "text",
							text: `No stock assets matched "${query}". Try broader terms (e.g. 'whoosh', 'particles', 'narrator', 'calm', 'punchy').`,
						},
					],
				};
			}
			const lines = results
				.slice(0, 10)
				.map((a) => {
					const moodPart =
						a.mood && a.mood.length ? `, mood: ${a.mood.join("/")}` : "";
					const bpmPart = a.bpm ? `, ${a.bpm}bpm` : "";
					return `[${a.kind}] ${a.slug} — ${a.name} — ${a.url}  (tags: ${a.tags.join(", ")}${a.durationSeconds ? `, ${a.durationSeconds}s` : ""}${moodPart}${bpmPart})`;
				});
			return {
				content: [
					{
						type: "text",
						text: lines.join("\n"),
					},
				],
			};
		},
	);

	const getBrandKitTool = tool(
		"get_brand_kit",
		"Return the user's saved brand kit (logo, primary color, accent color, font, watermark, channel name, AND host identity: hostName + hostDescription). If hostDescription is set, the composition MUST feature a host matching that description in the same position/style across every scene — character consistency is critical for faceless YT channels. If any field is null, ignore it.",
		{},
		async () => {
			const kit = await readBrandKit(ctx.userId);
			return {
				content: [
					{
						type: "text",
						text: JSON.stringify(kit, null, 2),
					},
				],
			};
		},
	);

	const writeFileTool = tool(
		"write_file",
		"Create or overwrite a file in the project. Write the COMPLETE file contents — partial writes are not supported.",
		{
			path: z.string().describe("Relative path within the project."),
			content: z.string().describe("Full file contents."),
		},
		async ({ path, content }) => {
			try {
				writeProjectFile(ctx.userId, ctx.projectId, path, content);
				return {
					content: [
						{
							type: "text",
							text: `OK: wrote ${content.length} bytes to ${path}`,
						},
					],
				};
			} catch (error) {
				return {
					content: [
						{ type: "text", text: `ERROR: ${(error as Error).message}` },
					],
					isError: true,
				};
			}
		},
	);

	const lintTool = tool(
		"lint_composition",
		"Run the hyperframes linter on the project's index.html. Call this AFTER write_file. If errors are returned, fix them and re-write.",
		{},
		async () => {
			const text = await runLint(ctx.userId, ctx.projectId);
			return { content: [{ type: "text", text }] };
		},
	);

	const listAssetsTool = tool(
		"list_assets",
		"List user-uploaded assets in the project (images, video, audio under assets/).",
		{},
		async () => {
			const assets = listAssets(ctx.userId, ctx.projectId);
			const text = assets.length ? assets.join("\n") : "(no assets uploaded)";
			return { content: [{ type: "text", text }] };
		},
	);

	const listRegistryTool = tool(
		"list_registry_blocks",
		"List reusable hyperframes blocks/components/examples (transitions, VFX, social mocks, etc). This is your palette.",
		{},
		async () => {
			const entries = listRegistry();
			const text = entries
				.map((e) => `[${e.kind}] ${e.name} — ${e.description}`)
				.join("\n");
			return { content: [{ type: "text", text }] };
		},
	);

	const readRegistryTool = tool(
		"read_registry_block",
		"Read the source of a registry block to study or copy its pattern. Use a name from list_registry_blocks.",
		{ name: z.string() },
		async ({ name }) => {
			const content = readRegistryBlock(name);
			if (!content) {
				return {
					content: [{ type: "text", text: `ERROR: block '${name}' not found` }],
					isError: true,
				};
			}
			return { content: [{ type: "text", text: content }] };
		},
	);

	const generateVoiceoverTool = tool(
		"generate_voiceover",
		"Synthesize a narration MP3 from text and save it to assets/. Use this for long-form videos that need a presenter voice (sleep stories, history docs, finance breakdowns). Once the audio is in the project the agent should fold it into the composition as `<audio class=\"clip\" data-start=\"0\" data-duration=\"<total>\" data-track-index=\"0\" data-volume=\"1\">` and time the visuals to the cues generated from the same script via generate_captions.",
		{
			filename: z
				.string()
				.regex(/^[A-Za-z0-9._-]+\.mp3$/)
				.describe("Output filename, e.g. 'narration.mp3'."),
			script: z
				.string()
				.min(2)
				.max(8000)
				.describe("Narration script. ≤8000 chars per request."),
			voiceId: z
				.string()
				.optional()
				.describe(
					"ElevenLabs voiceId. Defaults to the user's saved brand voice if set.",
				),
		},
		async ({ filename, script, voiceId }) => {
			const apiKey =
				ctx.apiKeys?.elevenlabs || process.env.ELEVENLABS_API_KEY;
			if (!apiKey) {
				return {
					content: [
						{
							type: "text",
							text: `ERROR: No ElevenLabs key configured. Ask the user to paste their ElevenLabs API key at /app/settings/api-keys, then try again.`,
						},
					],
					isError: true,
				};
			}
			try {
				const buffer = await synthesizeElevenLabs({
					apiKey,
					script,
					voiceId: voiceId || process.env.ELEVENLABS_DEFAULT_VOICE_ID || "",
				});
				const target = `assets/${filename}`;
				writeProjectFile(ctx.userId, ctx.projectId, target, buffer);
				return {
					content: [
						{
							type: "text",
							text: `OK: wrote ${target} (${buffer.length}B). Reference as src="${target}" and time captions to the same script via generate_captions.`,
						},
					],
				};
			} catch (error) {
				return {
					content: [
						{ type: "text", text: `ERROR: ${(error as Error).message}` },
					],
					isError: true,
				};
			}
		},
	);

	const generateImageTool = tool(
		"generate_image",
		"Generate a placeholder background or accent image and save it to the project's assets/. Uses the provided palette to compose a noisy gradient — not photorealistic, but a usable filler for scene backgrounds when no real reference is available. Returns the asset path you can reference as `src=\"assets/...\"`.",
		{
			filename: z
				.string()
				.regex(/^[A-Za-z0-9._-]+\.png$/)
				.describe("Output filename, e.g. 'bg-scene1.png'."),
			width: z.number().int().min(64).max(3840).default(1920),
			height: z.number().int().min(64).max(3840).default(1080),
			palette: z
				.array(z.string().regex(/^#[0-9a-fA-F]{6}$/))
				.min(2)
				.max(5)
				.describe("Hex colors. First is base, subsequent are accent stops."),
			direction: z
				.enum(["radial", "vertical", "diagonal"])
				.optional()
				.default("radial"),
		},
		async ({ filename, width, height, palette, direction }) => {
			try {
				const buffer = await renderPlaceholderImage({
					width,
					height,
					palette,
					direction: direction || "radial",
				});
				const target = `assets/${filename}`;
				writeProjectFile(ctx.userId, ctx.projectId, target, buffer);
				return {
					content: [
						{
							type: "text",
							text: `OK: wrote ${target} (${width}×${height}, ${buffer.length}B). Reference it in your composition as src="${target}".`,
						},
					],
				};
			} catch (error) {
				return {
					content: [
						{ type: "text", text: `ERROR: ${(error as Error).message}` },
					],
					isError: true,
				};
			}
		},
	);

	const generateCaptionsTool = tool(
		"generate_captions",
		"Split a script into timed caption cues distributed evenly across the composition duration. Returns an array of { text, start, end } in seconds. Use these cues to add a captions track to the composition (overlay <div>s revealed via GSAP timeline). Captions should be ≤6 words per cue for vertical (9:16) and ≤9 for horizontal (16:9).",
		{
			script: z
				.string()
				.describe(
					"Full narration / on-screen script. Sentences are split into shorter cues automatically.",
				),
			totalDurationSeconds: z
				.number()
				.min(2)
				.max(900)
				.describe("Total composition duration in seconds."),
			maxWordsPerCue: z
				.number()
				.int()
				.min(2)
				.max(20)
				.optional()
				.default(6)
				.describe("Cap on words per caption cue."),
		},
		async ({ script, totalDurationSeconds, maxWordsPerCue }) => {
			const cap = maxWordsPerCue ?? 6;
			const cues = splitScriptIntoCues(script, cap, totalDurationSeconds);
			return {
				content: [
					{
						type: "text",
						text: [
							`Generated ${cues.length} caption cue(s) across ${totalDurationSeconds}s:`,
							...cues.map(
								(cue, i) =>
									`  ${i + 1}. [${cue.start.toFixed(2)}s → ${cue.end.toFixed(2)}s]  ${cue.text}`,
							),
							"",
							"JSON for direct use in your composition:",
							JSON.stringify(cues),
						].join("\n"),
					},
				],
			};
		},
	);

	const analyzeImageTool = tool(
		"analyze_image",
		"Extract a rough color palette (top 5 colors) + average lightness from an image asset in the project. Use this on any reference image the user has dropped in chat to design a matching palette. Path is relative to the project root, usually 'assets/foo.png'.",
		{
			path: z
				.string()
				.describe("Relative path to an image asset, e.g. 'assets/ref.png'."),
		},
		async ({ path }) => {
			try {
				const file = readProjectFile(ctx.userId, ctx.projectId, path);
				if (!file.mime.startsWith("image/")) {
					return {
						content: [
							{
								type: "text",
								text: `ERROR: ${path} is not an image (${file.mime}).`,
							},
						],
						isError: true,
					};
				}
				const palette = await extractPalette(file.content);
				const lines = [
					`Palette analysis of ${path}:`,
					`Avg lightness: ${Math.round(palette.avgLightness * 100)}/100 (${
						palette.avgLightness > 0.6
							? "bright"
							: palette.avgLightness < 0.3
								? "dark"
								: "mid"
					})`,
					"Top colors (sample → hex):",
					...palette.colors.map(
						(c, i) =>
							`  ${i + 1}. ${c.hex}  (rgb ${c.r},${c.g},${c.b}, ~${c.percent}%)`,
					),
				];
				return { content: [{ type: "text", text: lines.join("\n") }] };
			} catch (error) {
				return {
					content: [
						{ type: "text", text: `ERROR: ${(error as Error).message}` },
					],
					isError: true,
				};
			}
		},
	);

	const screenshotTool = tool(
		"screenshot_at_time",
		"Render PNG frame(s) of the current composition at given timestamps. Use this after write_file to visually verify what you built before claiming it's done. The returned images are the actual rendered output — look at them and decide if anything needs fixing.",
		{
			timestamps: z
				.array(z.number().min(0).max(300))
				.min(1)
				.max(4)
				.describe(
					"Up to 4 timestamps in seconds, e.g. [0.5, 2.0, 5.0]. Pick moments that matter (entrance, midpoint, climax, last frame).",
				),
		},
		async ({ timestamps }) => {
			const result = await runSnapshot(ctx.userId, ctx.projectId, timestamps);
			return { content: result };
		},
	);

	const startRenderTool = tool(
		"start_render",
		"Queue an MP4 render of the current composition. Only call when the user explicitly asks to render. Progress shows in the UI.",
		{
			fps: z.number().int().min(1).max(120).optional().default(30),
			quality: z
				.enum(["draft", "standard", "high"])
				.optional()
				.default("standard"),
		},
		async ({ fps, quality }) => {
			try {
				const jobId = await ctx.enqueueRender({ fps, quality });
				return {
					content: [
						{
							type: "text",
							text: `OK: render queued, job id = ${jobId}. The user will see progress in the UI.`,
						},
					],
				};
			} catch (error) {
				return {
					content: [
						{ type: "text", text: `ERROR: ${(error as Error).message}` },
					],
					isError: true,
				};
			}
		},
	);

	const generateImageVariantsTool = tool(
		"generate_image_variants",
		"Generate N candidate images for a scene via the user's Replicate API key, save them to assets/variants/<id>/, and emit a picker block so the user can choose one. Use this when the user explicitly asks for options or for photoreal / model-generated stills (vs. the local placeholder generate_image). After this returns, STOP and wait for the user to pick before referencing any path — the final path will be assets/<sceneSlug>.png after the user clicks a variant.",
		{
			prompt: z
				.string()
				.min(4)
				.max(2000)
				.describe(
					"Image prompt. Include style + subject + key composition cues.",
				),
			sceneSlug: z
				.string()
				.regex(/^[a-z0-9-]+$/)
				.describe(
					"Short slug for the destination asset (e.g. 'hero-bg'). Becomes assets/<sceneSlug>.png once the user picks.",
				),
			count: z
				.number()
				.int()
				.min(1)
				.max(4)
				.default(4)
				.describe("How many variants to generate. Default 4."),
			aspectRatio: z
				.enum(["1:1", "16:9", "9:16", "4:3", "3:4"])
				.default("16:9")
				.describe("Output aspect ratio."),
		},
		async ({ prompt, sceneSlug, count, aspectRatio }) => {
			const apiKey = ctx.apiKeys?.replicate;
			if (!apiKey) {
				return {
					content: [
						{
							type: "text",
							text: `ERROR: No Replicate key configured. Tell the user to paste their Replicate token at /app/settings/api-keys, then try again.`,
						},
					],
					isError: true,
				};
			}
			const batchId = nanoid(8);
			const dir = `assets/variants/${sceneSlug}-${batchId}`;
			const generated: Array<{ path: string; index: number }> = [];
			const errors: string[] = [];
			// Sequential so we surface failures one at a time rather than firing
			// `count` requests and getting hammered by Replicate's rate limit.
			for (let index = 1; index <= (count || 4); index++) {
				try {
					const buffer = await replicateGenerateImage({
						apiKey,
						prompt,
						aspectRatio,
					});
					const target = `${dir}/${index}.png`;
					writeProjectFile(ctx.userId, ctx.projectId, target, buffer);
					generated.push({ path: target, index });
				} catch (error) {
					errors.push(`#${index}: ${(error as Error).message}`);
				}
			}
			if (generated.length === 0) {
				return {
					content: [
						{
							type: "text",
							text: `ERROR: all variants failed. ${errors.join(" · ")}`,
						},
					],
					isError: true,
				};
			}
			// The chat UI looks for <variants> ... </variants> JSON tags in
			// tool_result text and renders a picker. The agent should NOT
			// reference any path until the user picks — make that explicit so
			// the model doesn't auto-pick #1 and proceed.
			const marker = JSON.stringify({
				sceneSlug,
				dir,
				targetPath: `assets/${sceneSlug}.png`,
				paths: generated.map((g) => g.path),
			});
			return {
				content: [
					{
						type: "text",
						text: `OK: generated ${generated.length}/${count} variants in ${dir}. ${
							errors.length ? `Some failed: ${errors.join(" · ")}. ` : ""
						}STOP. Wait for the user to pick one before proceeding — the chat will surface a picker.\n\n<variants>${marker}</variants>`,
					},
				],
			};
		},
	);

	return createSdkMcpServer({
		name: MCP_SERVER_NAME,
		version: "1.0.0",
		tools: [
			planCompositionTool,
			listFilesTool,
			readFileTool,
			writeFileTool,
			diffFileTool,
			lintTool,
			screenshotTool,
			getBrandKitTool,
			findStockTool,
			listAssetsTool,
			listRegistryTool,
			readRegistryTool,
			analyzeImageTool,
			generateCaptionsTool,
			generateImageTool,
			generateImageVariantsTool,
			generateVoiceoverTool,
			startRenderTool,
		],
	});
}

export const ALLOWED_TOOL_NAMES = [
	"plan_composition",
	"list_files",
	"read_file",
	"write_file",
	"diff_file",
	"lint_composition",
	"screenshot_at_time",
	"get_brand_kit",
	"find_stock",
	"list_assets",
	"list_registry_blocks",
	"read_registry_block",
	"analyze_image",
	"generate_captions",
	"generate_image",
	"generate_image_variants",
	"generate_voiceover",
	"start_render",
].map((n) => `mcp__${MCP_SERVER_NAME}__${n}`);

type SnapshotContent =
	| { type: "text"; text: string }
	| {
			type: "image";
			data: string;
			mimeType: "image/png" | "image/jpeg";
	  };

async function runSnapshot(
	userId: string,
	projectId: string,
	timestamps: number[],
): Promise<SnapshotContent[]> {
	const { spawn } = await import("node:child_process");
	const fs = await import("node:fs");
	const path = await import("node:path");
	const dir = projectDir(userId, projectId);
	const snapshotsDir = path.join(dir, "snapshots");
	try {
		fs.rmSync(snapshotsDir, { recursive: true, force: true });
	} catch {
		/* */
	}
	const atArg = timestamps.map((t) => String(t)).join(",");
	const PATH = process.env.PATH || "";
	const extraBin = process.cwd() + "/node_modules/.bin";
	const cliOut = await new Promise<{ code: number; err: string }>((resolveP) => {
		const child = spawn(
			"hyperframes",
			["snapshot", dir, "--at", atArg],
			{
				stdio: ["ignore", "pipe", "pipe"],
				env: { ...process.env, PATH: `${extraBin}:${PATH}` },
			},
		);
		let err = "";
		child.stderr?.on("data", (chunk: Buffer) => {
			err += chunk.toString();
			if (err.length > 4000) err = err.slice(-4000);
		});
		child.on("error", () =>
			resolveP({ code: 1, err: err || "spawn failed" }),
		);
		child.on("exit", (code) => resolveP({ code: code ?? 1, err }));
	});

	if (cliOut.code !== 0) {
		return [
			{
				type: "text",
				text: `ERROR: snapshot CLI exited ${cliOut.code}: ${cliOut.err.slice(-800)}`,
			},
		];
	}

	if (!fs.existsSync(snapshotsDir)) {
		return [
			{
				type: "text",
				text: "ERROR: snapshots dir was not produced.",
			},
		];
	}
	const files = fs
		.readdirSync(snapshotsDir)
		.filter((f) => f.toLowerCase().endsWith(".png"))
		.sort();
	if (files.length === 0) {
		return [{ type: "text", text: "ERROR: no PNGs found in snapshots/." }];
	}

	const sharp = (await import("sharp")).default;
	const content: SnapshotContent[] = [
		{
			type: "text",
			text: `Captured ${files.length} frame(s) at ${timestamps
				.map((t) => `${t}s`)
				.join(", ")}. Inspect them and decide what to fix.`,
		},
	];
	for (const file of files) {
		try {
			const fullPath = path.join(snapshotsDir, file);
			const downscaled = await sharp(fullPath)
				.resize({
					width: 960,
					height: 960,
					fit: "inside",
					withoutEnlargement: true,
				})
				.png({ quality: 80, compressionLevel: 9 })
				.toBuffer();
			content.push({
				type: "image",
				mimeType: "image/png",
				data: downscaled.toString("base64"),
			});
			content.push({
				type: "text",
				text: `↑ ${file.replace(/\.png$/i, "")}`,
			});
		} catch (error) {
			content.push({
				type: "text",
				text: `(failed to encode ${file}: ${(error as Error).message})`,
			});
		}
	}
	return content;
}

async function runLint(userId: string, projectId: string): Promise<string> {
	const { spawn } = await import("node:child_process");
	const dir = projectDir(userId, projectId);
	const PATH = process.env.PATH || "";
	const extraBin = process.cwd() + "/node_modules/.bin";
	return new Promise<string>((resolveP) => {
		const child = spawn("hyperframes", ["lint", "--json", dir], {
			stdio: ["ignore", "pipe", "pipe"],
			env: { ...process.env, PATH: `${extraBin}:${PATH}` },
		});
		let stdout = "";
		let stderr = "";
		child.stdout.on("data", (chunk) => (stdout += chunk.toString()));
		child.stderr.on("data", (chunk) => (stderr += chunk.toString()));
		child.on("error", (error) => resolveP(`(lint failed: ${error.message})`));
		child.on("exit", () => {
			const text = stdout.trim();
			try {
				const parsed = JSON.parse(text) as unknown;
				const issues = Array.isArray(parsed)
					? parsed
					: ((parsed as { issues?: unknown[]; findings?: unknown[] })
							.issues ||
							(parsed as { findings?: unknown[] }).findings ||
							[]);
				if (!issues.length) return resolveP("OK: 0 issues");
				resolveP(
					issues
						.map((issue) => {
							const i = issue as Record<string, unknown>;
							return `${i.severity || "warn"} [${i.code || i.rule || "?"}] ${i.message || ""}`;
						})
						.join("\n"),
				);
			} catch {
				resolveP(text || stderr.slice(-2000) || "(lint produced no output)");
			}
		});
	});
}

type PaletteColor = {
	hex: string;
	r: number;
	g: number;
	b: number;
	percent: number;
};

async function extractPalette(
	buffer: Buffer,
): Promise<{ colors: PaletteColor[]; avgLightness: number }> {
	const sharp = (await import("sharp")).default;
	// Downscale + decode raw pixels, then quantize colors into a small bucket
	// space and count occurrences. Cheap, deterministic, no extra deps.
	const decoded = await sharp(buffer)
		.resize(64, 64, { fit: "inside" })
		.removeAlpha()
		.raw()
		.toBuffer({ resolveWithObject: true });
	const pixels = decoded.data;
	const total = pixels.length / 3;
	const buckets = new Map<string, { count: number; r: number; g: number; b: number }>();
	let lightnessSum = 0;
	for (let i = 0; i < pixels.length; i += 3) {
		const r = pixels[i];
		const g = pixels[i + 1];
		const b = pixels[i + 2];
		lightnessSum += (Math.max(r, g, b) + Math.min(r, g, b)) / 510;
		const key = `${r >> 5}-${g >> 5}-${b >> 5}`;
		const existing = buckets.get(key);
		if (existing) {
			existing.count += 1;
			existing.r += r;
			existing.g += g;
			existing.b += b;
		} else {
			buckets.set(key, { count: 1, r, g, b });
		}
	}
	const top = [...buckets.values()]
		.sort((a, b) => b.count - a.count)
		.slice(0, 5)
		.map((bucket) => {
			const r = Math.round(bucket.r / bucket.count);
			const g = Math.round(bucket.g / bucket.count);
			const b = Math.round(bucket.b / bucket.count);
			return {
				r,
				g,
				b,
				percent: Math.round((bucket.count / total) * 100),
				hex: `#${toHex(r)}${toHex(g)}${toHex(b)}`,
			};
		});
	return { colors: top, avgLightness: lightnessSum / total };
}

function toHex(value: number): string {
	return value.toString(16).padStart(2, "0");
}

async function synthesizeElevenLabs(opts: {
	apiKey: string;
	script: string;
	voiceId: string;
}): Promise<Buffer> {
	if (!opts.voiceId) {
		throw new Error(
			"no voiceId — pass one or set ELEVENLABS_DEFAULT_VOICE_ID env var",
		);
	}
	const url = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(opts.voiceId)}?output_format=mp3_44100_128`;
	const response = await fetch(url, {
		method: "POST",
		headers: {
			"xi-api-key": opts.apiKey,
			"content-type": "application/json",
		},
		body: JSON.stringify({
			text: opts.script,
			model_id: "eleven_multilingual_v2",
			voice_settings: { stability: 0.5, similarity_boost: 0.7 },
		}),
	});
	if (!response.ok) {
		throw new Error(
			`ElevenLabs ${response.status}: ${(await response.text()).slice(0, 400)}`,
		);
	}
	return Buffer.from(await response.arrayBuffer());
}

async function renderPlaceholderImage(opts: {
	width: number;
	height: number;
	palette: string[];
	direction: "radial" | "vertical" | "diagonal";
}): Promise<Buffer> {
	const sharp = (await import("sharp")).default;
	const [base, ...accents] = opts.palette;
	const stops = accents
		.map(
			(color, index) =>
				`<stop offset="${Math.round(((index + 1) / (accents.length + 1)) * 100)}%" stop-color="${color}"/>`,
		)
		.join("");
	const gradient =
		opts.direction === "radial"
			? `<radialGradient id="g" cx="50%" cy="50%" r="65%"><stop offset="0%" stop-color="${base}"/>${stops}<stop offset="100%" stop-color="${accents[accents.length - 1] || base}"/></radialGradient>`
			: opts.direction === "vertical"
				? `<linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${base}"/>${stops}<stop offset="100%" stop-color="${accents[accents.length - 1] || base}"/></linearGradient>`
				: `<linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${base}"/>${stops}<stop offset="100%" stop-color="${accents[accents.length - 1] || base}"/></linearGradient>`;
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${opts.width}" height="${opts.height}">
<defs>${gradient}
<filter id="noise"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.18 0"/></filter>
</defs>
<rect width="100%" height="100%" fill="url(#g)"/>
<rect width="100%" height="100%" filter="url(#noise)"/>
</svg>`;
	return sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
}

type CaptionCue = { text: string; start: number; end: number };

function splitScriptIntoCues(
	script: string,
	maxWords: number,
	totalDurationSeconds: number,
): CaptionCue[] {
	// Split into sentences first, then chunk each sentence by maxWords. Time
	// each cue by share of total word count so longer cues hold longer.
	const sentences = script
		.replace(/\s+/g, " ")
		.split(/(?<=[.!?])\s+/)
		.map((sentence) => sentence.trim())
		.filter((sentence) => sentence.length > 0);
	const cues: { text: string; words: number }[] = [];
	for (const sentence of sentences) {
		const words = sentence.split(/\s+/).filter(Boolean);
		for (let i = 0; i < words.length; i += maxWords) {
			const chunk = words.slice(i, i + maxWords);
			cues.push({ text: chunk.join(" "), words: chunk.length });
		}
	}
	if (cues.length === 0) return [];
	const totalWords = cues.reduce((sum, cue) => sum + cue.words, 0) || 1;
	const result: CaptionCue[] = [];
	let cursor = 0;
	for (const cue of cues) {
		const share = (cue.words / totalWords) * totalDurationSeconds;
		const start = cursor;
		const end = Math.min(totalDurationSeconds, cursor + share);
		result.push({
			text: cue.text,
			start: Number(start.toFixed(3)),
			end: Number(end.toFixed(3)),
		});
		cursor = end;
	}
	// Snap last cue to exact duration to avoid floating-point drift.
	if (result.length) result[result.length - 1].end = totalDurationSeconds;
	return result;
}
