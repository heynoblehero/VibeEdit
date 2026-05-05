"use client";

import { Library, Music, Trash2, Wand2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useAssetLibraryStore } from "@/store/asset-library-store";
import { useProjectStore } from "@/store/project-store";

/**
 * Cross-project audio library. Reads `useAssetLibraryStore` (kinds:
 * "music" | "sfx") and lets the user drop a saved clip onto the
 * project SFX lane (free-floating clip) or set it as the project's
 * music bed.
 *
 * Persistence flows through the asset-storage adapter, so swapping in
 * a Drizzle/SQLite backend later is one wire change.
 */
export function AudioLibraryPanel() {
	const assets = useAssetLibraryStore((s) => s.assets);
	const removeAsset = useAssetLibraryStore((s) => s.remove);
	const addSfxClip = useProjectStore((s) => s.addSfxClip);
	const setMusic = useProjectStore((s) => s.setMusic);
	const project = useProjectStore((s) => s.project);

	const [filter, setFilter] = useState<"all" | "music" | "sfx">("all");
	const [search, setSearch] = useState("");

	const audioAssets = useMemo(
		() =>
			assets.filter(
				(a) =>
					(a.kind === "music" || a.kind === "sfx") &&
					(filter === "all" || a.kind === filter) &&
					(!search.trim() ||
						a.name.toLowerCase().includes(search.toLowerCase()) ||
						a.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()))),
			),
		[assets, filter, search],
	);

	const dropAsSfx = async (asset: (typeof assets)[number]) => {
		const fps = project.fps;
		const dur = await measureDuration(asset.url).catch(() => 3);
		addSfxClip({
			id: `sfx_${Math.random().toString(36).slice(2, 10)}`,
			url: asset.url,
			name: asset.name,
			startFrame: 0,
			durationFrames: Math.max(1, Math.round(dur * fps)),
			gain: 1,
		});
	};

	const setAsMusic = (asset: (typeof assets)[number]) => {
		setMusic({
			url: asset.url,
			name: asset.name,
			volume: project.music?.volume ?? 0.55,
			duckedVolume: project.music?.duckedVolume ?? 0.18,
		});
	};

	return (
		<div className="rounded-md border border-orange-500/30 bg-neutral-950/60 p-3 space-y-3">
			<div className="flex items-center gap-2">
				<Library className="h-3.5 w-3.5 text-orange-300" />
				<span className="text-[11px] uppercase tracking-wider text-orange-300 font-semibold">
					Saved audio
				</span>
			</div>
			<input
				type="text"
				value={search}
				onChange={(e) => setSearch(e.target.value)}
				placeholder="Search by name or tag…"
				className="w-full px-2 py-1 text-[11px] rounded bg-neutral-950 border border-neutral-800 text-neutral-200 focus:outline-none focus:border-orange-500/60"
			/>
			<div className="flex gap-0.5 p-0.5 rounded bg-neutral-950 border border-neutral-800">
				{(["all", "music", "sfx"] as const).map((k) => (
					<button
						key={k}
						type="button"
						onClick={() => setFilter(k)}
						className={`flex-1 py-1 rounded text-[10px] uppercase tracking-wider ${
							filter === k
								? "bg-orange-500/20 text-orange-200"
								: "text-neutral-500 hover:text-white"
						}`}
					>
						{k}
					</button>
				))}
			</div>
			{audioAssets.length === 0 ? (
				<div className="rounded-md border border-dashed border-neutral-800 p-4 text-center space-y-1.5">
					<div className="text-[11px] text-neutral-400">No saved audio yet.</div>
					<div className="text-[10px] text-neutral-500 leading-relaxed">
						Select a clip on the timeline and click &ldquo;Save to library&rdquo; in
						the inspector to build up reusable audio across projects.
					</div>
				</div>
			) : (
				<div className="space-y-1.5">
					{audioAssets.map((asset) => (
						<div
							key={asset.id}
							className="rounded border border-neutral-800 bg-neutral-925 p-2 space-y-1.5"
						>
							<div className="flex items-start justify-between gap-2">
								<div className="min-w-0 flex-1">
									<div className="text-[11px] text-neutral-200 truncate">{asset.name}</div>
									<div className="text-[10px] text-neutral-500 flex items-center gap-1.5">
										<span className="uppercase tracking-wider">{asset.kind}</span>
										{asset.tags.length > 0 ? <span>· {asset.tags.join(", ")}</span> : null}
									</div>
								</div>
								<button
									type="button"
									onClick={() => removeAsset(asset.id)}
									className="text-neutral-600 hover:text-red-300 shrink-0"
									title="Remove from library"
								>
									<Trash2 className="h-3 w-3" />
								</button>
							</div>
							<audio src={asset.url} controls className="w-full h-7" />
							<div className="flex gap-1.5">
								<button
									type="button"
									onClick={() => dropAsSfx(asset)}
									className="flex-1 flex items-center justify-center gap-1 py-1 rounded bg-orange-500/20 hover:bg-orange-500/30 text-orange-200 text-[10px]"
								>
									<Wand2 className="h-3 w-3" />
									Drop on SFX
								</button>
								{asset.kind === "music" ? (
									<button
										type="button"
										onClick={() => setAsMusic(asset)}
										className="flex-1 flex items-center justify-center gap-1 py-1 rounded bg-orange-500/20 hover:bg-orange-500/30 text-orange-200 text-[10px]"
									>
										<Music className="h-3 w-3" />
										Use as music
									</button>
								) : null}
							</div>
						</div>
					))}
				</div>
			)}
		</div>
	);
}

function measureDuration(url: string): Promise<number> {
	return new Promise((resolve, reject) => {
		const audio = new Audio();
		audio.preload = "metadata";
		audio.onloadedmetadata = () => resolve(audio.duration || 0);
		audio.onerror = () => reject(new Error("metadata load failed"));
		audio.src = url;
	});
}
