/**
 * Curated emoji set grouped by mood / use-case for short-form video.
 * Avoids the full unicode emoji catalog (3000+) since 90% of those are
 * never used in editor overlays. Each entry is the rendered emoji char
 * plus a search-friendly keyword string for the modal's filter input.
 */

export interface EmojiEntry {
	char: string;
	keywords: string;
}

export interface EmojiCategory {
	id: string;
	label: string;
	entries: EmojiEntry[];
}

export const EMOJI_CATEGORIES: EmojiCategory[] = [
	{
		id: "reactions",
		label: "Reactions",
		entries: [
			{ char: "🔥", keywords: "fire hot trending viral" },
			{ char: "💀", keywords: "skull dead lol" },
			{ char: "😂", keywords: "lol laughing tears" },
			{ char: "🤣", keywords: "rofl rolling laughing" },
			{ char: "😭", keywords: "crying sad sob" },
			{ char: "😱", keywords: "scream shocked omg" },
			{ char: "🤯", keywords: "mind blown explode" },
			{ char: "🥹", keywords: "tearful smile" },
			{ char: "😳", keywords: "flushed embarrassed" },
			{ char: "😏", keywords: "smirk smug" },
			{ char: "🙄", keywords: "eye roll annoyed" },
			{ char: "😤", keywords: "huff steam serious" },
			{ char: "🤨", keywords: "raised eyebrow sus" },
			{ char: "🥶", keywords: "cold freezing" },
			{ char: "🥵", keywords: "hot sweat heat" },
			{ char: "🤪", keywords: "crazy zany silly" },
		],
	},
	{
		id: "love",
		label: "Love",
		entries: [
			{ char: "❤️", keywords: "heart love red" },
			{ char: "🧡", keywords: "orange heart" },
			{ char: "💛", keywords: "yellow heart" },
			{ char: "💚", keywords: "green heart" },
			{ char: "💙", keywords: "blue heart" },
			{ char: "💜", keywords: "purple heart" },
			{ char: "🖤", keywords: "black heart" },
			{ char: "🤍", keywords: "white heart" },
			{ char: "💖", keywords: "sparkling heart" },
			{ char: "💗", keywords: "growing heart" },
			{ char: "💘", keywords: "heart arrow" },
			{ char: "💝", keywords: "heart bow gift" },
			{ char: "💕", keywords: "two hearts" },
			{ char: "🥰", keywords: "smiling hearts in love" },
		],
	},
	{
		id: "objects",
		label: "Objects",
		entries: [
			{ char: "💯", keywords: "100 percent perfect" },
			{ char: "✨", keywords: "sparkles shine magic" },
			{ char: "⭐", keywords: "star" },
			{ char: "🌟", keywords: "glowing star" },
			{ char: "💫", keywords: "dizzy star" },
			{ char: "⚡", keywords: "bolt lightning" },
			{ char: "💥", keywords: "boom collision" },
			{ char: "🎯", keywords: "target bullseye" },
			{ char: "💡", keywords: "lightbulb idea" },
			{ char: "🔔", keywords: "bell notification" },
			{ char: "🚀", keywords: "rocket launch" },
			{ char: "💰", keywords: "money bag" },
			{ char: "💸", keywords: "money flying" },
			{ char: "🏆", keywords: "trophy win" },
			{ char: "🥇", keywords: "gold medal first" },
			{ char: "📈", keywords: "chart up trending" },
			{ char: "📉", keywords: "chart down" },
			{ char: "🎬", keywords: "clapper film" },
			{ char: "🎥", keywords: "camera video" },
			{ char: "🎵", keywords: "note music" },
			{ char: "🎶", keywords: "notes music" },
		],
	},
	{
		id: "gestures",
		label: "Gestures",
		entries: [
			{ char: "👍", keywords: "thumbs up" },
			{ char: "👎", keywords: "thumbs down" },
			{ char: "👏", keywords: "clap applause" },
			{ char: "🙌", keywords: "raise hands praise" },
			{ char: "🙏", keywords: "pray thanks" },
			{ char: "👀", keywords: "eyes look" },
			{ char: "💪", keywords: "muscle strong" },
			{ char: "✊", keywords: "fist power" },
			{ char: "🤝", keywords: "handshake deal" },
			{ char: "✌️", keywords: "peace victory" },
			{ char: "🤞", keywords: "fingers crossed" },
			{ char: "🫶", keywords: "heart hands love" },
			{ char: "👉", keywords: "point right" },
			{ char: "👈", keywords: "point left" },
			{ char: "👆", keywords: "point up" },
			{ char: "🫵", keywords: "point at you" },
		],
	},
	{
		id: "symbols",
		label: "Symbols",
		entries: [
			{ char: "✅", keywords: "check yes correct" },
			{ char: "❌", keywords: "x wrong cross" },
			{ char: "⚠️", keywords: "warning caution" },
			{ char: "🚨", keywords: "siren alert" },
			{ char: "🆕", keywords: "new" },
			{ char: "🔴", keywords: "red dot live" },
			{ char: "🟢", keywords: "green dot ok" },
			{ char: "🟡", keywords: "yellow dot caution" },
			{ char: "🔥", keywords: "fire hot" },
			{ char: "💎", keywords: "gem diamond rare" },
			{ char: "🔒", keywords: "lock closed" },
			{ char: "🔓", keywords: "unlock open" },
			{ char: "🔑", keywords: "key" },
			{ char: "📌", keywords: "pin pinned" },
		],
	},
];
