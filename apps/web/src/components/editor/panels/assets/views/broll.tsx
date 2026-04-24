"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { PanelView } from "@/components/editor/panels/assets/views/base-view";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/utils/ui";
import { useEditor } from "@/hooks/use-editor";
import type { TimelineElement, VideoElement, ImageElement } from "@/types/timeline";

type BrollType = "video" | "image" | "gif" | "meme";

interface BrollResult {
	id: string;
	url: string;
	thumbnail: string;
	width: number;
	height: number;
	duration?: number;
	source: string;
	credit?: string;
	mediaKind: "video" | "image" | "gif";
}

const TYPE_TABS: Array<{ key: BrollType; label: string }> = [
	{ key: "video", label: "Stock Video" },
	{ key: "image", label: "Images" },
	{ key: "gif", label: "GIFs" },
	{ key: "meme", label: "Memes" },
];

const STOPWORDS = new Set([
	"the", "a", "an", "and", "or", "but", "for", "of", "to", "in", "on",
	"at", "by", "with", "from", "is", "are", "was", "were", "be", "been",
	"being", "have", "has", "had", "do", "does", "did", "will", "would",
	"should", "could", "may", "might", "must", "can", "this", "that",
	"these", "those", "i", "you", "he", "she", "it", "we", "they", "my",
	"your", "his", "her", "its", "our", "their", "as", "if", "so", "not",
	"no", "yes", "me", "us", "them", "what", "when", "where", "why", "how",
	"project", "video", "untitled",
]);

