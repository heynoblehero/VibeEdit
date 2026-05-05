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
		version: "0.34.0",
		date: "2026-05-05",
		title: "Polish wave + Image workspace lands",
		highlights: [
			"Image workspace: Canva-style canvas with smart guides, layer locking, right-click context menu, and PNG export.",
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
