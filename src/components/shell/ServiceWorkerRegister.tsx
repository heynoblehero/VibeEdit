"use client";

import { useEffect } from "react";

/**
 * Registers /sw.js so the wrapped Capacitor APK (and any phone Chrome
 * user that installed the PWA) keeps a small offline shell. Skipped
 * in dev because the dev bundle is too volatile to cache and stale
 * shell would mask bugs.
 */
export function ServiceWorkerRegister() {
	useEffect(() => {
		if (process.env.NODE_ENV !== "production") return;
		if (typeof navigator === "undefined" || !("serviceWorker" in navigator))
			return;
		navigator.serviceWorker.register("/sw.js").catch((err) => {
			console.warn("[sw] registration failed", err);
		});
	}, []);
	return null;
}
