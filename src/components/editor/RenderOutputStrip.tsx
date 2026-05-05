"use client";

import { Download, Film, Play, X } from "lucide-react";
import { useState } from "react";
import { useRenderQueueStore } from "@/store/render-queue-store";

/**
 * Floating "completed renders" strip — anchors above the render queue
 * dock once at least one job is done/downloaded. Click a poster to
 * pop the in-app player. Click download to save. Auto-hides when the
 * list is empty.
 *
 * Lives in the layout (alongside the queue dock) so it's reachable
 * from any page including the dashboard. Designed to collapse to a
 * single tile when the user explicitly minimizes.
 */
export function RenderOutputStrip() {
	const items = useRenderQueueStore((s) => s.items);
	const [previewing, setPreviewing] = useState<string | null>(null);
	const [collapsed, setCollapsed] = useState(false);

	const completed = items.filter(
		(i) => (i.state === "done" || i.state === "downloaded") && i.outputUrl,
	);
	if (completed.length === 0) return null;

	const previewItem = previewing
		? completed.find((i) => i.jobId === previewing)
		: null;

	if (collapsed) {
		return (
			<button
				type="button"
				onClick={() => setCollapsed(false)}
				className="fixed bottom-20 right-4 z-40 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-neutral-900 border border-emerald-500/30 text-emerald-200 text-[11px] hover:bg-neutral-800 motion-pop"
			>
				<Film className="h-3 w-3" />
				{completed.length} render{completed.length === 1 ? "" : "s"}
			</button>
		);
	}

	return (
		<>
			<div className="fixed bottom-20 right-4 z-40 w-80 rounded-lg bg-neutral-900 border border-neutral-800 shadow-[0_8px_24px_rgba(0,0,0,0.45)] motion-slide-up">
				<div className="flex items-center justify-between px-3 py-2 border-b border-neutral-800">
					<div className="flex items-center gap-2">
						<Film className="h-3.5 w-3.5 text-emerald-300" />
						<span className="text-[11px] uppercase tracking-wider text-emerald-300 font-semibold">
							Recent renders
						</span>
						<span className="text-[10px] text-neutral-500">{completed.length}</span>
					</div>
					<button
						type="button"
						onClick={() => setCollapsed(true)}
						className="text-neutral-500 hover:text-white"
						title="Collapse"
					>
						<X className="h-3 w-3" />
					</button>
				</div>
				<div className="flex gap-1.5 overflow-x-auto p-2">
					{completed
						.slice()
						.reverse()
						.map((it) => (
							<div
								key={it.jobId}
								className="shrink-0 w-32 rounded-md border border-neutral-800 hover:border-emerald-500/50 overflow-hidden bg-neutral-950 transition-colors"
							>
								<button
									type="button"
									onClick={() => setPreviewing(it.jobId)}
									className="block w-full aspect-video bg-black flex items-center justify-center group"
								>
									{it.posterUrl ? (
										// Poster frames are written by the render pipeline.
										// biome-ignore lint/performance/noImgElement: blob URL, not next/image
										<img
											src={it.posterUrl}
											alt=""
											className="w-full h-full object-cover"
										/>
									) : (
										<Film className="h-6 w-6 text-neutral-700 group-hover:text-emerald-400" />
									)}
								</button>
								<div className="px-1.5 py-1 flex items-center gap-1">
									<span className="flex-1 truncate text-[10px] text-neutral-300">
										{it.projectName}
									</span>
									<button
										type="button"
										onClick={() => setPreviewing(it.jobId)}
										className="p-0.5 text-neutral-500 hover:text-emerald-300"
										title="Preview"
									>
										<Play className="h-2.5 w-2.5" />
									</button>
									{it.outputUrl ? (
										<a
											href={it.outputUrl}
											download={`${it.projectName}.mp4`}
											className="p-0.5 text-neutral-500 hover:text-emerald-300"
											title="Download"
										>
											<Download className="h-2.5 w-2.5" />
										</a>
									) : null}
								</div>
							</div>
						))}
				</div>
			</div>
			{previewItem?.outputUrl ? (
				<div
					role="dialog"
					aria-label={`Preview ${previewItem.projectName}`}
					onClick={() => setPreviewing(null)}
					onKeyDown={(e) => {
						if (e.key === "Escape") setPreviewing(null);
					}}
					className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 backdrop-blur-sm motion-fade p-6"
				>
					<div
						onClick={(e) => e.stopPropagation()}
						onKeyDown={(e) => e.stopPropagation()}
						className="relative max-w-4xl w-full rounded-xl overflow-hidden bg-black border border-neutral-700 motion-pop"
					>
						{/* biome-ignore lint/a11y/useMediaCaption: rendered output preview, no caption track */}
						<video
							src={previewItem.outputUrl}
							controls
							autoPlay
							className="w-full"
						/>
						<button
							type="button"
							onClick={() => setPreviewing(null)}
							className="absolute top-2 right-2 p-1.5 rounded bg-black/70 text-white hover:bg-black"
							title="Close"
						>
							<X className="h-4 w-4" />
						</button>
					</div>
				</div>
			) : null}
		</>
	);
}
