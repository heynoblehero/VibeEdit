import type Anthropic from "@anthropic-ai/sdk";
import { AGENT_MODEL, getAnthropic } from "@/lib/server/anthropic-client";
import type { DraftProject } from "./draft-schema";

/**
 * Critic agent — watches a rendered preview and returns a structured
 * critique. Single-shot: receives sampled frames + audio peaks + the
 * project graph, calls submit_critique exactly once.
 *
 * The Creator stage uses the critique to produce a refined draft on
 * the next loop iteration. After 3 rounds OR a score ≥ 8, the runner
 * returns the highest-scored draft seen so far.
 */

export interface Critique {
	score: number;
	summary: string;
	issues: Array<{
		sceneId?: string;
		severity: "low" | "medium" | "high";
		suggestion: string;
	}>;
}

const CRITIC_TOOL: Anthropic.Tool = {
	name: "submit_critique",
	description:
		"Submit your structured critique of the rendered video. Call this exactly once. Score 1 = unwatchable, 5 = OK but not memorable, 8 = good enough to ship, 10 = perfect.",
	input_schema: {
		type: "object",
		required: ["score", "summary", "issues"],
		properties: {
			score: {
				type: "integer",
				minimum: 1,
				maximum: 10,
				description:
					"Overall watchability score, 1-10. Reserve 8+ for genuinely shippable videos.",
			},
			summary: {
				type: "string",
				maxLength: 600,
				description:
					"One-paragraph review. What's working, what's weak, would you watch this in a feed?",
			},
			issues: {
				type: "array",
				maxItems: 8,
				description:
					"Specific actionable issues, ordered by importance. Empty array if nothing to improve.",
				items: {
					type: "object",
					required: ["severity", "suggestion"],
					properties: {
						sceneId: {
							type: "string",
							description: "Optional scene id this issue applies to.",
						},
						severity: {
							type: "string",
							enum: ["low", "medium", "high"],
						},
						suggestion: {
							type: "string",
							maxLength: 240,
							description:
								"Concrete fix: what to change in the project to address this. Don't editorialize — give the next agent a clear directive.",
						},
					},
				},
			},
		},
	},
};

const CRITIC_SYSTEM_PROMPT = `You are the Critic agent inside VibeEdit's AI pipeline.

A Creator agent just generated a video and the renderer produced an MP4. You're now reviewing 12 frames sampled evenly across the timeline plus the audio RMS levels per second. Your job is to score the result honestly and identify what to fix on the next iteration.

# Scoring rubric (be honest, not generous)
- 10: Genuinely great. Tight pacing, strong hook, clean typography, consistent visual language. You'd share this.
- 8-9: Shippable. Good enough that the user can post and feel proud. Minor polish only.
- 6-7: Watchable but forgettable. Has the right idea, missing punch.
- 4-5: Rough. Visible problems — over-stuffed text, awkward timing, color clashes, missing payoff.
- 1-3: Broken or unwatchable. Frames are blank, text overflows, scenes don't connect.

Default starting bias: assume 6 unless evidence says otherwise. Don't reward effort — score outcomes.

# Things you should specifically look for
- Hook strength in the first 3 seconds (does the opening frame demand attention?)
- Text legibility (size, contrast, density — too many words is a fail)
- Pacing variation (all scenes the same length = boring)
- Visual variety (every scene the same color or layout = monotonous)
- Emotional arc (does the video build toward something or just stop?)
- Audio gaps (long stretches of silence in the peaks array suggest missing voiceover or music)
- Brand consistency (color palette across scenes, typography rhythm)

# What to put in issues
Prefer concrete, actionable suggestions tied to a sceneId when possible. Bad issue: "make it more engaging." Good issue: "scene 2 (big_number) has 8 words in statLabel — cut to 4 or split into two beats."

If the video is genuinely good (≥ 8), the issues array can be short — only flag things that would push it from 8 → 10.

Tool calls are your output. Don't narrate, don't preface, just call submit_critique.`;

export async function critiqueDraft(input: {
	draft: DraftProject;
	frames: Array<{ tSec: number; base64: string }>;
	audioPeaks: number[];
}): Promise<Critique> {
	const { draft, frames, audioPeaks } = input;
	const client = getAnthropic();

	const summary = [
		"Project metadata:",
		`- Name: ${draft.name}`,
		`- Orientation: ${draft.orientation}`,
		`- Scene count: ${draft.scenes.length}`,
		"",
		"Scene graph (for matching frames to scene structure):",
		...draft.scenes.map(
			(s, i) =>
				`${i + 1}. type=${s.type}, durationSec=${s.durationSec}` +
				(s.text ? `, text="${s.text.slice(0, 60)}"` : "") +
				(s.emphasisText
					? `, emphasisText="${s.emphasisText.slice(0, 40)}"`
					: "") +
				(s.statValue ? `, statValue="${s.statValue}"` : "") +
				(s.bulletItems
					? `, bulletItems=[${s.bulletItems.length}]`
					: "") +
				(s.quoteText ? `, quoteText="${s.quoteText.slice(0, 40)}"` : "") +
				(s.transition ? `, transition=${s.transition}` : ""),
		),
		"",
		`Audio RMS peaks (1Hz, ${audioPeaks.length} samples, 0=silent → 1=loud):`,
		audioPeaks.length > 0
			? `[${audioPeaks.map((p) => p.toFixed(2)).join(", ")}]`
			: "(no audio detected)",
		"",
		`12 frames are attached below in chronological order at timestamps: ${frames
			.map((f) => f.tSec.toFixed(1) + "s")
			.join(", ")}.`,
	].join("\n");

	const userContent: Anthropic.ContentBlockParam[] = [
		{ type: "text", text: summary },
		...frames.map(
			(f): Anthropic.ImageBlockParam => ({
				type: "image",
				source: {
					type: "base64",
					media_type: "image/png",
					data: f.base64,
				},
			}),
		),
	];

	const response = await client.messages.create({
		model: AGENT_MODEL,
		max_tokens: 2048,
		system: CRITIC_SYSTEM_PROMPT,
		tools: [CRITIC_TOOL],
		tool_choice: { type: "tool", name: "submit_critique" },
		messages: [{ role: "user", content: userContent }],
	});

	const toolUse = response.content.find(
		(b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
	);
	if (!toolUse || toolUse.name !== "submit_critique") {
		throw new Error("Critic did not call submit_critique");
	}
	const input2 = toolUse.input as Critique;
	if (
		typeof input2.score !== "number" ||
		input2.score < 1 ||
		input2.score > 10
	) {
		throw new Error(`Critic returned invalid score: ${input2.score}`);
	}
	return {
		score: Math.round(input2.score),
		summary: input2.summary ?? "(no summary)",
		issues: Array.isArray(input2.issues) ? input2.issues : [],
	};
}
