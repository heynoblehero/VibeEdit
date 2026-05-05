"use client";

/**
 * One-shot Capacitor wiring for the Android (and future iOS) build.
 *
 * Mounted from `layout.tsx` via a tiny client-only component; runs only
 * once on the very first mount. No-ops on plain web (Capacitor reports
 * `isNativePlatform()` false there) so the same bundle ships to the
 * dashboard at vibevideoedit.com without affecting it.
 *
 * What this configures:
 *   - **Splash screen**: hides the native splash once React has
 *     hydrated, with a small fade. Without this the splash sits on top
 *     of the app indefinitely.
 *   - **Status bar**: overlay the WebView (so content paints under it)
 *     with a dark style so the white system icons are legible against
 *     our dark gradient. Pairs with the `--safe-top` CSS var that the
 *     phone shell already consumes.
 *   - **Keyboard**: native resize so the WebView shrinks rather than
 *     pushing the bottom tab bar offscreen.
 *   - **Hardware back button**: pop history (which our PhoneEditorShell
 *     uses to switch tabs), and on the root tab fall back to the OS
 *     default exit-app behaviour. Without registering a listener, the
 *     hardware back button always tries to pop the WebView's location
 *     history — fine for nav between routes, wrong for in-page tabs.
 */

let bootstrapped = false;

export async function runCapacitorBootstrap(): Promise<void> {
	if (bootstrapped) return;
	bootstrapped = true;
	if (typeof window === "undefined") return;

	const { Capacitor } = await import("@capacitor/core");
	if (!Capacitor.isNativePlatform()) return;

	// Splash — hide once we're rendered. The `fadeOutDuration` here is
	// a hint to the plugin; the actual perceived flash is mostly
	// governed by hydration time.
	try {
		const { SplashScreen } = await import("@capacitor/splash-screen");
		await SplashScreen.hide({ fadeOutDuration: 200 });
	} catch {
		// plugin missing or already hidden — non-fatal
	}

	// Status bar overlay + dark style
	try {
		const { StatusBar, Style } = await import("@capacitor/status-bar");
		await StatusBar.setOverlaysWebView({ overlay: true });
		await StatusBar.setStyle({ style: Style.Dark });
		await StatusBar.setBackgroundColor({ color: "#00000000" });
	} catch {
		// older devices may not implement every method; absorb errors
	}

	// Keyboard resize mode
	try {
		const { Keyboard, KeyboardResize } = await import("@capacitor/keyboard");
		await Keyboard.setResizeMode({ mode: KeyboardResize.Native });
	} catch {
		// non-fatal
	}

	// Hardware back button. On root (no history to pop) we follow the
	// OS convention of double-press-to-exit by exiting the app.
	try {
		const { App } = await import("@capacitor/app");
		await App.addListener("backButton", ({ canGoBack }) => {
			if (canGoBack) {
				window.history.back();
			} else {
				App.exitApp();
			}
		});
	} catch {
		// non-fatal
	}
}
