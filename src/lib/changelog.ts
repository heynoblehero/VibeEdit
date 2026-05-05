/**
 * Single source of truth for the in-app changelog. The `/changelog`
 * page renders this list, and the WhatsNewModal pops up once when the
 * top entry's `version` is newer than the one stashed in localStorage.
 *
 * Convention: bump `version` (semver-ish) every time you add a new
 * top-of-list entry. The version string is the identity key for the
 * "have I shown this user yet?" check, so any non-empty unique value
 * works — but semver gives us a sortable history.
 */
export interface ChangelogEntry {
	version: string;
	date: string;
	title: string;
	highlights: string[];
}

export const CHANGELOG: ChangelogEntry[] = [
	{
		version: "0.36.0",
		date: "2026-05-06",
		title: "Phone-first editor — feels like an app",
		highlights: [
			"New phone shell at <720px: bottom tab bar (Scenes / Edit / Render), full-bleed preview, big back button. The editor stops feeling like a website opened in an app.",
			"Native chrome on Android: real splash screen (no more blank-white launch), dark status bar overlaying the WebView, safe-area insets so notched phones don't clip the header.",
			"Hardware back button now pops the tab stack instead of exiting the app on the first press. Soft keyboard resizes the WebView without breaking the bottom bar.",
			"Swipe between scenes on the preview, haptic feedback on tab switches and scene swipes, native share sheet for finished renders.",
			"This APK release bundles @capacitor/{splash-screen, status-bar, keyboard, app, haptics, share}. Reinstall the APK from /download to pick them up.",
		],
	},
	{
		version: "0.35.0",
		date: "2026-05-05",
		title: "Back to one workspace",
		highlights: [
			"Removed the Audio, Animate, and Image workspace tabs. The product is one thing again: chat → video.",
			"Audio editing (voiceover, music, SFX, ducking) lives inside the scene editor, not a parallel tab.",
			"Animate (AI motion graphics) and Image (Canva-style canvas) cut entirely — they were drifting away from the core promise.",
		],
	},
	{
		version: "0.34.0",
		date: "2026-05-05",
		title: "Polish pass",
		highlights: [
			"Render queue: free-tier watermark badge for hosted renders (env-flagged so self-hosters keep clean exports).",
			"Chat: Stop button cancels in-flight generations cleanly. Pin prompts to keep your favourites in the suggestions row.",
			"Issac Pack: 9 character poses, 20 graphics, 13 SFX, and screen-blend overlays available from Media Library.",
			"Toasts now de-dupe identical messages within an 800ms window — no more 5-stack 'Saved' toasts.",
		],
	},
	{
		version: "0.33.0",
		date: "2026-04-22",
		title: "Android shell + APK download",
		highlights: [
			"Capacitor-wrapped Android APK — install from /download and edit on the phone.",
			"Mobile drawers replace fixed rails below 720px; long-press to drag scenes on touch.",
			"Service worker caches the editor shell so a flaky connection won't black-screen mid-edit.",
		],
	},
	{
		version: "0.32.0",
		date: "2026-04-08",
		title: "Animate workspace + Cmd+P quick open",
		highlights: [
			"Animate: chat-driven motion graphics with templates (big number, lower third, quote, bullet list).",
			"Cmd+P opens a quick-jump palette across scenes, projects, and recent renders.",
			"`What is this?` glossary surfaces in the command palette when you forget what a control does.",
		],
	},
];

export const CURRENT_VERSION = CHANGELOG[0]?.version ?? "0.0.0";
