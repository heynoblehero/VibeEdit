"use client";

/**
 * SceneLayers — per-scene layer panel.
 *
 * Replaces the multi-row LayeredTimeline + Tracks abstraction with a
 * single-scene view: the user picks a scene, then sees the stack of
 * layers that compose it (bg → character → text → emphasis → subtitle
 * → broll[] → effects[] → voiceover). Click a layer to focus the
 * editor sidebar on it. Each row shows the count of motion clips
 * targeting that element so the user can spot stale animation state
 * without opening a side panel.
 */

import {
	Eye,
	EyeOff,
	Film,
	Image as ImageIcon,
	ImagePlay,
	Layers,
	Mic,
	MousePointer2,
	Sparkles,
	Type,
	UserSquare2,
	Wand2,
} from "lucide-react";
import { useMemo } from "react";
import {
	type LayerKind,
	deriveItemsFromScene,
	kindToEditTarget,
	type TimelineItem,
} from "@/lib/timeline-items";
import type { MotionClipElement, Scene } from "@/lib/scene-schema";
import { useEditorStore } from "@/store/editor-store";
import { useProjectStore } from "@/store/project-store";

interface LayerRowSpec {
	id: string;
	kind: LayerKind | "scene";
	label: string;
	subtitle?: string;
	clipElement: MotionClipElement | null;
	/** For broll: the broll item id used as targetId on motion clips. */
	clipTargetId?: string;
	indexInArray?: number;
}

const ICON_BY_KIND: Record<LayerKind | "scene", React.ComponentType<{ className?: string }>> = {
	scene: Layers,
	bg: ImageIcon,
	character: UserSquare2,
	"text-main": Type,
	"text-emphasis": Type,
	"text-subtitle": Type,
	broll: ImagePlay,
	effects: Sparkles,
	voiceover: Mic,
	montage: Film,
	stat: Wand2,
	bullets: Wand2,
	quote: Wand2,
	"bar-chart": Wand2,
	three: Wand2,
	split: Wand2,
	counter: Wand2,
};

const COLOR_BY_KIND: Record<LayerKind | "scene", string> = {
	scene: "bg-neutral-800 text-neutral-300 border-neutral-700",
	bg: "bg-neutral-700/40 text-neutral-200 border-neutral-600/60",
	character: "bg-sky-700/40 text-sky-200 border-sky-700/60",
	"text-main": "bg-emerald-700/40 text-emerald-200 border-emerald-700/60",
	"text-emphasis": "bg-emerald-700/40 text-emerald-200 border-emerald-700/60",
	"text-subtitle": "bg-emerald-700/40 text-emerald-200 border-emerald-700/60",
	broll: "bg-amber-700/40 text-amber-200 border-amber-700/60",
	effects: "bg-purple-700/40 text-purple-200 border-purple-700/60",
	voiceover: "bg-cyan-700/40 text-cyan-200 border-cyan-700/60",
	montage: "bg-pink-700/40 text-pink-200 border-pink-700/60",
	stat: "bg-pink-700/40 text-pink-200 border-pink-700/60",
	bullets: "bg-pink-700/40 text-pink-200 border-pink-700/60",
	quote: "bg-pink-700/40 text-pink-200 border-pink-700/60",
	"bar-chart": "bg-pink-700/40 text-pink-200 border-pink-700/60",
	three: "bg-pink-700/40 text-pink-200 border-pink-700/60",
	split: "bg-pink-700/40 text-pink-200 border-pink-700/60",
	counter: "bg-pink-700/40 text-pink-200 border-pink-700/60",
};

function clipElementForKind(kind: LayerKind): MotionClipElement | null {
	switch (kind) {
		case "bg":
			return "bg";
		case "character":
			return "character";
		case "text-main":
			return "text";
		case "text-emphasis":
			return "emphasis";
		case "text-subtitle":
			return "subtitle";
		case "broll":
			return "broll";
		default:
			return null;
	}
}

function buildRows(scene: Scene, fps: number): LayerRowSpec[] {
	const items = deriveItemsFromScene(scene, 0, fps);
	// Render-stack order: bg first (deepest), audio last. The derive
	// order is already startFrame ascending — re-group by kind so the
	// panel reads top-to-bottom like a layer list.
	const order: LayerKind[] = [
		"bg",
		"montage",
		"split",
		"three",
		"character",
		"broll",
		"text-main",
		"text-emphasis",
		"text-subtitle",
		"counter",
		"stat",
		"bullets",
		"quote",
		"bar-chart",
		"effects",
		"voiceover",
	];
	const grouped = new Map<LayerKind, TimelineItem[]>();
	for (const it of items) {
		const arr = grouped.get(it.kind) ?? [];
		arr.push(it);
		grouped.set(it.kind, arr);
	}
	const rows: LayerRowSpec[] = [
		{
			id: "scene",
			kind: "scene",
			label: "Whole scene",
			subtitle: `${scene.duration.toFixed(1)}s`,
			clipElement: "scene",
		},
	];
	for (const kind of order) {
		const arr = grouped.get(kind);
		if (!arr) continue;
		for (let i = 0; i < arr.length; i++) {
			const it = arr[i];
			const clipEl = clipElementForKind(kind);
			rows.push({
				id: it.id,
				kind,
				label: it.label,
				subtitle: framesToTime(it.startFrame, it.durationFrames, fps),
				clipElement: clipEl,
				clipTargetId:
					kind === "broll" && it.index !== undefined
						? scene.broll?.[it.index]?.id
						: undefined,
				indexInArray: it.index,
			});
		}
	}
	return rows;
}

