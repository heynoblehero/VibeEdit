// Tracks edit→reload latency client-side. Window of the last 20 samples per
// browser; localStorage-backed so the number is stable across sessions.
//
// The "edit" event is the user sending a chat message; the "reload" event is
// the SSE watcher firing (file changed). p50 + last are surfaced in the
// preview header to make the sub-3s budget visible.

const STORAGE_KEY = "vibeedit:preview-budget";
const WINDOW = 20;
const EDIT_AT = "vibeedit:edit-sent-at";

export function markEditSent() {
	if (typeof window === "undefined") return;
	try {
		sessionStorage.setItem(EDIT_AT, String(Date.now()));
	} catch {
		/* */
	}
}

export function recordReload(): number | null {
	if (typeof window === "undefined") return null;
	let editedAt: number | null = null;
	try {
		const raw = sessionStorage.getItem(EDIT_AT);
		if (raw) editedAt = Number(raw);
		sessionStorage.removeItem(EDIT_AT);
	} catch {
		/* */
	}
	if (!editedAt || !Number.isFinite(editedAt)) return null;
	const delta = Date.now() - editedAt;
	if (delta < 0 || delta > 120_000) return null;
	const samples = readSamples();
	samples.push(delta);
	while (samples.length > WINDOW) samples.shift();
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(samples));
	} catch {
		/* */
	}
	return delta;
}

export function readSamples(): number[] {
	if (typeof window === "undefined") return [];
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return [];
		const parsed = JSON.parse(raw) as unknown;
		if (!Array.isArray(parsed)) return [];
		return (parsed as unknown[]).filter(
			(n): n is number => typeof n === "number" && Number.isFinite(n),
		);
	} catch {
		return [];
	}
}

export function p50(samples: number[]): number | null {
	if (!samples.length) return null;
	const sorted = [...samples].sort((a, b) => a - b);
	return sorted[Math.floor(sorted.length / 2)];
}
