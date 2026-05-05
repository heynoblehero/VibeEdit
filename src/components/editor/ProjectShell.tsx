"use client";

import { CalendarClock, Film, ListVideo, Redo2, Smartphone, Undo2 } from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { AspectSwitcher } from "@/components/editor/AspectSwitcher";
import { AuthBar } from "@/components/editor/AuthBar";
import { DevBadge } from "@/components/editor/DevBadge";
import { ExportPackButton } from "@/components/editor/ExportPackButton";
import { HeaderOverflow } from "@/components/editor/HeaderOverflow";
import { KeyboardShortcuts } from "@/components/editor/KeyboardShortcuts";
import { MediaLibraryTrigger } from "@/components/editor/MediaLibrary";
import { PageTitleSync } from "@/components/editor/PageTitleSync";
import { PasteImage } from "@/components/editor/PasteImage";
import { ProjectDropImport } from "@/components/editor/ProjectDropImport";
import { ProjectIO } from "@/components/editor/ProjectIO";
import { ProjectStats } from "@/components/editor/ProjectStats";
import { ProjectSwitcher } from "@/components/editor/ProjectSwitcher";
import { RenderButton } from "@/components/editor/RenderButton";
import { SaveIndicator } from "@/components/editor/SaveIndicator";
import { SceneEditor } from "@/components/editor/SceneEditor";
import { SceneList } from "@/components/editor/SceneList";
import { ScheduleRenderDialog } from "@/components/editor/ScheduleRenderDialog";
import { SearchScenes } from "@/components/editor/SearchScenes";
import { ShortcutHelp } from "@/components/editor/ShortcutHelp";
import { ShortcutsOverlay } from "@/components/editor/ShortcutsOverlay";
import { SubtitleExportButton } from "@/components/editor/SubtitleExportButton";
import { ThemeToggle } from "@/components/editor/ThemeToggle";
import { ThumbnailExporter } from "@/components/editor/ThumbnailExporter";
import { useEditorStore } from "@/store/editor-store";
import { useProjectStore } from "@/store/project-store";
import { useRenderQueueStore } from "@/store/render-queue-store";
import { toast } from "@/lib/toast";
import { WorkspaceErrorBoundary } from "@/components/shell/WorkspaceErrorBoundary";
import { ActivityIndicator } from "@/components/editor/ActivityIndicator";
import { AiStatusIndicator } from "@/components/editor/AiStatusIndicator";
import { AutoSaveIndicator } from "@/components/editor/AutoSaveIndicator";
import { BulkSceneBar } from "@/components/editor/BulkSceneBar";
import { OnboardingTour } from "@/components/editor/OnboardingTour";
import { MobileDrawer } from "@/components/mobile/MobileDrawer";

const Preview = dynamic(
	() => import("@/components/editor/Preview").then((m) => m.Preview),
	{
		ssr: false,
		loading: () => (
			<div className="flex items-center justify-center h-full bg-black text-neutral-600 text-sm rounded-lg">
				Loading preview engine...
			</div>
		),
	},
);

// ImageEditor is mounted always-on (overlay opens on demand) but the
// canvas stack is heavy. Defer its bundle until the first paint settles.
const ImageEditor = dynamic(
	() => import("@/components/editor/ImageEditor").then((m) => m.ImageEditor),
	{ ssr: false },
);

/**
 * The full editor experience for a single project: topbar, scene list,
 * preview, scene editor. Mounted at /projects/[id] — the [id] page is
 * responsible for switching the active project before this renders.
 */
