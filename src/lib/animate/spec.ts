/**
 * AnimationSpec is the structured output of the Animate workspace.
 * AI emits a spec, the client renders it via the Remotion Player for
 * live preview, and the server renders it via renderMedia() to mp4
 * for download / dropping onto a project scene.
 *
 * Each template defines its own props shape; the spec.props is typed
 * loosely here and validated at the template boundary. Adding a new
 * template = add an id + a Remotion component + a Zod-ish validator.
 */
export type AnimationTemplateId =
	| "kinetic-title"
	| "lower-third"
	| "big-number"
	| "quote-card"
	| "bullet-list"
	| "logo-reveal";

export interface AnimationSpec {
	id: string;
	templateId: AnimationTemplateId;
	durationFrames: number;
	fps: number;
	width: number;
	height: number;
	/** Validated by the template at render time. */
	props: Record<string, unknown>;
	/** Optional metadata. */
	createdAt?: number;
	prompt?: string;
	/** User-friendly label for library / inspector. */
	name?: string;
}

export const ANIMATION_TEMPLATES: Record<
	AnimationTemplateId,
	{
		id: AnimationTemplateId;
		label: string;
		blurb: string;
		defaultDurationSec: number;
		defaultProps: Record<string, unknown>;
	}
> = {
	"kinetic-title": {
		id: "kinetic-title",
		label: "Kinetic title",
		blurb: "Animated title with word-by-word reveal.",
		defaultDurationSec: 3,
		defaultProps: {
			text: "Make it move",
			subtitle: "",
			color: "#ffffff",
			background: "#0a0a0a",
			accent: "#ec4899",
		},
	},
	"lower-third": {
		id: "lower-third",
		label: "Lower third",
		blurb: "Name + subtitle bar that slides in from the left.",
		defaultDurationSec: 4,
		defaultProps: {
			name: "Speaker name",
			role: "Title or affiliation",
			background: "transparent",
			accent: "#ec4899",
			textColor: "#ffffff",
		},
	},
	"big-number": {
		id: "big-number",
		label: "Big number reveal",
		blurb: "Count-up to a value with a label below.",
		defaultDurationSec: 2.5,
		defaultProps: {
			value: 1000,
			prefix: "",
			suffix: "+",
			label: "users",
			color: "#ffffff",
			background: "#0a0a0a",
			accent: "#ec4899",
		},
	},
	"quote-card": {
		id: "quote-card",
		label: "Quote card",
		blurb: "Typewriter quote with author attribution.",
		defaultDurationSec: 5,
		defaultProps: {
			quote: "The best way to predict the future is to invent it.",
			author: "Alan Kay",
			background: "#0a0a0a",
			textColor: "#ffffff",
			accent: "#ec4899",
		},
	},
	"bullet-list": {
		id: "bullet-list",
		label: "Bullet list",
		blurb: "Staggered bullet points with title.",
		defaultDurationSec: 5,
		defaultProps: {
			title: "Three things to know",
			bullets: ["First idea", "Second idea", "Third idea"],
			background: "#0a0a0a",
			textColor: "#ffffff",
			accent: "#ec4899",
		},
	},
	"logo-reveal": {
		id: "logo-reveal",
		label: "Logo reveal",
		blurb: "Image scales in with a shimmer wash.",
		defaultDurationSec: 2,
		defaultProps: {
			imageUrl: "",
			background: "#0a0a0a",
			accent: "#ec4899",
		},
	},
};

export function makeDefaultSpec(
	templateId: AnimationTemplateId,
	canvas: { fps: number; width: number; height: number },
): AnimationSpec {
	const tpl = ANIMATION_TEMPLATES[templateId];
	return {
		id: `anim_${Math.random().toString(36).slice(2, 10)}`,
		templateId,
		durationFrames: Math.max(1, Math.round(tpl.defaultDurationSec * canvas.fps)),
		fps: canvas.fps,
		width: canvas.width,
		height: canvas.height,
		props: { ...tpl.defaultProps },
		createdAt: Date.now(),
		name: tpl.label,
	};
}