export function BrollView() {
	const editor = useEditor();
	const [activeType, setActiveType] = useState<BrollType>("video");
	const [query, setQuery] = useState("");
	const [results, setResults] = useState<BrollResult[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const suggestions = useMemo(() => deriveSuggestions({ editor }), [editor]);

	const runSearch = async ({ term, type }: { term: string; type: BrollType }) => {
		if (!term.trim()) return;
		setIsLoading(true);
		setError(null);
		try {
			const response = await fetch(
				`/api/stock-media?q=${encodeURIComponent(term)}&type=${type}&per_page=16`,
			);
			if (!response.ok) {
				const body = (await response.json().catch(() => ({}))) as { error?: string };
				throw new Error(body.error || `Search failed (${response.status})`);
			}
			const body = (await response.json()) as { results: BrollResult[] };
			setResults(body.results ?? []);
			if ((body.results ?? []).length === 0) {
				setError(`No results for "${term}"`);
			}
		} catch (thrown) {
			setError(thrown instanceof Error ? thrown.message : "Search failed");
			setResults([]);
		} finally {
			setIsLoading(false);
		}
	};

	const handleSearchSubmit = (event: React.FormEvent) => {
		event.preventDefault();
		runSearch({ term: query, type: activeType });
	};

	const handleSuggestion = (term: string) => {
		setQuery(term);
		runSearch({ term, type: activeType });
	};

	return (
		<PanelView
			title="B-Roll"
			actions={
				<span className="text-muted-foreground text-xs">
					Stock · GIFs · Memes
				</span>
			}
		>
			<div className="flex flex-col gap-3">
				<form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
					<Input
						value={query}
						onChange={(event) => setQuery(event.target.value)}
						placeholder={`Search ${labelFor(activeType).toLowerCase()}...`}
						aria-label="Search B-roll"
					/>
					<Button type="submit" size="sm" disabled={!query.trim() || isLoading}>
						{isLoading ? <Spinner className="size-4" /> : "Search"}
					</Button>
				</form>

				<div className="flex flex-wrap gap-1">
					{TYPE_TABS.map((tab) => (
						<Button
							key={tab.key}
							size="sm"
							variant={activeType === tab.key ? "secondary" : "outline"}
							onClick={() => {
								setActiveType(tab.key);
								if (query.trim()) runSearch({ term: query, type: tab.key });
							}}
						>
							{tab.label}
						</Button>
					))}
				</div>

				{suggestions.length > 0 && (
					<div className="flex flex-col gap-1">
						<span className="text-muted-foreground text-xs">
							Suggestions from your project
						</span>
						<div className="flex flex-wrap gap-1">
							{suggestions.map((term) => (
								<Button
									key={term}
									size="sm"
									variant="outline"
									onClick={() => handleSuggestion(term)}
									onKeyDown={(event) => {
										if (event.key === "Enter") handleSuggestion(term);
									}}
								>
									{term}
								</Button>
							))}
						</div>
					</div>
				)}

				{error && (
					<p className="text-destructive text-xs" role="alert">
						{error}
					</p>
				)}

				<ResultGrid results={results} />
			</div>
		</PanelView>
	);
}

function ResultGrid({ results }: { results: BrollResult[] }) {
	if (results.length === 0) return null;
	return (
		<div
			className="grid gap-2"
			style={{ gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))" }}
		>
			{results.map((result) => (
				<ResultCard key={result.id} result={result} />
			))}
		</div>
	);
}

function ResultCard({ result }: { result: BrollResult }) {
	const editor = useEditor();
	const [isAdding, setIsAdding] = useState(false);

	const handleAdd = async () => {
		setIsAdding(true);
		try {
			await addBrollToTimeline({ editor, result });
			toast.success(`Added ${result.mediaKind} to timeline`);
		} catch (thrown) {
			toast.error(
				thrown instanceof Error ? thrown.message : "Failed to add to timeline",
			);
		} finally {
			setIsAdding(false);
		}
	};

	return (
		<button
			type="button"
			onClick={handleAdd}
			disabled={isAdding}
			title={result.credit ? `${result.credit} · ${result.source}` : result.source}
			className={cn(
				"group relative overflow-hidden rounded-md border bg-muted/30",
				"hover:border-primary focus-visible:border-primary outline-none",
				"aspect-square",
				isAdding && "opacity-60",
			)}
		>
			{/* eslint-disable-next-line @next/next/no-img-element */}
			<img
				src={result.thumbnail}
				alt=""
				className="h-full w-full object-cover"
				loading="lazy"
			/>
			<div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-1">
				<span className="text-[10px] text-white/90 truncate block">
					{result.credit || result.source}
				</span>
			</div>
			{isAdding && (
				<div className="absolute inset-0 grid place-items-center bg-background/60">
					<Spinner className="size-4" />
				</div>
			)}
		</button>
	);
}

function labelFor(type: BrollType): string {
	const tab = TYPE_TABS.find((t) => t.key === type);
	return tab?.label ?? type;
}

function deriveSuggestions({
	editor,
}: {
	editor: ReturnType<typeof useEditor>;
}): string[] {
	const terms = new Set<string>();
	const activeProject = editor.project.getActive();
	if (activeProject?.metadata?.name) {
		extractKeywords(activeProject.metadata.name).forEach((t) => terms.add(t));
	}
	const tracks = editor.timeline.getTracks();
	for (const track of tracks) {
		if (track.type !== "text") continue;
		for (const element of track.elements) {
			if (element.type !== "text") continue;
			extractKeywords(element.content).forEach((t) => terms.add(t));
			if (terms.size >= 8) break;
		}
		if (terms.size >= 8) break;
	}
	return Array.from(terms).slice(0, 8);
}

function extractKeywords(input: string): string[] {
	return input
		.toLowerCase()
		.replace(/[^a-z0-9\s]/g, " ")
		.split(/\s+/)
		.filter((word) => word.length >= 4 && !STOPWORDS.has(word));
}

async function addBrollToTimeline({
	editor,
	result,
}: {
	editor: ReturnType<typeof useEditor>;
	result: BrollResult;
}) {
	const activeProject = editor.project.getActive();
	if (!activeProject) throw new Error("No active project");

	const response = await fetch(result.url);
	if (!response.ok) throw new Error(`Failed to fetch media (${response.status})`);
	const blob = await response.blob();
	const extension = guessExtension({ mimeType: blob.type, mediaKind: result.mediaKind });
	const filename = `${result.source}-${result.id}${extension}`;
	const file = new File([blob], filename, { type: blob.type || "application/octet-stream" });
	const objectUrl = URL.createObjectURL(file);

	const mediaType: "video" | "image" =
		result.mediaKind === "image" ? "image" : "video";

	await editor.media.addMediaAsset({
		projectId: activeProject.metadata.id,
		asset: {
			name: filename,
			type: mediaType,
			file,
			url: objectUrl,
			thumbnailUrl: result.thumbnail,
			width: result.width || undefined,
			height: result.height || undefined,
			duration: result.duration,
		},
	});

	const allAssets = editor.media.getAssets();
	const addedAsset = allAssets.find((asset) => asset.name === filename);
	if (!addedAsset) throw new Error("Failed to register media asset");

	const playheadTime = editor.playback.getCurrentTime?.() ?? 0;
	const duration = result.duration ?? (mediaType === "image" ? 5 : 5);
	const baseTransform = { scale: 1, position: { x: 0, y: 0 }, rotate: 0 };

	const element: Omit<VideoElement, "id"> | Omit<ImageElement, "id"> =
		mediaType === "video"
			? {
					type: "video",
					mediaId: addedAsset.id,
					name: filename,
					duration,
					startTime: playheadTime,
					trimStart: 0,
					trimEnd: 0,
					sourceDuration: result.duration,
					transform: baseTransform,
					opacity: 1,
				}
			: {
					type: "image",
					mediaId: addedAsset.id,
					name: filename,
					duration,
					startTime: playheadTime,
					trimStart: 0,
					trimEnd: 0,
					transform: baseTransform,
					opacity: 1,
				};

	editor.timeline.insertElement({
		element: element as unknown as TimelineElement,
		placement: { mode: "auto", trackType: "video" },
	});
}

function guessExtension({
	mimeType,
	mediaKind,
}: {
	mimeType: string;
	mediaKind: BrollResult["mediaKind"];
}): string {
	if (mimeType.includes("mp4")) return ".mp4";
	if (mimeType.includes("webm")) return ".webm";
	if (mimeType.includes("gif")) return ".gif";
	if (mimeType.includes("jpeg")) return ".jpg";
	if (mimeType.includes("png")) return ".png";
	if (mediaKind === "video" || mediaKind === "gif") return ".mp4";
	return ".jpg";
}
