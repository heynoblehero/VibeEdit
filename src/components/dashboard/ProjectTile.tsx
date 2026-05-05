"use client";

import { Clock, Copy, Film, Monitor, MoreVertical, Pencil, Smartphone, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { SceneThumbnail } from "@/components/editor/SceneThumbnail";
import { toast } from "@/lib/toast";
import type { Project } from "@/lib/scene-schema";
import { useProjectStore } from "@/store/project-store";

/**
 * One project card on the dashboard. Shows the first scene as a
 * thumbnail (cheap reuse of SceneThumbnail), name, scene count,
 * duration, and aspect orientation. Right-side menu for delete.
 */
interface Props {
	project: Project;
	onOpen: () => void;
}

export function ProjectTile({ project, onOpen }: Props) {
	const deleteProject = useProjectStore((s) => s.deleteProject);
	const switchProject = useProjectStore((s) => s.switchProject);
	const renameProject = useProjectStore((s) => s.renameProject);
	const duplicateProject = useProjectStore((s) => s.duplicateProject);
	const setProjectActive = useProjectStore((s) => s.switchProject);
	const [menuOpen, setMenuOpen] = useState(false);
	const [renaming, setRenaming] = useState(false);
	const [draftName, setDraftName] = useState(project.name);
	const renameRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		if (renaming) {
			renameRef.current?.focus();
			renameRef.current?.select();
		}
	}, [renaming]);

	const sceneCount = project.scenes.length;
	const totalSec = project.scenes.reduce((acc, s) => acc + (s.duration ?? 0), 0);
	const portrait = project.height > project.width;
	const updatedAt = project.updatedAt;
	const firstScene = project.scenes[0];

	const fmtDur = (s: number): string => {
		if (s < 60) return `${s.toFixed(1)}s`;
		const m = Math.floor(s / 60);
		const ss = Math.round(s % 60);
		return `${m}:${ss.toString().padStart(2, "0")}`;
	};

	const fmtRel = (ts?: number): string => {
		if (!ts) return "—";
		const diff = Date.now() - ts;
		const mins = Math.floor(diff / 60_000);
		if (mins < 1) return "just now";
		if (mins < 60) return `${mins}m ago`;
		const hours = Math.floor(mins / 60);
		if (hours < 24) return `${hours}h ago`;
		const days = Math.floor(hours / 24);
		if (days < 7) return `${days}d ago`;
		const d = new Date(ts);
		return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
	};

	const handleDelete = (e: React.MouseEvent) => {
		e.stopPropagation();
		setMenuOpen(false);
		deleteProject(project.id);
		toast.info("Moved to trash", {
			description: `"${project.name}" — restore from the Trash view within 30 days.`,
		});
	};

	const handleDuplicate = (e: React.MouseEvent) => {
		e.stopPropagation();
		setMenuOpen(false);
		// duplicateProject works on the active project, so swap first
		// then duplicate-and-restore.
		const wasActive = useProjectStore.getState().project.id;
		setProjectActive(project.id);
		const newId = duplicateProject({ copyScenes: true });
		setProjectActive(wasActive);
		toast.success("Duplicated", { description: `New copy created.` });
		// suppress unused-warning if newId not consumed elsewhere
		void newId;
	};

	const startRename = (e: React.MouseEvent) => {
		e.stopPropagation();
		setMenuOpen(false);
		// Tile rename is a no-op unless we activate this project, since
		// renameProject acts on the *active* project. We swap, write,
		// then swap back. Cheap on Zustand.
		setDraftName(project.name);
		setRenaming(true);
	};

	const commitRename = () => {
		const next = draftName.trim() || "Untitled";
		const wasActive = useProjectStore.getState().project.id;
		switchProject(project.id);
		renameProject(next);
		switchProject(wasActive);
		setRenaming(false);
	};

	return (
		<div className="group relative">
			<button
				type="button"
				onClick={onOpen}
				className="w-full aspect-video rounded-xl border border-neutral-800 hover:border-emerald-500/60 bg-neutral-950 overflow-hidden flex flex-col text-left transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(16,185,129,0.18)]"
			>
				<div className="flex-1 min-h-0 bg-black relative overflow-hidden">
					{firstScene ? (
						<SceneThumbnail scene={firstScene} />
					) : (
						<div className="w-full h-full flex items-center justify-center text-neutral-700">
							<Film className="h-10 w-10" />
						</div>
					)}
					<div className="absolute top-1.5 right-1.5 flex items-center gap-1 px-1.5 py-0.5 rounded bg-black/65 backdrop-blur-sm text-[10px] text-neutral-300 border border-neutral-800">
						{portrait ? (
							<Smartphone className="h-2.5 w-2.5" />
						) : (
							<Monitor className="h-2.5 w-2.5" />
						)}
						<span>
							{project.width}×{project.height}
						</span>
					</div>
				</div>
				<div className="px-3 py-2 border-t border-neutral-800/60 bg-neutral-925">
					{renaming ? (
						<input
							ref={renameRef}
							value={draftName}
							onChange={(e) => setDraftName(e.target.value)}
							onClick={(e) => e.stopPropagation()}
							onKeyDown={(e) => {
								e.stopPropagation();
								if (e.key === "Enter") commitRename();
								else if (e.key === "Escape") {
									setRenaming(false);
									setDraftName(project.name);
								}
							}}
							onBlur={commitRename}
							className="w-full bg-transparent text-sm font-semibold text-white outline-none border-b border-emerald-500/60 pb-0.5"
						/>
					) : (
						<div className="text-sm font-semibold text-white truncate">
							{project.name || "Untitled"}
						</div>
					)}
					<div className="flex items-center gap-2 text-[10px] text-neutral-500 font-mono">
						<span>
							{sceneCount} scene{sceneCount === 1 ? "" : "s"}
						</span>
						{sceneCount > 0 && <span>· {fmtDur(totalSec)}</span>}
						<span className="ml-auto flex items-center gap-1">
							<Clock className="h-2.5 w-2.5" />
							{fmtRel(updatedAt)}
						</span>
					</div>
				</div>
			</button>
			<button
				type="button"
				onClick={(e) => {
					e.stopPropagation();
					setMenuOpen((v) => !v);
				}}
				className="absolute top-1.5 left-1.5 opacity-0 group-hover:opacity-100 p-1 rounded bg-black/65 backdrop-blur-sm border border-neutral-800 text-neutral-400 hover:text-white"
				aria-label="Project options"
			>
				<MoreVertical className="h-3 w-3" />
			</button>
			{menuOpen && (
				<>
					<button
						type="button"
						aria-label="close menu"
						onClick={() => setMenuOpen(false)}
						className="fixed inset-0 z-10 cursor-default"
					/>
					<div className="absolute top-8 left-1.5 z-20 w-44 rounded-md border border-neutral-700 bg-neutral-900 shadow-[0_8px_24px_rgba(0,0,0,0.45)] py-1 motion-pop">
						<button
							type="button"
							onClick={startRename}
							className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-neutral-300 hover:bg-neutral-800 hover:text-white"
						>
							<Pencil className="h-3 w-3" />
							Rename
						</button>
						<button
							type="button"
							onClick={handleDuplicate}
							className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-neutral-300 hover:bg-neutral-800 hover:text-white"
						>
							<Copy className="h-3 w-3" />
							Duplicate
						</button>
						<div className="my-1 border-t border-neutral-800" />
						<button
							type="button"
							onClick={handleDelete}
							className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10 hover:text-red-300"
						>
							<Trash2 className="h-3 w-3" />
							Move to trash
						</button>
					</div>
				</>
			)}
		</div>
	);
}