export function ProjectShell() {
	const project = useProjectStore((s) => s.project);
	const createProject = useProjectStore((s) => s.createProject);
	const undoRaw = useProjectStore((s) => s.undo);
	const redoRaw = useProjectStore((s) => s.redo);
	const historyLen = useProjectStore((s) => s.history.length);
	const futureLen = useProjectStore((s) => s.future.length);
	const canUndo = historyLen > 0;
	const canRedo = futureLen > 0;
	// Wrap undo/redo so the user gets visual confirmation. Without
	// this, a Cmd+Z silently flips state and the user wonders if it
	// worked. The toast is short + low-contrast.
	const undo = () => {
		if (!canUndo) return;
		undoRaw();
		toast.info("Undone", { description: `${historyLen - 1} step${historyLen === 1 ? "" : "s"} left` });
	};
	const redo = () => {
		if (!canRedo) return;
		redoRaw();
		toast.info("Redone");
	};
	const selectedSceneId = useProjectStore((s) => s.selectedSceneId);
	const queueCount = useRenderQueueStore((s) => s.items.length);
	const toggleQueue = useRenderQueueStore((s) => s.togglePanel);

	const [scheduleOpen, setScheduleOpen] = useState(false);

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "n") {
				e.preventDefault();
				createProject();
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [createProject]);

	// Layout: users can collapse the scene list / editor panels for focused
	// work. Persisted to localStorage so preference survives reloads.
	const [leftCollapsed, setLeftCollapsedState] = useState(false);
	const zenMode = useEditorStore((s) => s.zenMode);
	const [rightCollapsed, setRightCollapsedState] = useState(false);
	// Phone shell — under 720px the rails don't fit side-by-side, so we
	// flip them to summon-on-demand drawers. The editor body always
	// owns the full width on phones.
	const [phoneMode, setPhoneMode] = useState(false);
	const [leftDrawerOpen, setLeftDrawerOpen] = useState(false);
	const [rightDrawerOpen, setRightDrawerOpen] = useState(false);

	// Auto-collapse the side panes below common viewport breakpoints so
	// the editor stays usable on a 13" laptop / split window. Crosses
	// the threshold once per resize — explicit user toggles still win
	// because we only force-collapse if the user hasn't already chosen.
	useEffect(() => {
		const onResize = () => {
			const w = window.innerWidth;
			setPhoneMode(w < 720);
			try {
				if (window.localStorage.getItem("vibeedit:right-collapsed") === null) {
					setRightCollapsedState(w < 1280);
				}
				if (window.localStorage.getItem("vibeedit:left-collapsed") === null) {
					setLeftCollapsedState(w < 1024);
				}
			} catch {
				// best-effort
			}
		};
		onResize();
		window.addEventListener("resize", onResize);
		return () => window.removeEventListener("resize", onResize);
	}, []);
	const setLeftCollapsed = (v: boolean) => {
		setLeftCollapsedState(v);
		try {
			window.localStorage.setItem("vibeedit:left-collapsed", String(v));
		} catch {}
	};
	const setRightCollapsed = (v: boolean) => {
		setRightCollapsedState(v);
		try {
			window.localStorage.setItem("vibeedit:right-collapsed", String(v));
		} catch {}
	};
	useEffect(() => {
		try {
			if (window.localStorage.getItem("vibeedit:left-collapsed") === "true")
				setLeftCollapsedState(true);
			if (window.localStorage.getItem("vibeedit:right-collapsed") === "true")
				setRightCollapsedState(true);
		} catch {}
	}, []);

	return (
		<div
			className="flex flex-col h-screen text-neutral-100"
			style={{
				background: "linear-gradient(180deg, #0a0a0a 0%, #0a0a0a 60%, #060606 100%)",
			}}
		>
			<KeyboardShortcuts />
			<ShortcutHelp />
			<SearchScenes />
			<ProjectDropImport />
			<PasteImage />
			<PageTitleSync />

			<header
				className="relative flex items-center justify-between px-2 sm:px-4 py-2 gap-2 border-b border-neutral-800 bg-neutral-950/70 backdrop-blur-md shrink-0"
			>
				<div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-emerald-500/0 via-emerald-500/60 to-emerald-500/0" />
				<div className="flex items-center gap-2 min-w-0">
					<a
						href="/dashboard"
						title="Back to projects"
						aria-label="Back to projects"
						className="shrink-0"
					>
						<Film className="h-5 w-5 text-emerald-400" aria-label="VibeEdit" />
					</a>
					<DevBadge />
					<ProjectSwitcher />
					<AutoSaveIndicator />
					<ActivityIndicator />
					<AiStatusIndicator />
					<ProjectStats />
					<AspectSwitcher />
				</div>
				<div className="flex items-center gap-1 sm:gap-3">
					<div className="flex items-center gap-1">
						<button
							onClick={undo}
							disabled={!canUndo}
							title={`Undo (Cmd/Ctrl+Z) — ${historyLen} step${historyLen === 1 ? "" : "s"}`}
							className="p-1.5 rounded-md text-neutral-400 hover:text-white hover:bg-neutral-800 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
						>
							<Undo2 className="h-4 w-4" aria-label="Undo" />
						</button>
						<button
							onClick={redo}
							disabled={!canRedo}
							title={`Redo (Shift+Cmd/Ctrl+Z) — ${futureLen} step${futureLen === 1 ? "" : "s"}`}
							className="p-1.5 rounded-md text-neutral-400 hover:text-white hover:bg-neutral-800 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
						>
							<Redo2 className="h-4 w-4" aria-label="Redo" />
						</button>
					</div>
					<MediaLibraryTrigger />
					<a
						href="/download"
						title="Get VibeEdit as an app"
						className="hidden sm:flex items-center gap-1 text-[11px] text-neutral-400 hover:text-emerald-300 transition-colors px-1.5 py-0.5"
					>
						<Smartphone className="h-3.5 w-3.5" />
						<span>Get the app</span>
					</a>
					<button
						onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "?" }))}
						title="Keyboard shortcuts (?)"
						aria-label="Keyboard shortcuts"
						className="hidden md:flex items-center justify-center w-7 h-7 rounded-md text-neutral-500 hover:text-white hover:bg-neutral-800 transition-colors text-sm font-mono"
					>
						?
					</button>
					<button
						onClick={toggleQueue}
						title="Render queue"
						className="relative p-1.5 rounded-md text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
					>
						<ListVideo className="h-4 w-4" aria-label="Render queue" />
						{queueCount > 0 && (
							<span className="absolute -top-0.5 -right-0.5 text-[9px] font-bold bg-emerald-500 text-black rounded-full w-3.5 h-3.5 flex items-center justify-center">
								{queueCount}
							</span>
						)}
					</button>
					<SaveIndicator />
					<AuthBar />
					<HeaderOverflow>
						<ThemeToggle />
						<ProjectIO />
						<ThumbnailExporter />
						<ExportPackButton />
						<SubtitleExportButton />
						<button
							onClick={() => setScheduleOpen(true)}
							disabled={project.scenes.length === 0}
							title="Schedule a render for later"
							className="flex items-center gap-2 px-2 py-1.5 rounded text-xs text-neutral-300 hover:bg-neutral-800 disabled:opacity-30"
						>
							<CalendarClock className="h-3.5 w-3.5" />
							<span>Schedule</span>
						</button>
					</HeaderOverflow>
					<RenderButton />
				</div>
			</header>

			<WorkspaceErrorBoundary label="Video" accent="video">
			<div key="video" className="flex flex-1 min-h-0 motion-fade">
				{phoneMode && project.scenes.length > 0 && (
					<button
						onClick={() => setLeftDrawerOpen(true)}
						title="Show scene list"
						className="shrink-0 px-1 border-r border-neutral-800 text-neutral-500 hover:text-emerald-200 hover:bg-emerald-500/10 text-xs"
					>
						›
					</button>
				)}
				{!phoneMode && !zenMode && project.scenes.length > 0 && !leftCollapsed && (
					<div data-onboard="scene-list" className="w-80 flex flex-col border-r border-neutral-800 shrink-0 overflow-hidden relative">
						<button
							onClick={() => setLeftCollapsed(true)}
							title="Collapse scene list"
							className="absolute top-1 right-1 z-10 text-[10px] text-neutral-600 hover:text-white px-1"
						>
							‹
						</button>
						<div className="flex-1 overflow-y-auto">
							<SceneList />
						</div>
					</div>
				)}

				{!phoneMode && project.scenes.length > 0 && leftCollapsed && (
					<button
						onClick={() => setLeftCollapsed(false)}
						title="Show scene list"
						className="shrink-0 px-1 border-r border-neutral-800 text-neutral-500 hover:text-emerald-200 hover:bg-emerald-500/10 text-xs"
					>
						›
					</button>
				)}

				<div
					className="flex-1 flex flex-col p-4 min-w-0"
					onClick={(e) => {
						if (e.target === e.currentTarget) {
							useProjectStore.getState().clearSelection();
						}
					}}
				>
					<div data-onboard="preview" className="flex-1 min-h-0">
						<Preview />
					</div>
				</div>

				{!phoneMode && selectedSceneId &&
					project.scenes.some((s) => s.id === selectedSceneId) &&
					!rightCollapsed && (
						<div
							data-scene-editor
							className="w-72 border-l border-neutral-800 shrink-0 flex flex-col relative"
						>
							<div className="sticky top-0 z-10 flex items-center justify-between px-3 py-2 border-b border-neutral-800 bg-neutral-900 shrink-0">
								<span className="text-[11px] uppercase tracking-wider text-emerald-300 font-semibold">
									Properties
								</span>
								<button
									onClick={() => setRightCollapsed(true)}
									title="Collapse properties"
									className="text-[10px] text-neutral-600 hover:text-white px-1"
								>
									›
								</button>
							</div>
							<div className="flex-1 overflow-y-auto">
								<SceneEditor />
							</div>
						</div>
					)}
				{!phoneMode && selectedSceneId &&
					project.scenes.some((s) => s.id === selectedSceneId) &&
					rightCollapsed && (
						<button
							onClick={() => setRightCollapsed(false)}
							title="Show scene editor"
							className="shrink-0 px-1 border-l border-neutral-800 text-neutral-500 hover:text-emerald-200 hover:bg-emerald-500/10 text-xs"
						>
							‹
						</button>
					)}
				{phoneMode && selectedSceneId &&
					project.scenes.some((s) => s.id === selectedSceneId) && (
						<button
							onClick={() => setRightDrawerOpen(true)}
							title="Show scene editor"
							className="shrink-0 px-1 border-l border-neutral-800 text-neutral-500 hover:text-emerald-200 hover:bg-emerald-500/10 text-xs"
						>
							‹
						</button>
					)}
			</div>
			</WorkspaceErrorBoundary>

			<ImageEditor />
			<BulkSceneBar />
			<OnboardingTour />
			<ScheduleRenderDialog open={scheduleOpen} onClose={() => setScheduleOpen(false)} />
			<ShortcutsOverlay />
			{phoneMode ? (
				<>
					<MobileDrawer
						open={leftDrawerOpen}
						side="left"
						onClose={() => setLeftDrawerOpen(false)}
						title="Scenes"
					>
						<SceneList />
					</MobileDrawer>
					<MobileDrawer
						open={rightDrawerOpen}
						side="right"
						onClose={() => setRightDrawerOpen(false)}
						title="Properties"
					>
						{selectedSceneId &&
						project.scenes.some((s) => s.id === selectedSceneId) ? (
							<SceneEditor />
						) : null}
					</MobileDrawer>
				</>
			) : null}
		</div>
	);
}
