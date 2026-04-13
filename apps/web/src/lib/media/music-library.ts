/**
 * Built-in royalty-free music and SFX library.
 * Uses Pixabay Music API (free, no attribution required).
 */

export interface MusicTrack {
	id: string;
	title: string;
	artist: string;
	duration: number;
	url: string;
	tags: string[];
	category: "music" | "sfx";
}

export interface MusicSearchResult {
	tracks: MusicTrack[];
	total: number;
}

/**
 * Search for royalty-free music via Pixabay API.
 * Requires PIXABAY_API_KEY env var (free to get at pixabay.com/api/docs/).
 */
export async function searchMusic(
	query: string,
	category: "music" | "sfx" = "music",
): Promise<MusicSearchResult> {
	const apiKey = process.env.PIXABAY_API_KEY;
	if (!apiKey) {
		return { tracks: getBuiltInTracks(query, category), total: 0 };
	}

	const endpoint = `https://pixabay.com/api/music/?key=${apiKey}&q=${encodeURIComponent(query)}&category=${category}`;
	const response = await fetch(endpoint);

	if (!response.ok) {
		return { tracks: getBuiltInTracks(query, category), total: 0 };
	}

	const data = await response.json();
	const tracks: MusicTrack[] = (data.hits || []).map((hit: any) => ({
		id: String(hit.id),
		title: hit.title || "Untitled",
		artist: hit.user || "Unknown",
		duration: hit.duration || 0,
		url: hit.audio || hit.url,
		tags: (hit.tags || "").split(",").map((t: string) => t.trim()),
		category,
	}));

	return { tracks, total: data.totalHits || 0 };
}

/**
 * Built-in music tags for when no API key is available.
 * Returns metadata-only — user needs to upload their own audio.
 */
function getBuiltInTracks(
	query: string,
	category: "music" | "sfx",
): MusicTrack[] {
	const suggestions = [
		{
			id: "suggest-upbeat",
			title: "Upbeat / Happy",
			tags: ["upbeat", "happy", "energetic", "fun"],
		},
		{
			id: "suggest-chill",
			title: "Chill / Lo-fi",
			tags: ["chill", "lofi", "relaxing", "calm"],
		},
		{
			id: "suggest-cinematic",
			title: "Cinematic / Epic",
			tags: ["cinematic", "epic", "dramatic", "film"],
		},
		{
			id: "suggest-corporate",
			title: "Corporate / Professional",
			tags: ["corporate", "business", "professional"],
		},
		{
			id: "suggest-electronic",
			title: "Electronic / Tech",
			tags: ["electronic", "tech", "digital", "synth"],
		},
	];

	const queryLower = query.toLowerCase();
	return suggestions
		.filter(
			(s) =>
				s.title.toLowerCase().includes(queryLower) ||
				s.tags.some((t) => t.includes(queryLower)),
		)
		.map((s) => ({
			...s,
			artist: "Suggested category",
			duration: 0,
			url: "",
			category,
		}));
}
