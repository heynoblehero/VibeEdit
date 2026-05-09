import type Anthropic from "@anthropic-ai/sdk";
import { AGENT_MODEL, getAnthropic } from "@/lib/server/anthropic-client";
import type { Project } from "@/lib/scene-schema";
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

const CRITIC_SYSTEM_PROMPT = `You are the Critic agent inside VibeEdit. The video must pass as a SHORT-FORM SOCIAL VIDEO (TikTok/Reels/Shorts) — not a corporate explainer, not a slideshow.

A Creator agent generated a video and you're reviewing 8 frames sampled evenly across the timeline plus 1Hz audio RMS levels. Score it honestly.

# Scoring rubric — short-form bar (be harsh, not generous)
- 10: Stops the scroll. Strong hook, varied visuals, tight pacing, clear payoff. You'd send this to a friend.
- 8-9: Shippable. Posts-and-feels-proud quality. Minor polish only.
- 6-7: Watchable but forgettable. Right concept, weak execution. Won't get shared.
- 4-5: Rough. Pacing problems, monotonous visuals, no arc, filler text, broken layouts.
- 1-3: Broken. Frames blank, text overflows, scenes disconnected.

Default bias: 5 unless evidence pushes it up. Don't score 7+ for a flat 3-scene slideshow even if the typography is fine.

# Auto-deduct (these alone cap the score):
- Any scene ≥ 5 seconds (broadcast pacing, dead on phone) → cap at 5
- Fewer than 5 scenes for a video > 12s → cap at 5
- Same colorGrade across all scenes → cap at 6
- Same background color across all scenes → cap at 5
- Generic motivational filler ("Make yours count", "Start now", "X better", "X matters") in any scene → cap at 5
- No clear hook in scene 1 (just a topic title is NOT a hook) → cap at 6
- No payoff/CTA in last scene (just trails off) → cap at 6
- All scenes are text_only or all stat → cap at 6 (variety required)

# What you specifically look for
- HOOK: Does scene 1 stop a scroll? "5 facts about coffee" is a topic, not a hook. "Most coffee shops over-extract by 12 seconds" is a hook.
- PACING: Are scenes 1.5-3.5s with VARIATION? Or are they all 4-5s drones?
- VARIETY: Different colors / grades / scene types / transitions across the timeline?
- ARC: Hook → development → payoff. Or just three things in a row?
- TEXT QUALITY: Specific facts > vague exhortations. "73% of Y" beats "make Y count".
- LEGIBILITY: Text fits, contrasts well, doesn't overlap.

# Issues you submit
Concrete, actionable, tied to sceneId where possible. NOT "make it more engaging" — say "scene 3 statLabel has 11 words, cut to 5" or "scene 1 'Make yours count' is empty filler — replace with specific stat or hook."

If the video genuinely scores ≥ 8, keep issues short — only flag what would push 8 → 10.

Tool calls are your output. Don't narrate.`;

/**
 * Subset of project fields the critic actually needs. Both DraftProject
 * (one-shot generator) and full Project (chat agent) supply this shape.
 */
interface CritiqueProject {
	name: string;
	orientation?: "portrait" | "landscape";
	scenes: Array<{
		id?: string;
		type: string;
		duration?: number;
		durationSec?: number;
		text?: string;
		emphasisText?: string;
		statValue?: string;
		bulletItems?: string[];
		quoteText?: string;
		transition?: string;
	}>;
}

function projectToCritique(input: Project | DraftProject): CritiqueProject {
	if ("orientation" in input) {
		return input as CritiqueProject;
	}
	const project = input;
	return {
		name: project.name,
		orientation: project.height > project.width ? "portrait" : "landscape",
		scenes: project.scenes.map((s) => ({
			id: s.id,
			type: s.type,
			duration: s.duration,
			text: s.text,
			emphasisText: s.emphasisText,
			statValue: s.statValue,
			bulletItems: s.bulletItems,
			quoteText: s.quoteText,
			transition: s.transition,
		})),
	};
}

export async function critiqueDraft(input: {
	draft: Project | DraftProject;
	frames: Array<{ tSec: number; base64: string }>;
	audioPeaks: number[];
}): Promise<Critique> {
	const draft = projectToCritique(input.draft);
	const { frames, audioPeaks } = input;
	const client = getAnthropic();

	const summary = [
		"Project metadata:",
		`- Name: ${draft.name}`,
		`- Orientation: ${draft.orientation ?? "landscape"}`,
		`- Scene count: ${draft.scenes.length}`,
		"",
		"Scene graph (for matching frames to scene structure):",
		...draft.scenes.map((s, i) => {
			const dur = s.durationSec ?? s.duration ?? 0;
			return (
				`${i + 1}. type=${s.type}, durationSec=${dur}` +
				(s.text ? `, text="${s.text.slice(0, 60)}"` : "") +
				(s.emphasisText
					? `, emphasisText="${s.emphasisText.slice(0, 40)}"`
					: "") +
				(s.statValue ? `, statValue="${s.statValue}"` : "") +
				(s.bulletItems ? `, bulletItems=[${s.bulletItems.length}]` : "") +
				(s.quoteText ? `, quoteText="${s.quoteText.slice(0, 40)}"` : "") +
				(s.transition ? `, transition=${s.transition}` : "")
			);
		}),
		"",
		`Audio RMS peaks (1Hz, ${audioPeaks.length} samples, 0=silent → 1=loud):`,
		audioPeaks.length > 0
			? `[${audioPeaks.map((p) => p.toFixed(2)).join(", ")}]`
			: "(no audio detected)",
		"",
		`${frames.length} frames are attached below in chronological order at timestamps: ${frames
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
					media_type: "image/jpeg",
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
