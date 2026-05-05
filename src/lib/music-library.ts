/**
 * Curated free-to-use music library. Tracks come from three sources
 * with stable CDNs and clear licensing terms:
 *
 *   - Pixabay (CC0 / no attribution required)
 *   - Bensound (free with credit)
 *   - NCS-style tracks linked through to their official download page
 *
 * Each entry stores enough metadata for a useful UI (mood / bpm /
 * source / license) plus a `previewUrl` that plays in <audio>. If a
 * track's `previewUrl` is omitted, the UI surfaces an "External"
 * button instead of a one-click attach.
 */

export type LicenseKind =
	| "cc0"
	| "pixabay"
	| "bensound"
	| "ncs"
	| "external";

export type MusicMood =
	| "hype"
	| "chill"
	| "cinematic"
	| "uplifting"
	| "lo-fi"
	| "dramatic"
	| "playful";

export interface MusicTrack {
	id: string;
	title: string;
	artist: string;
	mood: MusicMood;
	bpm?: number;
	durationSec?: number;
	/** Direct URL that plays in <audio> AND can be passed to MusicBed.url. */
	previewUrl?: string;
	/** Where the user goes to download the original / read the license. */
	sourceUrl: string;
	license: LicenseKind;
	source: string;
}

const PIXABAY = (id: string, file: string) =>
	`https://cdn.pixabay.com/download/audio/${id}/${file}.mp3`;

