/**
 * Lightweight inline glossary for UI terms. Powers the "what is this?"
 * command-palette result so users don't have to leave the editor for
 * a docs page. Keep entries terse — one or two sentences. Add as
 * confusing terms come up in feedback.
 */
export interface GlossaryEntry {
	term: string;
	body: string;
	keywords?: string;
}

export const GLOSSARY: GlossaryEntry[] = [
	{
		term: "Animate workspace",
		body: "Magenta tab. Generates motion-graphic specs (titles, lower thirds, big numbers, quotes, bullets, logo reveals) via AI, renders them to mp4, and lets you drop the result onto a scene as background.",
		keywords: "magenta animation kinetic title motion graphic",
	},
	{
		term: "Audio workspace",
		body: "Orange tab. Multi-lane timeline for voiceover, music, and SFX. Master mix faders, per-clip trim/fade, and a peak meter. Audio attaches to scenes; render uses these settings.",
		keywords: "orange voiceover music sfx",
	},
	{
		term: "Snap (magnet)",
		body: "When on, dragging a clip's edge or position snaps to scene boundaries and the playhead within an 8px radius. Toggle with the magnet icon in the audio toolbar.",
		keywords: "snap magnet align",
	},
	{
		term: "Cmd+K",
		body: "Command palette — jump to any tab, scene, or project. Type to filter. ⌘P pre-filters to project switching.",
		keywords: "command palette navigate",
	},
	{
		term: "Render queue",
		body: "Bottom-right dock showing in-flight renders with progress, ETA, and cancel. Completed renders surface in the recent-renders strip; click for in-app preview.",
		keywords: "render export mp4",
	},
	{
		term: "Trash",
		body: "Soft-deleted projects live in /dashboard's Trash view for 30 days, then auto-purge. Restore from there or use Empty trash to forget immediately.",
		keywords: "trash delete restore",
	},
	{
		term: "Activity",
		body: "The pill next to the project name shows the last 20 events on this project — AI edits, voiceover adds, deletes. Click to expand; Clear to forget.",
		keywords: "activity history feed log",
	},
	{
		term: "Asset library",
		body: "Cross-project library of saved music, SFX, clips, images, and animations. Hover audio to preview at half volume. Tag-filter chips show once you have >5 items.",
		keywords: "asset library reuse music sfx",
	},
	{
		term: "Scene template",
		body: "Save a styled scene (background, text, transition) as a reusable template. Apply to a fresh scene with one click. Lives across projects.",
		keywords: "template scene preset",
	},
	{
		term: "AI cost meter",
		body: "Topbar pill aggregates this session's AI spend across chat, voiceover, animation, and render. Hover for breakdown.",
		keywords: "cost token usd spend",
	},
];

export function searchGlossary(query: string): GlossaryEntry[] {
	const q = query.trim().toLowerCase();
	if (!q) return [];
	return GLOSSARY.filter((g) => {
		const hay = `${g.term} ${g.keywords ?? ""}`.toLowerCase();
		return hay.includes(q);
	});
}
