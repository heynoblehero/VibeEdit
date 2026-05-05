/**
 * Haptic abstraction. The phone shell calls these on tab switch, scene
 * switch, slider snap, etc — small confirmation buzzes that make the
 * UI feel like a native app.
 *
 * On Capacitor (Android/iOS) we lazy-load `@capacitor/haptics` for the
 * proper system feedback. On web we fall back to `navigator.vibrate()`
 * which works in modern Android Chrome, and silently no-op everywhere
 * else (desktop browsers, iOS Safari).
 *
 * Why a thin abstraction: every callsite would otherwise need its own
 * `try { Haptics.impact() } catch` boilerplate, and we'd never be able
 * to silence haptics globally (e.g. user accessibility preference).
 */

const VIBRATE_MS = { light: 8, medium: 14, heavy: 22 } as const;

const isClient = () => typeof window !== "undefined";

let nativePromise: Promise<{
	impact: (level: "light" | "medium" | "heavy") => void;
	notify: (kind: "success" | "warning" | "error") => void;
} | null> | null = null;

/**
 * Resolve once and cache the native handle. Returning null means web
 * fallback. We only attempt the native import on Capacitor — bundlers
 * keep the import async-tree-shakable so web bundles never fetch it.
 */
async function resolveNative() {
	if (!isClient()) return null;
	if (nativePromise) return nativePromise;
	nativePromise = (async () => {
		try {
			const { Capacitor } = await import("@capacitor/core");
			if (!Capacitor.isNativePlatform()) return null;
			const { Haptics, ImpactStyle, NotificationType } = await import(
				"@capacitor/haptics"
			);
			const styleByLevel = {
				light: ImpactStyle.Light,
				medium: ImpactStyle.Medium,
				heavy: ImpactStyle.Heavy,
			};
			const typeByKind = {
				success: NotificationType.Success,
				warning: NotificationType.Warning,
				error: NotificationType.Error,
			};
			return {
				impact: (level: "light" | "medium" | "heavy") => {
					Haptics.impact({ style: styleByLevel[level] }).catch(() => {});
				},
				notify: (kind: "success" | "warning" | "error") => {
					Haptics.notification({ type: typeByKind[kind] }).catch(() => {});
				},
			};
		} catch {
			return null;
		}
	})();
	return nativePromise;
}

function webVibrate(ms: number | number[]): void {
	if (!isClient()) return;
	const nav = navigator as Navigator & {
		vibrate?: (pattern: number | number[]) => boolean;
	};
	try {
		nav.vibrate?.(ms);
	} catch {
		// gated by user-activation on some browsers; non-fatal
	}
}

async function impact(level: "light" | "medium" | "heavy") {
	const native = await resolveNative();
	if (native) native.impact(level);
	else webVibrate(VIBRATE_MS[level]);
}

async function notify(kind: "success" | "warning" | "error") {
	const native = await resolveNative();
	if (native) native.notify(kind);
	else if (kind === "success") webVibrate([10, 40, 10]);
	else webVibrate(VIBRATE_MS.heavy);
}

export const haptics = {
	light: () => void impact("light"),
	medium: () => void impact("medium"),
	heavy: () => void impact("heavy"),
	success: () => void notify("success"),
	warning: () => void notify("warning"),
	error: () => void notify("error"),
};
