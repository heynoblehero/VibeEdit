// VibeEdit service worker — minimal offline shell for the wrapped
// Android Capacitor build. Two strategies:
//
//   1. App shell (HTML / JS / CSS): cache-first with network fallback.
//      Lets the editor open with no network long enough for the user
//      to see "you're offline" UI instead of Chrome's dino.
//
//   2. API + dynamic content (/api/*, render artifacts, model lists):
//      network-only. Editor work needs fresh data; serving a stale
//      render-job status would be worse than failing loudly.
//
// Bump CACHE_VERSION when shipping breaking shell changes; old caches
// are pruned on activate.

const CACHE_VERSION = "vibeedit-v1";
const SHELL_PATHS = ["/", "/dashboard", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
	event.waitUntil(
		caches.open(CACHE_VERSION).then((cache) => cache.addAll(SHELL_PATHS).catch(() => {})),
	);
	self.skipWaiting();
});

self.addEventListener("activate", (event) => {
	event.waitUntil(
		caches.keys().then((keys) =>
			Promise.all(
				keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)),
			),
		),
	);
	self.clients.claim();
});

self.addEventListener("fetch", (event) => {
	const req = event.request;
	if (req.method !== "GET") return;

	const url = new URL(req.url);

	// Never cache API or dynamic media — render jobs, model lists,
	// auth probes must be fresh.
	if (
		url.pathname.startsWith("/api/") ||
		url.pathname.startsWith("/uploads/") ||
		url.pathname.startsWith("/voiceovers/") ||
		url.pathname.startsWith("/ai-images/")
	) {
		return;
	}

	event.respondWith(
		caches.match(req).then((cached) => {
			if (cached) return cached;
			return fetch(req)
				.then((res) => {
					// Only cache successful, basic-origin responses to avoid
					// poisoning the cache with opaque CORS errors.
					if (res.ok && res.type === "basic") {
						const clone = res.clone();
						caches.open(CACHE_VERSION).then((c) => c.put(req, clone)).catch(() => {});
					}
					return res;
				})
				.catch(() => caches.match("/"));
		}),
	);
});
