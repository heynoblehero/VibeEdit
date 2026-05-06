"use client";

import { Download, Share2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { RenderButton } from "@/components/editor/RenderButton";
import { useProjectStore } from "@/store/project-store";
import { useRenderQueueStore } from "@/store/render-queue-store";
import { toast } from "@/lib/toast";

/**
 * Phone tab #3 — render queue + recents + share.
 *
 * The desktop UI already has `RenderQueuePanel` (collapsed pill) +
 * `RenderOutputStrip` (recent renders dock) mounted in the root
 * layout, so they float above this tab too. Here we surface them
 * inline plus a big primary Render CTA so the user doesn't have to
 * fish for the tiny header button on phone.
 *
 * Native share comes in Phase 3 via `@capacitor/share`. Today we
 * fall back to `navigator.share()` (works in modern Android WebView)
 * with a download link if neither is available.
 */
export function PhoneRenderTab() {
	const items = useRenderQueueStore((s) => s.items);
	const project = useProjectStore((s) => s.project);
	const sceneCount = project.scenes.length;
	const finished = items.filter((i) => i.state === "done" || i.state === "downloaded");

	const onShare = async (item: (typeof items)[number]) => {
		if (!item.outputUrl) {
			toast.info("Render still finishing — try again in a moment");
			return;
		}
		const title = project.name || "VibeEdit render";
		// Prefer the native @capacitor/share plugin when running inside
		// the APK — it surfaces the system share sheet with WhatsApp /
		// Drive / Photos as targets instead of just URL-sharing apps.
		try {
			const { Capacitor } = await import("@capacitor/core");
			if (Capacitor.isNativePlatform()) {
				const { Share } = await import("@capacitor/share");
				await Share.share({ title, url: item.outputUrl, dialogTitle: "Share render" });
				return;
			}
		} catch {
			// fall through to web share
		}
		try {
			if (typeof navigator.share === "function") {
				await navigator.share({ title, url: item.outputUrl });
				return;
			}
		} catch {
			// user cancelled — fall through to download
		}
		// Last resort: open in a new tab so the OS download manager
		// picks it up.
		window.open(item.outputUrl, "_blank");
	};

	return (
		<div className="flex-1 overflow-y-auto p-4 space-y-5">
			<section>
				<div className="text-[10px] uppercase tracking-wider text-emerald-300 font-semibold mb-2">
					Render this video
				</div>
				<div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-3">
					<div className="text-[12px] text-neutral-300">
						{sceneCount === 0
							? "Add a scene before rendering."
							: `Ready to render ${sceneCount} scene${sceneCount === 1 ? "" : "s"}.`}
					</div>
					<div className="flex">
						{/* Reuse the desktop RenderButton — full-width on phone */}
						<div className="flex-1 [&_button]:!flex-1 [&_button]:!justify-center">
							<RenderButton />
						</div>
					</div>
				</div>
			</section>

			<section>
				<div className="text-[10px] uppercase tracking-wider text-neutral-400 font-semibold mb-2">
					In progress · {items.filter((i) => i.state === "rendering" || i.state === "queued").length}
				</div>
				{items.length === 0 ? (
					<div className="text-[12px] text-neutral-600 px-1 py-2">
						No active renders.
					</div>
				) : (
					<div className="space-y-1.5">
						{items.map((item) => {
							const pct = Math.round((item.progress ?? 0) * 100);
							return (
								<div
									key={item.jobId}
									className="rounded border border-neutral-800 bg-neutral-900/50 p-3"
								>
									<div className="flex items-center justify-between gap-2">
										<span className="text-[12px] text-white truncate flex-1">
											{item.projectName}
										</span>
										<span className="text-[10px] text-neutral-500 font-mono uppercase">
											{item.state}
										</span>
									</div>
									{item.state === "rendering" && (
										<div className="mt-2 h-1 w-full bg-neutral-900 rounded overflow-hidden">
											<div
												className="h-full bg-emerald-500 transition-[width] duration-300"
												style={{ width: `${pct}%` }}
											/>
										</div>
									)}
								</div>
							);
						})}
					</div>
				)}
			</section>

			<section>
				<div className="text-[10px] uppercase tracking-wider text-neutral-400 font-semibold mb-2">
					Ready to share · {finished.length}
				</div>
				{finished.length === 0 ? (
					<div className="text-[12px] text-neutral-600 px-1 py-2">
						Finished renders show up here.
					</div>
				) : (
					<div className="space-y-3">
						{finished.map((item) => (
							<div
								key={item.jobId}
								className="rounded-lg border border-emerald-500/30 bg-neutral-900/50 overflow-hidden"
							>
								{/* Inline preview so the user actually sees what
								    they made before deciding to share / save. */}
								{item.outputUrl ? (
									<video
										src={item.outputUrl}
										className="w-full bg-black aspect-video"
										controls
										playsInline
										preload="metadata"
									/>
								) : null}
								<div className="p-3 flex items-center gap-2">
									<div className="flex-1 min-w-0">
										<div className="text-[12px] text-white truncate">
											{item.projectName}
										</div>
										<div className="text-[10px] text-neutral-500">
											{item.sizeBytes
												? `${(item.sizeBytes / 1024 / 1024).toFixed(1)} MB · ${item.presetId}`
												: item.presetId}
										</div>
									</div>
									<Button
										size="sm"
										variant="primary"
										leadingIcon={<Share2 className="h-3.5 w-3.5" />}
										onClick={() => onShare(item)}
									>
										Share
									</Button>
									{item.outputUrl ? (
										<a
											href={item.outputUrl}
											download
											target="_blank"
											rel="noreferrer"
											className="p-2 rounded text-neutral-300 hover:text-white hover:bg-neutral-800"
											title="Download"
										>
											<Download className="h-4 w-4" />
										</a>
									) : null}
								</div>
							</div>
						))}
					</div>
				)}
			</section>
		</div>
	);
}
