/**
 * Hand-curated overlay clips that ship with the editor. The Issac Pack
 * (and future packs) live here so MediaLibrary's Overlays tab has
 * something to render before the user uploads their own. Each preset
 * binds a video file to a default blend mode so the AE-style "additive
 * overlay" effect (black background drops out via screen blend)
 * happens with one click rather than three.
 */
export interface OverlayPreset {
	id: string;
	name: string;
	src: string;
	thumbnailSrc?: string;
	/** Description shown under the title in the picker grid. */
	description?: string;
	/**
	 * CSS mix-blend-mode the clip should default to when inserted. The
	 * Issac-pack overlays were authored on black, so "screen" is the
	 * common case — black pixels become transparent.
	 */
	defaultBlendMode?: "screen" | "lighten" | "normal";
	/** Where on the canvas the overlay defaults to. "full" = covers it. */
	defaultPosition?: "full" | "overlay-tl" | "overlay-tr" | "overlay-bl" | "overlay-br";
	/** Frames to default the BRoll's durationFrames to. */
	suggestedDurationFrames?: number;
	/** Free-text tags so a future filter chip row has something to bind to. */
	tags: string[];
}

export const OVERLAY_PRESETS: OverlayPreset[] = [
	{
		id: "issac-pack-breaking-glass",
		name: "Breaking Glass",
		src: "/overlays/issac-pack/breaking-glass.mp4",
		description: "Glass shatter overlay. Use screen blend for the dark areas to disappear.",
		defaultBlendMode: "screen",
		defaultPosition: "full",
		suggestedDurationFrames: 60,
		tags: ["impact", "transition", "issac"],
	},
	{
		id: "issac-pack-neon-flash",
		name: "Neon Flash",
		src: "/overlays/issac-pack/neon-flash.mp4",
		description: "Neon-light burst on black. Screen-blend it over a base scene.",
		defaultBlendMode: "screen",
		defaultPosition: "full",
		suggestedDurationFrames: 60,
		tags: ["light", "atmosphere", "issac"],
	},
];
