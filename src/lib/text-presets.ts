import type { TextItem } from "./scene-schema";

/**
 * Curated text presets — non-editor-friendly starting points. Each
 * preset is a partial TextItem applied on top of `defaultPlaceholderTextItem`
 * so position / id / startFrame come from the caller. Keep the set
 * tight — too many choices kills the workflow.
 */

export interface TextPreset {
	id: string;
	label: string;
	hint?: string;
	/** Sample copy that fits the visual style. */
	sampleCopy: string;
	/** Background tint for the preview tile. Most presets read better
	 *  on dark, but yellow / white-on-white needs a contrast swatch. */
	previewBg: string;
	/** Style overrides applied on the new text item. */
	style: Partial<TextItem>;
}

export const TEXT_PRESETS: TextPreset[] = [
	{
		id: "headline_yellow",
		label: "Hook headline",
		hint: "Bold yellow, all-caps",
		sampleCopy: "WAIT FOR IT…",
		previewBg: "#0a0a0a",
		style: {
			fontSize: 96,
			color: "#fde047",
			fontFamily: "display",
			weight: 900,
			transform: "uppercase",
			letterSpacing: 1,
			align: "center",
			strokeColor: "#0a0a0a",
			strokeWidth: 4,
			shadow: { color: "#000000", blur: 16, x: 0, y: 6, opacity: 0.55 },
		},
	},
	{
		id: "subtitle_white",
		label: "Caption",
		hint: "Clean white subtitle",
		sampleCopy: "Then everything changed.",
		previewBg: "#1f1f1f",
		style: {
			fontSize: 56,
			color: "#fafafa",
			fontFamily: "system",
			weight: 600,
			align: "center",
			strokeColor: "#000000",
			strokeWidth: 2,
		},
	},
	{
		id: "label_pill",
		label: "Label pill",
		hint: "Compact tag",
		sampleCopy: "BREAKING",
		previewBg: "#1f1f1f",
		style: {
			fontSize: 32,
			color: "#0a0a0a",
			fontFamily: "system",
			weight: 800,
			transform: "uppercase",
			letterSpacing: 2,
			bgColor: "#fde047",
			bgPadding: 14,
			bgRadius: 999,
		},
	},
	{
		id: "neon_glow",
		label: "Neon glow",
		hint: "Soft cyan halo",
		sampleCopy: "vibe",
		previewBg: "#080814",
		style: {
			fontSize: 120,
			color: "#22d3ee",
			fontFamily: "display",
			weight: 700,
			italic: true,
			glowColor: "#22d3ee",
			shadow: { color: "#22d3ee", blur: 24, x: 0, y: 0, opacity: 0.85 },
		},
	},
	{
		id: "outline_serif",
		label: "Outline serif",
		hint: "Editorial drop",
		sampleCopy: "Chapter 01",
		previewBg: "#0a0a0a",
		style: {
			fontSize: 72,
			color: "transparent",
			fontFamily: "serif",
			weight: 700,
			italic: true,
			strokeColor: "#fafafa",
			strokeWidth: 2,
		},
	},
	{
		id: "stat_number",
		label: "Big number",
		hint: "Hero stat",
		sampleCopy: "73%",
		previewBg: "#0a0a0a",
		style: {
			fontSize: 220,
			color: "#10b981",
			fontFamily: "display",
			weight: 900,
			letterSpacing: -4,
			align: "center",
			strokeColor: "#0a0a0a",
			strokeWidth: 6,
		},
	},
	{
		id: "quote_serif",
		label: "Pull quote",
		hint: "Italic editorial",
		sampleCopy: "“The best way out is always through.”",
		previewBg: "#0f0f0f",
		style: {
			fontSize: 48,
			color: "#e5e5e5",
			fontFamily: "serif",
			italic: true,
			weight: 500,
			align: "center",
			lineHeight: 1.2,
		},
	},
	{
		id: "handwritten",
		label: "Handwritten",
		hint: "Casual mono",
		sampleCopy: "note to self",
		previewBg: "#0a0a0a",
		style: {
			fontSize: 56,
			color: "#fafafa",
			fontFamily: "mono",
			weight: 500,
			italic: true,
			align: "left",
		},
	},
	{
		id: "caps_red",
		label: "Alert red",
		hint: "All-caps red bold",
		sampleCopy: "DO NOT MISS THIS",
		previewBg: "#0a0a0a",
		style: {
			fontSize: 84,
			color: "#ef4444",
			fontFamily: "system",
			weight: 900,
			transform: "uppercase",
			letterSpacing: 1,
			align: "center",
			strokeColor: "#0a0a0a",
			strokeWidth: 3,
		},
	},
	{
		id: "minimal",
		label: "Minimal",
		hint: "Plain large body",
		sampleCopy: "Just like that.",
		previewBg: "#0a0a0a",
		style: {
			fontSize: 64,
			color: "#fafafa",
			fontFamily: "system",
			weight: 500,
			align: "center",
		},
	},
	{
		id: "gradient_pink",
		label: "Gradient",
		hint: "Pink → orange",
		sampleCopy: "vibes",
		previewBg: "#0a0a0a",
		style: {
			fontSize: 128,
			color: "#fb7185",
			fontFamily: "display",
			weight: 900,
			italic: true,
			letterSpacing: -2,
			glowColor: "#fb923c",
			shadow: { color: "#fb923c", blur: 28, x: 0, y: 0, opacity: 0.85 },
		},
	},
	{
		id: "badge_dark",
		label: "Dark badge",
		hint: "White on black",
		sampleCopy: "PART 1",
		previewBg: "#1f1f1f",
		style: {
			fontSize: 28,
			color: "#fafafa",
			fontFamily: "system",
			weight: 700,
			transform: "uppercase",
			letterSpacing: 4,
			bgColor: "#0a0a0a",
			bgPadding: 12,
			bgRadius: 6,
			outlineColor: "#fafafa",
			outlineWidth: 1,
		},
	},
];
