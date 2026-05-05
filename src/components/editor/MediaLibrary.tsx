"use client";

import {
	Grid,
	SearchBar,
	SearchContext,
	SearchContextManager,
} from "@giphy/react-components";
import type { IGif } from "@giphy/js-types";
import {
	ExternalLink,
	Image as ImageIcon,
	Library,
	Loader2,
	Music,
	Pause,
	Play,
	Search,
	Smile,
	Sparkles,
	Type,
	Upload,
	Video,
} from "lucide-react";
import { useContext, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { EMOJI_CATEGORIES } from "@/lib/emoji-set";
import {
	LICENSE_LABEL,
	MUSIC_MOODS,
	MUSIC_TRACKS,
	type MusicTrack,
} from "@/lib/music-library";
import { defaultPlaceholderTextItem, type Scene, type TextItem } from "@/lib/scene-schema";
import { useProjectStore } from "@/store/project-store";
import { PropertyModal } from "./PropertyModal";

/**
 * Unified media library — emoji, GIFs, music, and quick-attach uploads.
 * Surfaces every "drop something into the scene" path in one modal so
 * non-editors don't hunt across panels. Each tab is intentionally small
 * — this is a first cut; expand as users tell us which tab they live in.
 *
 * GIF tab uses GIPHY's developer API; key comes from
 * NEXT_PUBLIC_GIPHY_API_KEY. When unset, the tab degrades to an
 * instructions card so the modal still ships without a configured key.
 */

type Tab = "emoji" | "gifs" | "music" | "upload";

interface Props {
	open: boolean;
	onClose: () => void;
}

export function MediaLibrary({ open, onClose }: Props) {
	const [tab, setTab] = useState<Tab>("emoji");
	const project = useProjectStore((s) => s.project);
	const selectedSceneId = useProjectStore((s) => s.selectedSceneId);
	const updateScene = useProjectStore((s) => s.updateScene);
	const setMusic = useProjectStore((s) => s.setMusic);

	const targetScene: Scene | undefined =
		project.scenes.find((s) => s.id === selectedSceneId) ?? project.scenes[0];

	const requireScene = (): Scene | null => {
		if (!targetScene) {
			toast.error("Select a scene first");
			return null;
		}
		return targetScene;
	};

	const addEmoji = (char: string) => {
		const scene = requireScene();
		if (!scene) return;
		const baseline = defaultPlaceholderTextItem({
			content: char,
			x: project.width / 2 - 80,
			y: project.height / 2 - 80,
			fontSize: 160,
		});
		const item: TextItem = { ...baseline, content: char };
		updateScene(scene.id, { textItems: [...(scene.textItems ?? []), item] });
		toast.success(`Added ${char}`);
		onClose();
	};

	const addGif = (mp4Url: string | undefined, gifUrl: string, name: string) => {
		const scene = requireScene();
		if (!scene) return;
		// Prefer mp4 since OffthreadVideo loops cleanly; .gif falls through
		// as an image (browser animates, Remotion render is static frame 1).
		if (mp4Url) {
			updateScene(scene.id, {
				background: {
					...scene.background,
					videoUrl: mp4Url,
					videoMuted: true,
					videoLoop: true,
					imageUrl: undefined,
				},
			});
		} else {
			updateScene(scene.id, {
				background: { ...scene.background, imageUrl: gifUrl, videoUrl: undefined },
			});
		}
		toast.success(`Set "${name}" as background`);
		onClose();
	};

	const setBgMusic = (url: string, name: string) => {
		setMusic({ url, name, volume: 0.4, duckedVolume: 0.1 });
		toast.success(`Music: ${name}`);
		onClose();
	};

	return (
		<PropertyModal
			open={open}
			onClose={onClose}
			title="Media library"
			subtitle="Emoji · GIFs · Music · Uploads"
			accent="purple"
			width="huge"
		>
			<div className="flex flex-col gap-3 min-h-[420px]">
				<div className="flex gap-1 p-0.5 rounded-md bg-neutral-950 border border-neutral-800">
					{(
						[
							["emoji", "Emoji", Smile],
							["gifs", "GIFs", Sparkles],
							["music", "Music", Music],
							["upload", "Uploads", Upload],
						] as const
					).map(([id, label, Icon]) => (
						<button
							key={id}
							type="button"
							onClick={() => setTab(id)}
							className={`flex-1 flex items-center justify-center gap-1.5 text-[11px] px-2 py-1.5 rounded transition-colors ${
								tab === id
									? "bg-purple-500/15 text-purple-200"
									: "text-neutral-500 hover:text-white"
							}`}
						>
							<Icon className="h-3.5 w-3.5" />
							{label}
						</button>
					))}
				</div>

				{tab === "emoji" && <EmojiTab onPick={addEmoji} />}
				{tab === "gifs" && <GifTab onPick={addGif} />}
				{tab === "music" && <MusicTab currentMusic={project.music} onPick={setBgMusic} />}
				{tab === "upload" && <UploadTab />}

				{!targetScene && (
					<div className="text-[10px] text-amber-300/80 bg-amber-500/10 border border-amber-500/30 rounded px-2 py-1.5">
						Select a scene first — picks attach to the active scene.
					</div>
				)}
			</div>
		</PropertyModal>
	);
}

/* ─────────────────────────── Emoji tab ─────────────────────────── */

function EmojiTab({ onPick }: { onPick: (char: string) => void }) {
	const [query, setQuery] = useState("");
	const filtered = query.trim()
		? EMOJI_CATEGORIES.map((cat) => ({
				...cat,
				entries: cat.entries.filter((e) =>
					(e.keywords + " " + e.char).toLowerCase().includes(query.toLowerCase()),
				),
			})).filter((cat) => cat.entries.length > 0)
		: EMOJI_CATEGORIES;

	return (
		<div className="space-y-3">
			<div className="relative">
				<Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-neutral-500" />
				<input
					type="search"
					value={query}
					onChange={(e) => setQuery(e.target.value)}
					placeholder="Search emoji…"
					className="w-full text-xs pl-7 pr-2 py-1.5 rounded bg-neutral-950 border border-neutral-800 text-neutral-200 focus:border-purple-400 focus:outline-none"
				/>
			</div>
			{filtered.map((cat) => (
				<div key={cat.id}>
					<div className="text-[9px] uppercase tracking-wider text-neutral-500 mb-1">
						{cat.label}
					</div>
					<div className="grid grid-cols-8 sm:grid-cols-10 lg:grid-cols-14 gap-1">
						{cat.entries.map((e) => (
							<button
								key={`${cat.id}-${e.char}`}
								type="button"
								onClick={() => onPick(e.char)}
								className="aspect-square text-2xl rounded-md bg-neutral-900 hover:bg-purple-500/20 hover:scale-110 transition-all border border-transparent hover:border-purple-400/40"
								title={e.keywords}
							>
								{e.char}
							</button>
						))}
					</div>
				</div>
			))}
		</div>
	);
}

/* ─────────────────────────── GIFs tab ─────────────────────────── */

function GifTab({
	onPick,
}: {
	onPick: (mp4Url: string | undefined, gifUrl: string, name: string) => void;
}) {
	const apiKey = process.env.NEXT_PUBLIC_GIPHY_API_KEY;

	if (!apiKey) {
		return (
			<div className="rounded-md border border-purple-500/30 bg-purple-500/5 p-4 space-y-2">
				<div className="text-[12px] font-semibold text-purple-200">
					GIPHY API key needed
				</div>
				<div className="text-[11px] text-neutral-300 leading-relaxed">
					Add <code className="px-1 bg-neutral-950 rounded">NEXT_PUBLIC_GIPHY_API_KEY</code>{" "}
					to your <code className="px-1 bg-neutral-950 rounded">.env.local</code> and
					restart dev. Free key:{" "}
					<a
						href="https://developers.giphy.com/dashboard/"
						target="_blank"
						rel="noopener noreferrer"
						className="text-purple-300 underline"
					>
						developers.giphy.com/dashboard
					</a>
					. Until then, drop GIFs through the Uploads tab.
				</div>
			</div>
		);
	}

	return (
		<SearchContextManager apiKey={apiKey} options={{ rating: "pg-13" }}>
			<GifSearchExperience onPick={onPick} />
		</SearchContextManager>
	);
}

/**
 * Inner half of the GIF tab — has to live inside SearchContextManager
 * to call useContext(SearchContext). Owns the resize observer so the
 * Grid component (which requires an explicit pixel width) re-flows
 * cleanly when the modal width changes.
 */
function GifSearchExperience({
	onPick,
}: {
	onPick: (mp4Url: string | undefined, gifUrl: string, name: string) => void;
}) {
	const { fetchGifs, searchKey } = useContext(SearchContext);
	const containerRef = useRef<HTMLDivElement | null>(null);
	const [width, setWidth] = useState(720);

	useEffect(() => {
		const el = containerRef.current;
		if (!el) return;
		const measure = () => setWidth(el.clientWidth);
		measure();
		const obs = new ResizeObserver(measure);
		obs.observe(el);
		return () => obs.disconnect();
	}, []);

	const handleClick = (gif: IGif, e: React.SyntheticEvent<HTMLElement, Event>) => {
		e.preventDefault();
		// Prefer the highest-resolution mp4 GIPHY ships with the gif so the
		// bg video isn't a 200px-tall thumbnail scaled to fill 1080x1920.
		// Order: original_mp4 (when present) → original.mp4 → looping →
		// fixed_height fallback as a last resort.
		const imgs = gif.images as IGif["images"] & {
			original_mp4?: { mp4?: string };
			looping?: { mp4?: string };
		};
		const mp4 =
			imgs.original_mp4?.mp4 ??
			imgs.original?.mp4 ??
			imgs.looping?.mp4 ??
			imgs.fixed_height?.mp4;
		const gifUrl = imgs.original?.url ?? imgs.fixed_height?.url ?? "";
		onPick(mp4, gifUrl, gif.title || "GIF");
	};

	return (
		<div className="space-y-3" ref={containerRef}>
			<div className="giphy-searchbar-wrap">
				<SearchBar placeholder="Search GIPHY…" />
			</div>
			<Grid
				key={searchKey}
				columns={4}
				width={width}
				fetchGifs={fetchGifs}
				onGifClick={handleClick}
				hideAttribution={false}
				noLink
			/>
			<style jsx global>{`
				.giphy-searchbar-wrap input {
					background: rgb(10 10 10) !important;
					border: 1px solid rgb(38 38 38) !important;
					color: rgb(229 229 229) !important;
					border-radius: 6px !important;
				}
				.giphy-searchbar-wrap input::placeholder {
					color: rgb(115 115 115) !important;
				}
			`}</style>
		</div>
	);
}

/* ─────────────────────────── Music tab ─────────────────────────── */

function MusicTab({
	currentMusic,
	onPick,
}: {
	currentMusic: { url: string; name: string } | undefined;
	onPick: (url: string, name: string) => void;
}) {
	const [url, setUrl] = useState("");
	const [name, setName] = useState("");
	const [mood, setMood] = useState<(typeof MUSIC_MOODS)[number]["id"]>("all");
	const [previewingId, setPreviewingId] = useState<string | null>(null);
	const audioRef = useRef<HTMLAudioElement | null>(null);

	const togglePreview = (track: MusicTrack) => {
		if (!track.previewUrl) return;
		const audio = audioRef.current ?? new Audio();
		audioRef.current = audio;
		if (previewingId === track.id) {
			audio.pause();
			setPreviewingId(null);
			return;
		}
		audio.pause();
		audio.src = track.previewUrl;
		audio.volume = 0.5;
		audio.currentTime = 0;
		audio
			.play()
			.then(() => setPreviewingId(track.id))
			.catch((err) => {
				console.error("preview failed", err);
				toast.error("Preview blocked — open the source page to download");
				setPreviewingId(null);
			});
		audio.onended = () => setPreviewingId(null);
	};

	useEffect(() => {
		// Stop preview when the modal closes / tab changes / unmount.
		return () => {
			audioRef.current?.pause();
			audioRef.current = null;
		};
	}, []);

	const apply = () => {
		if (!url.trim()) {
			toast.error("Paste a music URL");
			return;
		}
		onPick(url.trim(), name.trim() || url.split("/").pop() || "Track");
	};

	const uploads = useProjectStore((s) => s.project.uploads) ?? [];
	const audioUploads = uploads.filter(
		(u) =>
			u.type?.startsWith("audio/") ||
			u.url.toLowerCase().endsWith(".mp3") ||
			u.url.toLowerCase().endsWith(".wav") ||
			u.url.toLowerCase().endsWith(".m4a") ||
			u.url.toLowerCase().endsWith(".ogg"),
	);

	const filtered =
		mood === "all" ? MUSIC_TRACKS : MUSIC_TRACKS.filter((t) => t.mood === mood);

	const useTrack = (t: MusicTrack) => {
		if (!t.previewUrl) {
			window.open(t.sourceUrl, "_blank", "noopener,noreferrer");
			toast.message("Opened source page", {
				description: "Download the track and drop it in the Uploads tab",
			});
			return;
		}
		audioRef.current?.pause();
		setPreviewingId(null);
		onPick(t.previewUrl, `${t.title} — ${t.artist}`);
	};

	return (
		<div className="space-y-4">
			{currentMusic && (
				<div className="rounded-md border border-purple-500/30 bg-purple-500/5 p-3">
					<div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1">
						Currently playing
					</div>
					<div className="flex items-center gap-2 text-sm">
						<Music className="h-4 w-4 text-purple-300" />
						<span className="text-neutral-200">{currentMusic.name}</span>
					</div>
				</div>
			)}

			<section className="space-y-2">
				<div className="flex items-center justify-between">
					<div className="text-[10px] uppercase tracking-wider text-neutral-500">
						Free music · Pixabay · Bensound · NCS
					</div>
					<div className="text-[9px] text-neutral-600">
						Always check each track's license before publishing
					</div>
				</div>
				<div className="flex items-center gap-1 flex-wrap">
					{MUSIC_MOODS.map((m) => (
						<button
							key={m.id}
							type="button"
							onClick={() => setMood(m.id)}
							className={`text-[10px] px-2 py-0.5 rounded border ${
								mood === m.id
									? "border-purple-500 bg-purple-500/15 text-purple-200"
									: "border-neutral-800 text-neutral-400 hover:border-neutral-600"
							}`}
						>
							{m.label}
						</button>
					))}
				</div>
				<div className="grid grid-cols-1 gap-1.5">
					{filtered.map((t) => {
						const isPreviewing = previewingId === t.id;
						const noPreview = !t.previewUrl;
						return (
							<div
								key={t.id}
								className="flex items-center gap-2 px-2 py-1.5 rounded-md border border-neutral-800 bg-neutral-950/40 hover:border-neutral-600 transition-colors"
							>
								<button
									type="button"
									onClick={() => togglePreview(t)}
									disabled={noPreview}
									className={`shrink-0 w-7 h-7 flex items-center justify-center rounded-full ${
										noPreview
											? "bg-neutral-900 text-neutral-700 cursor-not-allowed"
											: isPreviewing
												? "bg-purple-500 text-neutral-950"
												: "bg-neutral-800 text-purple-200 hover:bg-purple-500/30"
									}`}
									title={noPreview ? "No preview — open source" : isPreviewing ? "Pause" : "Preview"}
								>
									{isPreviewing ? (
										<Pause className="h-3 w-3" />
									) : (
										<Play className="h-3 w-3 ml-0.5" />
									)}
								</button>
								<div className="flex-1 min-w-0">
									<div className="text-[12px] font-medium text-neutral-200 truncate">
										{t.title}
									</div>
									<div className="text-[10px] text-neutral-500 truncate">
										{t.artist} · {t.mood}
										{t.bpm ? ` · ${t.bpm} bpm` : ""}
										{t.durationSec ? ` · ${formatSeconds(t.durationSec)}` : ""}
									</div>
								</div>
								<span
									className="text-[9px] px-1.5 py-0.5 rounded border border-neutral-800 text-neutral-500"
									title={LICENSE_LABEL[t.license]}
								>
									{t.source}
								</span>
								<a
									href={t.sourceUrl}
									target="_blank"
									rel="noopener noreferrer"
									onClick={(e) => e.stopPropagation()}
									className="text-neutral-500 hover:text-neutral-200"
									title="Open source page / license"
								>
									<ExternalLink className="h-3.5 w-3.5" />
								</a>
								<button
									type="button"
									onClick={() => useTrack(t)}
									className="shrink-0 text-[11px] px-2 py-1 rounded bg-purple-500 hover:bg-purple-400 text-neutral-950 font-semibold"
								>
									{noPreview ? "Get" : "Use"}
								</button>
							</div>
						);
					})}
				</div>
			</section>

			<details className="rounded-md border border-neutral-800 bg-neutral-950/40">
				<summary className="px-3 py-2 text-[11px] text-neutral-400 cursor-pointer hover:text-white">
					Paste a custom track URL
				</summary>
				<div className="px-3 pb-3 space-y-2">
					<input
						type="text"
						value={url}
						onChange={(e) => setUrl(e.target.value)}
						placeholder="https://… .mp3 / .wav / .m4a"
						className="w-full text-xs px-2 py-1.5 rounded bg-neutral-950 border border-neutral-800 text-neutral-200 focus:border-purple-400 focus:outline-none"
					/>
					<input
						type="text"
						value={name}
						onChange={(e) => setName(e.target.value)}
						placeholder="Display name (optional)"
						className="w-full text-xs px-2 py-1.5 rounded bg-neutral-950 border border-neutral-800 text-neutral-200 focus:border-purple-400 focus:outline-none"
					/>
					<button
						type="button"
						onClick={apply}
						className="text-[11px] px-2.5 py-1.5 rounded-md bg-purple-500 hover:bg-purple-400 text-neutral-950 font-semibold"
					>
						Set as background music
					</button>
				</div>
			</details>

			<div className="rounded-md border border-neutral-800 bg-neutral-950/40 p-3 space-y-2">
				<div className="text-[10px] uppercase tracking-wider text-neutral-500">
					From this project's uploads
				</div>
				{audioUploads.length === 0 ? (
					<div className="text-[11px] text-neutral-500">
						No audio uploaded yet. Drop an .mp3 in the Uploads tab to use it here.
					</div>
				) : (
					<div className="grid grid-cols-1 gap-1">
						{audioUploads.map((u) => (
							<button
								key={u.id}
								type="button"
								onClick={() => onPick(u.url, u.name)}
								className="flex items-center gap-2 px-2 py-1.5 rounded text-[11px] text-neutral-300 hover:bg-purple-500/10 hover:text-purple-200 border border-neutral-800 hover:border-purple-400 transition-colors"
							>
								<Music className="h-3 w-3" />
								<span className="truncate">{u.name}</span>
							</button>
						))}
					</div>
				)}
			</div>
		</div>
	);
}

function formatSeconds(sec: number): string {
	const m = Math.floor(sec / 60);
	const s = Math.floor(sec % 60);
	return `${m}:${s.toString().padStart(2, "0")}`;
}

/* ─────────────────────────── Upload tab ─────────────────────────── */

function UploadTab() {
	const addUpload = useProjectStore((s) => s.addUpload);
	const uploads = useProjectStore((s) => s.project.uploads) ?? [];
	const [busy, setBusy] = useState(false);
	const inputRef = useRef<HTMLInputElement | null>(null);

	const handle = async (files: FileList | File[] | null) => {
		if (!files || (files instanceof FileList ? files.length === 0 : files.length === 0)) return;
		setBusy(true);
		try {
			const { uploadFiles } = await import("@/lib/upload-files");
			const results = await uploadFiles(files, addUpload);
			toast.success(`Uploaded ${results.length} file${results.length === 1 ? "" : "s"}`);
		} finally {
			setBusy(false);
		}
	};

	return (
		<div className="space-y-3">
			<input
				ref={inputRef}
				type="file"
				multiple
				accept="image/*,video/*,audio/*"
				hidden
				onChange={(e) => {
					if (e.target.files) handle(e.target.files);
					e.target.value = "";
				}}
			/>
			<button
				type="button"
				onClick={() => inputRef.current?.click()}
				disabled={busy}
				className="w-full flex flex-col items-center justify-center gap-2 py-8 rounded-md border-2 border-dashed border-neutral-700 hover:border-purple-400 hover:bg-purple-500/5 text-neutral-400 hover:text-purple-200 transition-colors"
			>
				{busy ? (
					<Loader2 className="h-6 w-6 animate-spin" />
				) : (
					<Upload className="h-6 w-6" />
				)}
				<span className="text-xs font-semibold">Click to upload images / video / audio</span>
				<span className="text-[10px] text-neutral-500">
					Files attach to your project — drag from the grid below into a scene
				</span>
			</button>
			{uploads.length > 0 && (
				<div>
					<div className="text-[9px] uppercase tracking-wider text-neutral-500 mb-1.5">
						Project uploads ({uploads.length})
					</div>
					<div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
						{uploads.map((u) => {
							const isVideo = u.type?.startsWith("video/");
							const isAudio = u.type?.startsWith("audio/");
							return (
								<div
									key={u.id}
									className="relative aspect-square rounded-md overflow-hidden border border-neutral-800 bg-neutral-950 group"
									title={u.name}
								>
									{isVideo ? (
										// biome-ignore lint/a11y/useMediaCaption: thumbnail
										<video
											src={u.url}
											muted
											className="w-full h-full object-cover"
										/>
									) : isAudio ? (
										<div className="w-full h-full flex items-center justify-center">
											<Music className="h-6 w-6 text-neutral-500" />
										</div>
									) : (
										// biome-ignore lint/performance/noImgElement: tile
										<img src={u.url} alt={u.name} className="w-full h-full object-cover" />
									)}
									<div className="absolute bottom-0 inset-x-0 px-1 py-0.5 bg-black/70 text-[9px] text-neutral-300 truncate">
										{isVideo ? <Video className="h-2.5 w-2.5 inline mr-0.5" /> : isAudio ? <Music className="h-2.5 w-2.5 inline mr-0.5" /> : <ImageIcon className="h-2.5 w-2.5 inline mr-0.5" />}
										{u.name}
									</div>
								</div>
							);
						})}
					</div>
				</div>
			)}
		</div>
	);
}

/* ─────────────────────────── Trigger button ─────────────────────────── */

export function MediaLibraryTrigger() {
	const [open, setOpen] = useState(false);
	return (
		<>
			<button
				type="button"
				onClick={() => setOpen(true)}
				title="Media library — emoji, GIFs, music, uploads"
				className="hidden sm:flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-md text-neutral-300 hover:text-purple-300 hover:bg-purple-500/10 border border-neutral-800 hover:border-purple-500 transition-colors"
			>
				<Library className="h-3.5 w-3.5" />
				<span>Library</span>
			</button>
			<MediaLibrary open={open} onClose={() => setOpen(false)} />
		</>
	);
}
