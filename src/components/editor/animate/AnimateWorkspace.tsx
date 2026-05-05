"use client";

import { Plus, Sparkles } from "lucide-react";
import { useEffect, useMemo } from "react";
import { EmptyState as EmptyStateUi } from "@/components/ui/EmptyState";
import {
	ANIMATION_TEMPLATES,
	type AnimationSpec,
	makeDefaultSpec,
} from "@/lib/animate/spec";
import { useEditorStore } from "@/store/editor-store";
import { useProjectStore } from "@/store/project-store";
import { AnimateChat } from "./AnimateChat";
import { AnimateInspector } from "./AnimateInspector";
import { AnimatePreview } from "./AnimatePreview";

/**
 * Animate workspace — the magenta third tab. Three columns:
 *   - Left: AI chat that produces structured AnimationSpec.
 *   - Center: live Remotion Player preview + the project's animation
 *     gallery (so the user can flip back to past generations).
 *   - Right: AnimateInspector for the selected spec — props, render,
 *     download, "use in project", save-to-library.
 *
 * Specs persist on the project so the user can come back later and
 * tweak; rendered mp4s flow through the existing uploads pipeline
 * (content-addressed, dedup'd) and can be dropped onto a scene's
 * bgVideoUrl directly.
 */
export function AnimateWorkspace() {
	const project = useProjectStore((s) => s.project);
	const addAnimation = useProjectStore((s) => s.addAnimation);
	const updateAnimation = useProjectStore((s) => s.updateAnimation);
	const selectedId = useEditorStore((s) => s.animateSelectedId);
	const setSelected = useEditorStore((s) => s.setAnimateSelectedId);

	const animations = project.animations ?? [];
	const selected = useMemo(
		() => animations.find((a) => a.id === selectedId) ?? animations[0] ?? null,
		[animations, selectedId],
	);

	useEffect(() => {
		// If the persisted selection is gone (deleted), fall back to the
		// most recent animation, or null if there are none.
		if (selectedId && !animations.find((a) => a.id === selectedId)) {
			setSelected(animations[0]?.id ?? null);
		}
	}, [animations, selectedId, setSelected]);

	const onSpec = (spec: AnimationSpec) => {
		// New spec from chat or "start blank" template tile.
		const exists = animations.some((a) => a.id === spec.id);
		if (exists) {
			updateAnimation(spec.id, spec);
		} else {
			addAnimation(spec);
		}
		setSelected(spec.id);
	};

	const onPatch = (patch: Partial<AnimationSpec>) => {
		if (!selected) return;
		updateAnimation(selected.id, patch);
	};

	const newBlank = () => {
		const spec = makeDefaultSpec("kinetic-title", {
			fps: project.fps,
			width: project.width,
			height: project.height,
		});
		addAnimation(spec);
		setSelected(spec.id);
	};

	return (
		<div className="flex-1 flex flex-col min-h-0 bg-neutral-925">
			<div className="h-0.5 shrink-0 bg-gradient-to-r from-fuchsia-500/0 via-fuchsia-500/60 to-fuchsia-500/0" />
			<div className="flex-1 flex min-h-0">
			{/* Left rail: chat. */}
			<aside className="w-80 border-r border-neutral-800 bg-neutral-950/60 shrink-0">
				<AnimateChat currentSpec={selected ?? null} onSpec={onSpec} />
			</aside>

			{/* Center: preview + gallery. */}
			<section className="flex-1 min-w-0 flex flex-col bg-neutral-950">
				<header className="flex items-center justify-between px-4 py-2.5 border-b border-neutral-800 bg-neutral-900 shrink-0">
					<div className="flex items-center gap-3">
						<Sparkles className="h-4 w-4 text-fuchsia-300" />
						<span className="text-[11px] uppercase tracking-wider text-fuchsia-300 font-semibold">
							Animate
						</span>
						<span className="text-[10px] text-neutral-500">
							{animations.length} animation{animations.length === 1 ? "" : "s"} · canvas{" "}
							{project.width}×{project.height} · {project.fps}fps
						</span>
					</div>
					<button
						type="button"
						onClick={newBlank}
						className="flex items-center gap-1 px-2 py-1 rounded text-[10px] text-fuchsia-200 hover:bg-fuchsia-500/10"
					>
						<Plus className="h-3 w-3" />
						New blank
					</button>
				</header>

				{selected ? (
					<div className="flex-1 min-h-0 p-4 flex flex-col gap-3">
						<div className="flex-1 min-h-0">
							<AnimatePreview spec={selected} />
						</div>
						{animations.length > 1 ? (
							<Gallery
								animations={animations}
								selectedId={selected.id}
								onPick={(id) => setSelected(id)}
							/>
						) : null}
					</div>
				) : (
					<EmptyState />
				)}
			</section>

			{/* Right: inspector. */}
			<aside className="w-80 border-l border-neutral-800 bg-neutral-950/60 shrink-0 flex flex-col">
				<div className="sticky top-0 z-10 flex items-center justify-between px-3 py-2 border-b border-neutral-800 bg-neutral-900 shrink-0">
					<span className="text-[11px] uppercase tracking-wider text-fuchsia-300 font-semibold">
						Inspector
					</span>
				</div>
				<div className="flex-1 overflow-y-auto p-3">
					{selected ? (
						<AnimateInspector spec={selected} onPatch={onPatch} />
					) : (
						<div className="rounded-md border border-dashed border-neutral-800 p-3 text-[11px] text-neutral-400">
							Generate or pick an animation to edit it here.
						</div>
					)}
				</div>
			</aside>
			</div>
		</div>
	);
}

function EmptyState() {
	return (
		<div className="flex-1 flex items-center justify-center">
			<EmptyStateUi
				accent="animate"
				icon={<Sparkles className="h-5 w-5" />}
				title="Describe a motion graphic to start"
				description="Kinetic titles, big-number reveals, lower thirds, quote cards, bullet lists, logo reveals. The AI picks a template, fills in colors, copy, and timing — you preview, tweak props, and drop the result onto a scene or save it for later."
			/>
		</div>
	);
}

function Gallery({
	animations,
	selectedId,
	onPick,
}: {
	animations: AnimationSpec[];
	selectedId: string;
	onPick: (id: string) => void;
}) {
	return (
		<div className="shrink-0 space-y-1.5">
			<div className="text-[10px] uppercase tracking-wider text-fuchsia-300/80 font-semibold">
				This project's animations
			</div>
			<div className="flex gap-1.5 overflow-x-auto pb-1">
				{animations.map((a) => {
					const tpl = ANIMATION_TEMPLATES[a.templateId];
					const active = a.id === selectedId;
					return (
						<button
							key={a.id}
							type="button"
							onClick={() => onPick(a.id)}
							className={`shrink-0 px-2.5 py-1.5 rounded text-[10px] border ${
								active
									? "bg-fuchsia-500/20 border-fuchsia-500/60 text-fuchsia-100"
									: "bg-neutral-950 border-neutral-800 text-neutral-400 hover:border-fuchsia-500/30 hover:text-fuchsia-200"
							}`}
						>
							<div className="font-semibold truncate max-w-[120px]">
								{a.name ?? tpl.label}
							</div>
							<div className="text-[9px] opacity-70">
								{tpl.label} · {(a.durationFrames / a.fps).toFixed(1)}s
							</div>
						</button>
					);
				})}
			</div>
		</div>
	);
}
