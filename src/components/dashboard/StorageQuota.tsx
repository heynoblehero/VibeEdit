"use client";

import { useEffect, useState } from "react";

/**
 * Tiny "Storage: X / 10 MB" line. Sums the byte length of every
 * vibeedit-* localStorage key once on mount + after each focus event
 * so writes from other tabs reflect.
 *
 * Surfaces silently — no alarm — until usage crosses 80% of the
 * conservative 10MB browser cap, at which point the bar tints amber.
 */
const SOFT_CAP_BYTES = 10 * 1024 * 1024;
const PREFIX = "vibeedit";

function measure(): number {
	if (typeof window === "undefined") return 0;
	let total = 0;
	for (let i = 0; i < localStorage.length; i++) {
		const k = localStorage.key(i);
		if (!k || !k.startsWith(PREFIX)) continue;
		const v = localStorage.getItem(k);
		if (!v) continue;
		// 2 bytes per UTF-16 code unit is the right approximation for
		// the storage budget; some browsers use UTF-8, but this stays
		// conservative either way.
		total += k.length * 2 + v.length * 2;
	}
	return total;
}

export function StorageQuota() {
	const [bytes, setBytes] = useState(0);

	useEffect(() => {
		const refresh = () => setBytes(measure());
		refresh();
		const onFocus = () => refresh();
		window.addEventListener("focus", onFocus);
		const id = window.setInterval(refresh, 30_000);
		return () => {
			window.removeEventListener("focus", onFocus);
			window.clearInterval(id);
		};
	}, []);

	const pct = Math.min(100, (bytes / SOFT_CAP_BYTES) * 100);
	const tone =
		pct > 90 ? "bg-red-500" : pct > 75 ? "bg-amber-400" : "bg-emerald-500";

	return (
		<div className="flex items-center gap-2 text-[10px] text-neutral-500 font-mono tabular-nums">
			<span>Storage</span>
			<div className="w-20 h-1 rounded-full bg-neutral-900 overflow-hidden">
				<div
					className={`h-full ${tone} transition-[width] duration-300`}
					style={{ width: `${pct}%` }}
				/>
			</div>
			<span>
				{(bytes / 1024 / 1024).toFixed(1)} / {(SOFT_CAP_BYTES / 1024 / 1024).toFixed(0)} MB
			</span>
		</div>
	);
}