export const MUSIC_TRACKS: MusicTrack[] = [
	{
		id: "pix-energetic-1",
		title: "Energetic Rock",
		artist: "Pixabay",
		mood: "hype",
		bpm: 130,
		durationSec: 137,
		previewUrl: PIXABAY("2022/10/25/audio_864e7f4f3c", "energetic-rock-trailer-141998"),
		sourceUrl: "https://pixabay.com/music/",
		license: "pixabay",
		source: "Pixabay",
	},
	{
		id: "pix-cinematic-1",
		title: "Cinematic Inspiring",
		artist: "Pixabay",
		mood: "cinematic",
		bpm: 95,
		durationSec: 153,
		previewUrl: PIXABAY("2022/03/10/audio_8cb749cd3a", "inspiring-cinematic-ambient-116199"),
		sourceUrl: "https://pixabay.com/music/",
		license: "pixabay",
		source: "Pixabay",
	},
	{
		id: "pix-lofi-1",
		title: "Lo-fi Study",
		artist: "Pixabay",
		mood: "lo-fi",
		bpm: 75,
		durationSec: 168,
		previewUrl: PIXABAY("2022/05/27/audio_1808fbf07a", "lofi-study-112191"),
		sourceUrl: "https://pixabay.com/music/",
		license: "pixabay",
		source: "Pixabay",
	},
	{
		id: "pix-uplifting-1",
		title: "Sunny Upbeat",
		artist: "Pixabay",
		mood: "uplifting",
		bpm: 120,
		durationSec: 145,
		previewUrl: PIXABAY("2022/05/27/audio_06b3a4d22c", "sunny-day-115021"),
		sourceUrl: "https://pixabay.com/music/",
		license: "pixabay",
		source: "Pixabay",
	},
	{
		id: "pix-chill-1",
		title: "Chillhop",
		artist: "Pixabay",
		mood: "chill",
		bpm: 90,
		durationSec: 142,
		previewUrl: PIXABAY("2022/08/03/audio_2dde668d05", "chill-abstract-intention-12099"),
		sourceUrl: "https://pixabay.com/music/",
		license: "pixabay",
		source: "Pixabay",
	},
	{
		id: "bensound-summer",
		title: "Summer",
		artist: "Bensound",
		mood: "uplifting",
		bpm: 110,
		durationSec: 217,
		previewUrl: "https://www.bensound.com/bensound-music/bensound-summer.mp3",
		sourceUrl: "https://www.bensound.com/free-music-for-videos",
		license: "bensound",
		source: "Bensound",
	},
	{
		id: "bensound-energy",
		title: "Energy",
		artist: "Bensound",
		mood: "hype",
		bpm: 128,
		durationSec: 180,
		previewUrl: "https://www.bensound.com/bensound-music/bensound-energy.mp3",
		sourceUrl: "https://www.bensound.com/free-music-for-videos",
		license: "bensound",
		source: "Bensound",
	},
	{
		id: "bensound-creativeminds",
		title: "Creative Minds",
		artist: "Bensound",
		mood: "uplifting",
		bpm: 110,
		durationSec: 145,
		previewUrl: "https://www.bensound.com/bensound-music/bensound-creativeminds.mp3",
		sourceUrl: "https://www.bensound.com/free-music-for-videos",
		license: "bensound",
		source: "Bensound",
	},
	{
		id: "bensound-buddy",
		title: "Buddy",
		artist: "Bensound",
		mood: "playful",
		bpm: 120,
		durationSec: 121,
		previewUrl: "https://www.bensound.com/bensound-music/bensound-buddy.mp3",
		sourceUrl: "https://www.bensound.com/free-music-for-videos",
		license: "bensound",
		source: "Bensound",
	},
	{
		id: "bensound-jazzy",
		title: "Jazzy Frenchy",
		artist: "Bensound",
		mood: "playful",
		bpm: 100,
		durationSec: 105,
		previewUrl: "https://www.bensound.com/bensound-music/bensound-jazzyfrenchy.mp3",
		sourceUrl: "https://www.bensound.com/free-music-for-videos",
		license: "bensound",
		source: "Bensound",
	},
	{
		id: "bensound-ukulele",
		title: "Ukulele",
		artist: "Bensound",
		mood: "playful",
		bpm: 100,
		durationSec: 145,
		previewUrl: "https://www.bensound.com/bensound-music/bensound-ukulele.mp3",
		sourceUrl: "https://www.bensound.com/free-music-for-videos",
		license: "bensound",
		source: "Bensound",
	},
	{
		id: "bensound-acoustic",
		title: "Acoustic Breeze",
		artist: "Bensound",
		mood: "chill",
		bpm: 100,
		durationSec: 167,
		previewUrl: "https://www.bensound.com/bensound-music/bensound-acousticbreeze.mp3",
		sourceUrl: "https://www.bensound.com/free-music-for-videos",
		license: "bensound",
		source: "Bensound",
	},
	{
		id: "ncs-elektronomia",
		title: "Sky High",
		artist: "Elektronomia · NCS",
		mood: "hype",
		sourceUrl: "https://ncs.io/SkyHigh",
		license: "ncs",
		source: "NoCopyrightSounds",
	},
	{
		id: "ncs-cartoon",
		title: "On & On",
		artist: "Cartoon · NCS",
		mood: "uplifting",
		sourceUrl: "https://ncs.io/OnandOn",
		license: "ncs",
		source: "NoCopyrightSounds",
	},
	{
		id: "ncs-jim-yosef",
		title: "Firefly",
		artist: "Jim Yosef · NCS",
		mood: "hype",
		sourceUrl: "https://ncs.io/firefly",
		license: "ncs",
		source: "NoCopyrightSounds",
	},
	{
		id: "ncs-different-heaven",
		title: "Nekozilla",
		artist: "Different Heaven · NCS",
		mood: "dramatic",
		sourceUrl: "https://ncs.io/Nekozilla",
		license: "ncs",
		source: "NoCopyrightSounds",
	},
	{
		id: "ncs-tobu",
		title: "Higher",
		artist: "Tobu · NCS",
		mood: "uplifting",
		sourceUrl: "https://ncs.io/Higher",
		license: "ncs",
		source: "NoCopyrightSounds",
	},
];

export const MUSIC_MOODS: { id: MusicMood | "all"; label: string }[] = [
	{ id: "all", label: "All" },
	{ id: "hype", label: "Hype" },
	{ id: "uplifting", label: "Uplifting" },
	{ id: "cinematic", label: "Cinematic" },
	{ id: "chill", label: "Chill" },
	{ id: "lo-fi", label: "Lo-fi" },
	{ id: "dramatic", label: "Dramatic" },
	{ id: "playful", label: "Playful" },
];

export const LICENSE_LABEL: Record<LicenseKind, string> = {
	cc0: "CC0 · no credit needed",
	pixabay: "Pixabay · free, no credit needed",
	bensound: "Bensound · credit required",
	ncs: "NCS · credit required",
	external: "External link",
};