function framesToTime(start: number, dur: number, fps: number): string {
	const startSec = start / fps;
	const endSec = (start + dur) / fps;
	return `${startSec.toFixed(1)}s → ${endSec.toFixed(1)}s`;
}

export function SceneLayers() {
	const project = useProjectStore((s) => s.project);
	const selectedSceneId = useProjectStore((s) => s.selectedSceneId);
	const selectScene = useProjectStore((s) => s.selectScene);
	const setEditTarget = useEditorStore((s) => s.setEditTarget);

	const scene = useMemo(
		() => project.scenes.find((sc) => sc.id === selectedSceneId) ?? project.scenes[0],
		[project.scenes, selectedSceneId],
	);

	const rows = useMemo(
		() => (scene ? buildRows(scene, project.fps) : []),
		[scene, project.fps],
	);

	const clipsByElement = useMemo(() => {
		const map = new Map<string, number>();
		for (const c of scene?.motionClips ?? []) {
			const key = `${c.element}:${c.targetId ?? ""}`;
			map.set(key, (map.get(key) ?? 0) + 1);
		}
		return map;
	}, [scene]);

	if (!scene) {
		return (
			<div className="flex items-center justify-center h-full text-[11px] text-neutral-600">
				<span>No scene yet</span>
			</div>
		);
	}

	const handleClick = (row: LayerRowSpec) => {
		selectScene(scene.id);
		if (row.kind === "scene") {
			setEditTarget(null);
			return;
		}
		const target = kindToEditTarget(row.kind as LayerKind);
		if (target !== null) setEditTarget(target);
	};

	return (
		<div className="flex flex-col h-full text-[12px]">
			<div className="flex items-center justify-between px-3 py-2 border-b border-neutral-800 bg-neutral-950/80 sticky top-0 z-10">
				<div className="flex items-center gap-2">
					<Layers className="h-3.5 w-3.5 text-neutral-400" />
					<span className="text-[11px] uppercase tracking-wider text-neutral-400 font-medium">
						Layers
					</span>
					<span className="text-[10px] text-neutral-600">
						{scene.label ?? `Scene ${project.scenes.indexOf(scene) + 1}`}
					</span>
				</div>
				<span className="text-[10px] text-neutral-600">
					{rows.length - 1} layer{rows.length - 1 === 1 ? "" : "s"}
				</span>
			</div>
			<div className="flex-1 overflow-y-auto px-2 py-1.5 space-y-1">
				{rows.map((row) => {
					const Icon = ICON_BY_KIND[row.kind];
					const clipKey = row.clipElement
						? `${row.clipElement}:${row.clipTargetId ?? ""}`
						: null;
					const clipCount = clipKey ? (clipsByElement.get(clipKey) ?? 0) : 0;
					const isHidden =
						row.kind === "bg" && !scene.background.imageUrl && !scene.background.videoUrl;
					return (
						<button
							key={row.id}
							type="button"
							onClick={() => handleClick(row)}
							className={`w-full flex items-center gap-2 px-2 py-1.5 rounded border ${COLOR_BY_KIND[row.kind]} hover:brightness-125 transition-all text-left`}
						>
							<Icon className="h-3.5 w-3.5 shrink-0 opacity-80" />
							<div className="flex-1 min-w-0">
								<div className="truncate text-[12px] font-medium">
									{row.label}
								</div>
								{row.subtitle && (
									<div className="truncate text-[10px] text-neutral-500">
										{row.subtitle}
									</div>
								)}
							</div>
							{clipCount > 0 && (
								<span
									className="px-1.5 py-0.5 rounded-sm text-[9px] font-mono bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
									title={`${clipCount} motion clip${clipCount === 1 ? "" : "s"} on this layer`}
								>
									{clipCount} clip{clipCount === 1 ? "" : "s"}
								</span>
							)}
							{isHidden ? (
								<EyeOff className="h-3 w-3 text-neutral-600" />
							) : (
								<Eye className="h-3 w-3 text-neutral-600 opacity-60" />
							)}
							<MousePointer2 className="h-3 w-3 text-neutral-600 opacity-50" />
						</button>
					);
				})}
			</div>
			<div className="px-3 py-1.5 border-t border-neutral-800 text-[10px] text-neutral-600 bg-neutral-950/80">
				Click a layer to focus its properties. Ask the AI for "make {scene.text || "the text"} fade in" — clip count appears on the row.
			</div>
		</div>
	);
}
