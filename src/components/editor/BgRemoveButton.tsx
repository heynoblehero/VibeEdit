"use client";

import { Loader2, Sparkles, Undo2 } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { useProjectStore } from "@/store/project-store";

/**
 * Run @imgly/background-removal on a single image URL fully in the
 * browser (WASM model, ~30MB cached after first run). No external API,
 * no key — keeps VibeEdit's privacy story intact.
 *
 * Stores the URL of the previous image so a single "Undo" press
 * restores it. Result is uploaded through the existing /api/assets/upload
 * pipeline so it persists alongside other project assets.
 */

interface Props {
	imageUrl: string;
	/** Previous (pre-removal) URL so we can offer Undo. */
	originalUrl?: string;
	/** Called with the new URL (replaces imageUrl). */
	onReplace: (nextUrl: string, originalUrl: string | undefined) => void;
}

export function BgRemoveButton({ imageUrl, originalUrl, onReplace }: Props) {
	const [busy, setBusy] = useState(false);
	const addUpload = useProjectStore((s) => s.addUpload);
	const lastResultRef = useRef<string | null>(null);

	const run = async () => {
		if (busy) return;
		setBusy(true);
		try {
			const { removeBackground } = await import("@imgly/background-removal");
			const blob = await removeBackground(imageUrl);
			lastResultRef.current = URL.createObjectURL(blob);

			const file = new File([blob], `bg-removed-${Date.now()}.png`, { type: "image/png" });
			const { uploadFiles } = await import("@/lib/upload-files");
			const results = await uploadFiles([file], addUpload);
			const next = results[0]?.upload.url;
			if (!next) {
				toast.error("Upload failed");
				return;
			}
			onReplace(next, originalUrl ?? imageUrl);
			toast.success("Background removed");
		} catch (err) {
			console.error("bg removal failed", err);
			toast.error("Background removal failed");
		} finally {
			setBusy(false);
		}
	};

	const undo = () => {
		if (!originalUrl) return;
		onReplace(originalUrl, undefined);
	};

	return (
		<div className="flex items-center gap-1.5">
			<button
				type="button"
				onClick={run}
				disabled={busy}
				className={`flex items-center gap-1.5 text-[11px] px-2 py-1 rounded border transition-colors ${
					busy
						? "border-purple-500/50 text-purple-300 bg-purple-500/10 cursor-wait"
						: "border-neutral-700 text-neutral-300 hover:text-purple-300 hover:border-purple-500"
				}`}
				title="Remove background — runs locally in your browser"
			>
				{busy ? (
					<>
						<Loader2 className="h-3 w-3 animate-spin" /> Removing…
					</>
				) : (
					<>
						<Sparkles className="h-3 w-3" /> Remove BG
					</>
				)}
			</button>
			{originalUrl && !busy && (
				<button
					type="button"
					onClick={undo}
					className="flex items-center gap-1 text-[11px] px-2 py-1 rounded border border-neutral-700 text-neutral-400 hover:text-white hover:border-neutral-500"
					title="Restore original image"
				>
					<Undo2 className="h-3 w-3" /> Undo
				</button>
			)}
		</div>
	);
}
