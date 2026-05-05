"use client";

import { Film, Plus, RotateCcw, Search, Smartphone, SortDesc, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Skeleton } from "@/components/ui/Skeleton";
import { cls } from "@/lib/design/tokens";
import type { Project } from "@/lib/scene-schema";
import { toast } from "@/lib/toast";
import { useProjectStore } from "@/store/project-store";
import { ProjectTile } from "./ProjectTile";
import { StorageQuota } from "./StorageQuota";

const TRASH_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Landing surface at /dashboard. Lists every project from
 * useProjectStore.projects, sorted by recency. Click → /projects/[id].
 *
 * The "+ New" tile wires through `createProject()` then navigates;
 * the empty-state ProjectChooser renders inside the editor when the
 * fresh project has no scenes yet.
 */
export function ProjectDashboard() {
	const projects = useProjectStore((s) => s.projects);
	const createProject = useProjectStore((s) => s.createProject);
	const switchProject = useProjectStore((s) => s.switchProject);
	const restoreProject = useProjectStore((s) => s.restoreProject);
	const purgeProject = useProjectStore((s) => s.purgeProject);
	const emptyTrash = useProjectStore((s) => s.emptyTrash);
	const router = useRouter();
	const [query, setQuery] = useState("");
	const [sort, setSort] = useState<"recent" | "name">("recent");
	const [view, setView] = useState<"live" | "trash">("live");
	// Hydration flicker fix: Zustand persist rehydrates on mount, so on
	// first paint `projects` is `{}` even when localStorage has them.
	// Track our own mount tick to render skeletons for one frame.
	const [mounted, setMounted] = useState(false);
	useEffect(() => {
		setMounted(true);
	}, []);

	// Auto-purge anything that's been in trash > 30 days. Runs once on
	// mount; users dropping in fresh trash today aren't touched.
	useEffect(() => {
		const cutoff = Date.now() - TRASH_RETENTION_MS;
		for (const p of Object.values(projects)) {
			if (p.deletedAt && p.deletedAt < cutoff) purgeProject(p.id);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const allProjects: Project[] = Object.values(projects);
	const livePool = useMemo(
		() => allProjects.filter((p) => !p.deletedAt),
		[allProjects],
	);
	const trashPool = useMemo(
		() => allProjects.filter((p) => p.deletedAt),
		[allProjects],
	);
	const pool = view === "trash" ? trashPool : livePool;
	const filtered = pool.filter((p) =>
		query.trim() ? p.name.toLowerCase().includes(query.toLowerCase()) : true,
	);
	const sorted = [...filtered].sort((a, b) => {
		if (sort === "name") return a.name.localeCompare(b.name);
		const aT = view === "trash" ? (a.deletedAt ?? 0) : (a.updatedAt ?? 0);
		const bT = view === "trash" ? (b.deletedAt ?? 0) : (b.updatedAt ?? 0);
		if (aT !== bT) return bT - aT;
		return b.id.localeCompare(a.id);
	});

	const handleRestore = (p: Project) => {
		restoreProject(p.id);
		toast.success("Restored", { description: `"${p.name}" is back.` });
	};
	const handlePurge = (p: Project) => {
		purgeProject(p.id);
		toast.info("Project deleted", { description: `"${p.name}" purged.` });
	};
	const handleEmptyTrash = () => {
		const n = trashPool.length;
		if (n === 0) return;
		emptyTrash();
		toast.info(`Trash emptied`, { description: `${n} project${n === 1 ? "" : "s"} removed.` });
	};

	const handleNew = () => {
		const id = createProject();
		router.push(`/projects/${id}`);
	};

	const handleOpen = (id: string) => {
		switchProject(id);
		router.push(`/projects/${id}`);
	};

	return (
		<div
			className="min-h-screen text-neutral-100"
			style={{
				background:
					"linear-gradient(180deg, #0a0a0a 0%, #0a0a0a 60%, #060606 100%)",
			}}
		>
			<header className="px-4 sm:px-8 py-5 border-b border-neutral-800/60 flex items-center gap-3 sticky top-0 z-10 bg-neutral-950/70 backdrop-blur-md">
				<Film className="h-6 w-6 text-emerald-400" />
				<div className="flex-1 min-w-0">
					<h1 className="text-lg font-bold text-white">VibeEdit</h1>
					<div className="text-[11px] text-neutral-500 flex items-center gap-2">
						<button
							type="button"
							onClick={() => setView("live")}
							className={view === "live" ? "text-emerald-300" : "hover:text-neutral-300"}
						>
							{livePool.length} project{livePool.length === 1 ? "" : "s"}
						</button>
						{trashPool.length > 0 ? (
							<>
								<span className="text-neutral-700">·</span>
								<button
									type="button"
									onClick={() => setView("trash")}
									className={cls(
										"flex items-center gap-1",
										view === "trash"
											? "text-red-300"
											: "hover:text-neutral-300",
									)}
								>
									<Trash2 className="h-3 w-3" />
									Trash ({trashPool.length})
								</button>
							</>
						) : null}
						<span className="text-neutral-700">·</span>
						<StorageQuota />
					</div>
				</div>
				<div className="relative w-72 max-w-[40vw]">
					<Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-500" />
					<input
						type="search"
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						placeholder="Search projects…"
						className="w-full text-sm pl-8 pr-3 py-2 rounded-md bg-neutral-900 border border-neutral-800 text-neutral-200 focus:border-emerald-500 focus:outline-none"
					/>
				</div>
				<button
					type="button"
					onClick={() => setSort(sort === "recent" ? "name" : "recent")}
					className="flex items-center gap-1.5 px-2.5 py-2 rounded-md border border-neutral-800 text-xs text-neutral-400 hover:text-white hover:border-neutral-600"
					title={`Sort: ${sort}`}
				>
					<SortDesc className="h-3.5 w-3.5" />
					<span>{sort === "recent" ? "Recent" : "Name"}</span>
				</button>
				<Link
					href="/download"
					className="flex items-center gap-1.5 px-2.5 py-2 rounded-md border border-emerald-700/40 bg-emerald-500/5 text-xs text-emerald-300 hover:bg-emerald-500/10 hover:border-emerald-500/60"
					title="Install on phone or download Android APK"
				>
					<Smartphone className="h-3.5 w-3.5" />
					<span className="hidden sm:inline">Get the app</span>
				</Link>
				{view === "trash" ? (
					<button
						type="button"
						onClick={handleEmptyTrash}
						disabled={trashPool.length === 0}
						className="flex items-center gap-1.5 px-3 py-2 rounded-md bg-red-500/20 hover:bg-red-500/30 text-red-200 text-sm font-semibold disabled:opacity-40"
					>
						<Trash2 className="h-4 w-4" />
						Empty trash
					</button>
				) : (
					<button
						type="button"
						onClick={handleNew}
						className="flex items-center gap-1.5 px-3 py-2 rounded-md bg-emerald-500 hover:bg-emerald-400 text-neutral-950 text-sm font-semibold"
					>
						<Plus className="h-4 w-4" />
						New project
					</button>
				)}
			</header>

			<main className="px-4 sm:px-8 py-8">
				{!mounted && (
					<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
						{Array.from({ length: 6 }).map((_, i) => (
							<div key={i} className="space-y-2">
								<Skeleton className="aspect-video w-full" rounded="lg" />
								<Skeleton className="h-3 w-3/4" rounded="sm" />
								<Skeleton className="h-2 w-1/2" rounded="sm" />
							</div>
						))}
					</div>
				)}
				{mounted && sorted.length === 0 && (
					<div className="flex flex-col items-center justify-center text-center py-24 gap-4">
						<div className="h-20 w-20 rounded-2xl border-2 border-dashed border-neutral-700 flex items-center justify-center">
							{view === "trash" ? (
								<Trash2 className="h-8 w-8 text-neutral-600" />
							) : (
								<Film className="h-8 w-8 text-neutral-600" />
							)}
						</div>
						<div>
							<h2 className="text-xl font-semibold text-white mb-1">
								{view === "trash"
									? "Trash is empty"
									: query
										? "No matches"
										: "No projects yet"}
							</h2>
							<p className="text-sm text-neutral-500 max-w-sm">
								{view === "trash"
									? "Deleted projects show up here for 30 days before they're purged."
									: query
										? `Nothing matches "${query}". Clear the search to see your projects.`
										: "Start with a Shorts/Reel, a YouTube video, or a custom canvas."}
							</p>
						</div>
						{view === "live" && !query && (
							<button
								type="button"
								onClick={handleNew}
								className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-emerald-500 hover:bg-emerald-400 text-neutral-950 text-sm font-semibold"
							>
								<Plus className="h-4 w-4" />
								Create your first project
							</button>
						)}
					</div>
				)}

				{mounted && sorted.length > 0 && view === "live" && (
					<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
						<button
							type="button"
							onClick={handleNew}
							className="aspect-video rounded-xl border-2 border-dashed border-neutral-700 hover:border-emerald-400 hover:bg-emerald-500/5 flex flex-col items-center justify-center gap-2 text-neutral-500 hover:text-emerald-200 transition-colors"
						>
							<Plus className="h-7 w-7" />
							<span className="text-sm font-semibold">New project</span>
						</button>
						{sorted.map((p) => (
							<ProjectTile
								key={p.id}
								project={p}
								onOpen={() => handleOpen(p.id)}
							/>
						))}
					</div>
				)}

				{mounted && sorted.length > 0 && view === "trash" && (
					<div className="space-y-2">
						<div className="text-[11px] text-neutral-500">
							Trashed projects are kept for 30 days, then auto-deleted. Restore to bring them back.
						</div>
						<div className="flex flex-col gap-1.5">
							{sorted.map((p) => {
								const days = Math.max(
									0,
									Math.ceil(
										(TRASH_RETENTION_MS - (Date.now() - (p.deletedAt ?? 0))) /
											(24 * 60 * 60 * 1000),
									),
								);
								return (
									<div
										key={p.id}
										className="flex items-center gap-3 px-3 py-2 rounded-lg bg-neutral-900/60 border border-neutral-800"
									>
										<Trash2 className="h-4 w-4 text-neutral-500 shrink-0" />
										<div className="flex-1 min-w-0">
											<div className="text-sm text-neutral-100 truncate">
												{p.name || "Untitled"}
											</div>
											<div className="text-[10px] text-neutral-500">
												{p.scenes.length} scene{p.scenes.length === 1 ? "" : "s"} ·
												auto-purges in {days} day{days === 1 ? "" : "s"}
											</div>
										</div>
										<button
											type="button"
											onClick={() => handleRestore(p)}
											className="flex items-center gap-1 px-2 py-1 rounded text-[11px] text-emerald-200 hover:bg-emerald-500/10"
										>
											<RotateCcw className="h-3 w-3" />
											Restore
										</button>
										<button
											type="button"
											onClick={() => handlePurge(p)}
											className="flex items-center gap-1 px-2 py-1 rounded text-[11px] text-neutral-500 hover:text-red-300 hover:bg-red-500/10"
										>
											<X className="h-3 w-3" />
											Delete
										</button>
									</div>
								);
							})}
						</div>
					</div>
				)}
			</main>
		</div>
	);
}
