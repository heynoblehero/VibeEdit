"use client";

import { Upload } from "lucide-react";
import { useEffect, useState } from "react";

/**
 * Global drop-zone HINT only — purely visual confirmation that the
 * editor can accept files. The actual file handling is owned by
 * surface-specific components (Timeline drop, ProjectDropImport,
 * AssetLibraryPanel) so they keep type-specific routing rules. This
 * component just shows a soft overlay when a drag enters the window
 * so users know dropping is supported and don't bounce off.
 *
 * If a child component handles the drop, the overlay clears via the
 * `dragleave` / `drop` listeners.
 */
export function GlobalDropHint() {
	const [active, setActive] = useState(false);
	const [counter, setCounter] = useState(0);

	useEffect(() => {
		const onEnter = (e: DragEvent) => {
			if (!e.dataTransfer?.types.includes("Files")) return;
			setCounter((c) => {
				const next = c + 1;
				if (next > 0) setActive(true);
				return next;
			});
		};
		const onLeave = () => {
			setCounter((c) => {
				const next = Math.max(0, c - 1);
				if (next === 0) setActive(false);
				return next;
			});
		};
		const onDrop = () => {
			setCounter(0);
			setActive(false);
		};
		const onOver = (e: DragEvent) => {
			if (e.dataTransfer?.types.includes("Files")) {
				e.preventDefault();
			}
		};
		window.addEventListener("dragenter", onEnter);
		window.addEventListener("dragleave", onLeave);
		window.addEventListener("dragover", onOver);
		window.addEventListener("drop", onDrop);
		return () => {
			window.removeEventListener("dragenter", onEnter);
			window.removeEventListener("dragleave", onLeave);
			window.removeEventListener("dragover", onOver);
			window.removeEventListener("drop", onDrop);
		};
	}, []);

	if (!active) return null;
	return (
		<div className="pointer-events-none fixed inset-0 z-[90] flex items-center justify-center bg-emerald-500/5 border-4 border-dashed border-emerald-400/40 motion-fade">
			<div className="flex items-center gap-3 px-5 py-3 rounded-xl bg-neutral-900/90 border border-emerald-400/40 text-emerald-200 shadow-[0_24px_60px_rgba(0,0,0,0.65)]">
				<Upload className="h-5 w-5" />
				<span className="text-[14px] font-semibold">
					Drop to add — media files land in the timeline, .vibeedit.json files
					import as a new project
				</span>
			</div>
		</div>
	);
}
