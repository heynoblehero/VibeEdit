"use client";

import { Sparkles, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { CHANGELOG, CURRENT_VERSION } from "@/lib/changelog";

const STORAGE_KEY = "vibeedit-last-seen-changelog";

/**
 * Auto-pops the latest changelog entry once per CURRENT_VERSION bump.
 * The user can dismiss with × or "Got it"; either records the version
 * to localStorage so the modal stays quiet until the next release.
 *
 * Mounted in the root layout — runs on every page so the user sees it
 * regardless of where they land.
 */
export function WhatsNewModal() {
	const [open, setOpen] = useState(false);

	useEffect(() => {
		try {
			const seen = localStorage.getItem(STORAGE_KEY);
			// First-ever visit doesn't pop the modal — only show on
			// subsequent versions so we don't ambush brand-new users.
			if (seen === null) {
				localStorage.setItem(STORAGE_KEY, CURRENT_VERSION);
				return;
			}
			if (seen !== CURRENT_VERSION) {
				setOpen(true);
			}
		} catch {
			// localStorage unavailable (private mode etc.) — silently skip
		}
	}, []);

	const dismiss = () => {
		try {
			localStorage.setItem(STORAGE_KEY, CURRENT_VERSION);
		} catch {
			// ignored
		}
		setOpen(false);
	};

	if (!open) return null;
	const entry = CHANGELOG[0];
	if (!entry) return null;

	return (
		<div
			className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm motion-fade"
			onClick={dismiss}
			onKeyDown={(e) => {
				if (e.key === "Escape") dismiss();
			}}
			role="dialog"
			aria-modal="true"
			aria-labelledby="whats-new-title"
		>
			<div
				className="relative w-full max-w-md mx-4 rounded-xl border border-emerald-500/30 bg-neutral-950 shadow-2xl motion-pop"
				onClick={(e) => e.stopPropagation()}
				onKeyDown={(e) => e.stopPropagation()}
				role="document"
			>
				<button
					type="button"
					onClick={dismiss}
					className="absolute top-3 right-3 p-1 rounded text-neutral-500 hover:text-white"
					title="Dismiss"
				>
					<X className="h-4 w-4" />
				</button>
				<div className="p-6 space-y-4">
					<div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-emerald-300 font-semibold">
						<Sparkles className="h-3.5 w-3.5" />
						What's new
						<span className="font-mono text-emerald-300/60">
							v{entry.version}
						</span>
					</div>
					<h2
						id="whats-new-title"
						className="text-xl font-semibold text-white leading-tight"
					>
						{entry.title}
					</h2>
					<ul className="list-disc list-outside pl-5 space-y-1.5 text-[13px] text-neutral-300 leading-relaxed">
						{entry.highlights.slice(0, 4).map((h) => (
							<li key={h}>{h}</li>
						))}
					</ul>
					<div className="flex items-center justify-between pt-2">
						<Link
							href="/changelog"
							onClick={dismiss}
							className="text-[12px] text-emerald-300 hover:text-emerald-200"
						>
							Full changelog →
						</Link>
						<button
							type="button"
							onClick={dismiss}
							className="px-4 py-1.5 rounded-md bg-emerald-500 text-black text-[12px] font-semibold hover:bg-emerald-400"
						>
							Got it
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}
