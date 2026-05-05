/**
 * Design tokens — the single source of truth for spacing, typography,
 * radii, motion, and surface colors. Every primitive component reads
 * from this file. Per-component magic numbers are forbidden.
 *
 * If you find yourself writing `rounded-md`, `text-[10px]`, or
 * `bg-neutral-925` directly in a feature file, stop and either:
 *   1. Use a primitive from `src/components/ui/`, or
 *   2. Add a token here and reference it.
 *
 * The `tw` and `cls` exports are tiny helpers — `tw` is just an alias
 * for tagged-template strings (gives editors syntax highlighting on
 * Tailwind class strings); `cls` joins conditional classes.
 */

export const motion = {
	/** 150ms — micro feedback (hover, focus). */
	fast: "150ms",
	/** 250ms — standard transitions (panel open, tab switch). */
	med: "250ms",
	/** 400ms — large surface changes (workspace switch). */
	slow: "400ms",
	/** Spring tuned for snappy-but-not-bouncy panel entrances. */
	spring: { damping: 18, stiffness: 200, mass: 1 },
	/** Easing curves matching what we use in Remotion's resolveEasing. */
	easeOut: "cubic-bezier(0.16, 1, 0.3, 1)",
	easeInOut: "cubic-bezier(0.65, 0, 0.35, 1)",
} as const;

export const radii = {
	sm: "rounded",
	md: "rounded-md",
	lg: "rounded-lg",
} as const;

export const fontSize = {
	/** Smallest readable — metadata, captions. */
	xs: "text-[11px]",
	/** Default chrome (toolbar labels, panel headers). */
	sm: "text-[12px]",
	/** Body text. */
	base: "text-[13px]",
	/** Emphasized body / form inputs. */
	md: "text-[14px]",
	/** Headers within panels. */
	lg: "text-[16px]",
	/** Page-level titles. */
	xl: "text-[18px]",
	/** Display titles (hero, empty state heroes). */
	display: "text-[24px]",
} as const;

/**
 * Single-source elevation. Don't write `shadow-2xl` ad-hoc.
 *   - card    → resting surface (panels, scene cards on hover)
 *   - floating → popovers, palettes, dock pills
 *   - modal   → full-screen dialogs (PropertyModal, command palette card)
 */
export const shadow = {
	card: "shadow-[0_1px_2px_rgba(0,0,0,0.4)]",
	floating: "shadow-[0_8px_24px_rgba(0,0,0,0.45)]",
	modal: "shadow-[0_24px_60px_rgba(0,0,0,0.65)]",
} as const;

/**
 * Single focus-ring style — every interactive surface. Never write
 * focus styles inline; reach for `focusRing("video")` instead.
 */
export const focusRing = (a: AccentName = "video") =>
	cls(
		"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-0",
		a === "video"
			? "focus-visible:ring-emerald-500/40"
			: a === "audio"
				? "focus-visible:ring-orange-500/40"
				: "focus-visible:ring-fuchsia-500/40",
	);

export const fontWeight = {
	normal: "font-normal",
	medium: "font-medium",
	semibold: "font-semibold",
	bold: "font-bold",
} as const;

/**
 * Surface scale — pick one of these for any panel/page background.
 * `surface0` is the page itself; each step up is one level "raised".
 * Using these consistently makes the depth hierarchy legible.
 */
export const surface = {
	/** Page bg. */
	"0": "bg-neutral-950",
	/** Default panel surface (asides, headers). */
	"1": "bg-neutral-925",
	/** Raised card / elevated panel. */
	"2": "bg-neutral-900",
	/** Floating elements (modals, popovers, toasts). */
	"3": "bg-neutral-850",
	/** Hover state for interactive surface-2 items. */
	hover: "bg-neutral-900/80",
} as const;

export const border = {
	/** Default 1px border. */
	default: "border border-neutral-800",
	/** Stronger border for selected / focused state. */
	strong: "border border-neutral-700",
	/** Subtle separator between sections. */
	subtle: "border border-neutral-800/60",
	/** Dashed for empty/placeholder states. */
	dashed: "border border-dashed border-neutral-800",
} as const;

/**
 * Workspace accent colors. Chrome should be subtle (neutral); accents
 * are a 4px strip + a small icon tint, not full 2px enclosures.
 */
export const accent = {
	video: {
		text: "text-emerald-300",
		bg: "bg-emerald-500",
		bgSoft: "bg-emerald-500/15",
		bgHover: "hover:bg-emerald-500/20",
		ring: "ring-emerald-500/40",
		strip: "bg-emerald-500",
		border: "border-emerald-500/30",
	},
	audio: {
		text: "text-orange-300",
		bg: "bg-orange-500",
		bgSoft: "bg-orange-500/15",
		bgHover: "hover:bg-orange-500/20",
		ring: "ring-orange-500/40",
		strip: "bg-orange-500",
		border: "border-orange-500/30",
	},
	animate: {
		text: "text-fuchsia-300",
		bg: "bg-fuchsia-500",
		bgSoft: "bg-fuchsia-500/15",
		bgHover: "hover:bg-fuchsia-500/20",
		ring: "ring-fuchsia-500/40",
		strip: "bg-fuchsia-500",
		border: "border-fuchsia-500/30",
	},
	image: {
		text: "text-sky-300",
		bg: "bg-sky-500",
		bgSoft: "bg-sky-500/15",
		bgHover: "hover:bg-sky-500/20",
		ring: "ring-sky-500/40",
		strip: "bg-sky-500",
		border: "border-sky-500/30",
	},
} as const;

export type AccentName = keyof typeof accent;

/** Trivial class joiner; nullable values dropped. */
export function cls(
	...args: Array<string | false | null | undefined>
): string {
	return args.filter(Boolean).join(" ");
}

/** Identity tagged template — only here for editor highlighting. */
export const tw = (strings: TemplateStringsArray, ...values: unknown[]) =>
	strings.reduce(
		(acc, s, i) => acc + s + (i < values.length ? String(values[i]) : ""),
		"",
	);
