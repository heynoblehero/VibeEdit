"use client";

import { Check, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "@/lib/toast";
import { useProjectStore } from "@/store/project-store";

const FIRST_SAVE_KEY = "vibeedit-first-save-toast-shown";

/**
 * Subtle "Saved 2s ago" indicator next to the project name. The
 * project store stamps `updatedAt` on every mutation and persists
 * via Zustand's `persist` middleware to localStorage, so each
 * `updatedAt` advance corresponds to a save.
 *
 * We pulse a "Saved" state for a moment, then settle into a relative
 * timestamp that ticks once a minute. No network call needed —
 * persistence is local.
 */
export function AutoSaveIndicator() {
	const updatedAt = useProjectStore((s) => s.project.updatedAt);
	const [tick, setTick] = useState(0);
	const [showFlash, setShowFlash] = useState(false);
	const flashTimer = useRef<number | null>(null);
	const lastUpdatedAt = useRef<number | undefined>(updatedAt);

	useEffect(() => {
		// Skip the initial mount so we don't flash on every page load.
		if (lastUpdatedAt.current === undefined) {
			lastUpdatedAt.current = updatedAt;
			return;
		}
		if (updatedAt && updatedAt !== lastUpdatedAt.current) {
			lastUpdatedAt.current = updatedAt;
			setShowFlash(true);
			if (flashTimer.current) window.clearTimeout(flashTimer.current);
			flashTimer.current = window.setTimeout(() => setShowFlash(false), 1200);

			// First-time save toast: surface autosave once per browser so
			// new users learn that work persists without a save button.
			try {
				if (!localStorage.getItem(FIRST_SAVE_KEY)) {
					localStorage.setItem(FIRST_SAVE_KEY, "1");
					toast.success("Saved to your browser", {
						description:
							"Everything autosaves locally — no save button needed. Open the dashboard to see all projects.",
					});
				}
			} catch {
				// localStorage can throw in private modes; not fatal.
			}
		}
	}, [updatedAt]);

	useEffect(() => {
		// One-minute ticker so "X seconds ago" relative time updates.
		const id = window.setInterval(() => setTick((t) => t + 1), 30_000);
		return () => window.clearInterval(id);
	}, []);

	if (!updatedAt) {
		return null;
	}

	const seconds = Math.max(0, Math.floor((Date.now() - updatedAt) / 1000));
	const label = relativeLabel(seconds);

	return (
		<div className="hidden md:flex items-center gap-1 text-[10px] text-neutral-500 select-none transition-opacity duration-300">
			{showFlash ? (
				<>
					<Loader2 className="h-3 w-3 animate-spin text-emerald-400" />
					<span className="text-emerald-300">Saved</span>
				</>
			) : (
				<>
					<Check className="h-3 w-3 text-neutral-600" />
					<span>{label}</span>
				</>
			)}
			{/* Read tick to keep React rendering on interval */}
			<span className="hidden">{tick}</span>
		</div>
	);
}

function relativeLabel(seconds: number): string {
	if (seconds < 5) return "Saved just now";
	if (seconds < 60) return `Saved ${seconds}s ago`;
	const minutes = Math.floor(seconds / 60);
	if (minutes < 60) return `Saved ${minutes}m ago`;
	const hours = Math.floor(minutes / 60);
	return `Saved ${hours}h ago`;
}
