"use client";

import { Film, Image as ImageIcon, Music, Sparkles } from "lucide-react";
import { useProjectStore } from "@/store/project-store";
import { useWorkspaceStore, type WorkspaceTab } from "@/store/workspace-store";

/**
 * Top-level [Video][Audio] pill, sits in the header. Green for video,
 * orange/amber for audio so users feel which mode they're in. Pressing
 * a tab updates `useWorkspaceStore` for the active project; the
 * ProjectShell branches on the value.
 */
export function WorkspaceTabs() {
	const projectId = useProjectStore((s) => s.project.id);
	const tab = useWorkspaceStore((s) => s.activeTabs[projectId] ?? "video");
	const setTab = useWorkspaceStore((s) => s.setTab);

	const pick = (next: WorkspaceTab) => {
		setTab(projectId, next);
		// Mirror the choice in the URL so a reload + share round-trips.
		try {
			const url = new URL(window.location.href);
			url.searchParams.set("tab", next);
			window.history.replaceState(null, "", url);
		} catch {}
	};

	return (
		<div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-neutral-950 border border-neutral-800">
			<button
				type="button"
				onClick={() => pick("video")}
				aria-pressed={tab === "video"}
				className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
					tab === "video"
						? "bg-emerald-500/20 text-emerald-200 ring-1 ring-emerald-500/40"
						: "text-neutral-400 hover:text-white"
				}`}
			>
				<Film className="h-3.5 w-3.5" />
				Video
			</button>
			<button
				type="button"
				onClick={() => pick("audio")}
				aria-pressed={tab === "audio"}
				className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
					tab === "audio"
						? "bg-orange-500/20 text-orange-200 ring-1 ring-orange-500/40"
						: "text-neutral-400 hover:text-white"
				}`}
			>
				<Music className="h-3.5 w-3.5" />
				Audio
			</button>
			<button
				type="button"
				onClick={() => pick("animate")}
				aria-pressed={tab === "animate"}
				className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
					tab === "animate"
						? "bg-fuchsia-500/20 text-fuchsia-200 ring-1 ring-fuchsia-500/40"
						: "text-neutral-400 hover:text-white"
				}`}
			>
				<Sparkles className="h-3.5 w-3.5" />
				Animate
			</button>
			<button
				type="button"
				onClick={() => pick("image")}
				aria-pressed={tab === "image"}
				className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
					tab === "image"
						? "bg-sky-500/20 text-sky-200 ring-1 ring-sky-500/40"
						: "text-neutral-400 hover:text-white"
				}`}
			>
				<ImageIcon className="h-3.5 w-3.5" />
				Image
			</button>
		</div>
	);
}
