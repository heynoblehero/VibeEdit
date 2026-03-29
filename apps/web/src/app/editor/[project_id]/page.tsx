"use client";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { ChatPanel } from "@/components/editor/panels/chat";
import { Timeline } from "@/components/editor/panels/timeline";
import { PreviewPanel } from "@/components/editor/panels/preview";
import { EditorProvider } from "@/components/providers/editor-provider";
import { Onboarding } from "@/components/editor/onboarding";
import { OnboardingTour } from "@/components/editor/onboarding-tour";
import { ShortcutsModal } from "@/components/editor/shortcuts-modal";
import { MigrationDialog } from "@/components/editor/dialogs/migration-dialog";
import { usePasteMedia } from "@/hooks/use-paste-media";
import { MobileGate } from "@/components/editor/mobile-gate";
import { ExportButton } from "@/components/editor/export-button";
import { CreditsBadge } from "@/components/editor/credits-badge";
import { RenderingOverlay } from "@/components/editor/panels/preview/rendering-overlay";
import { useAIChat } from "@/hooks/use-ai-chat";
import { useEditor } from "@/hooks/use-editor";
import { Layers, Settings, ChevronDown, Camera, Download, Scissors, Clapperboard, Smile, Sparkles } from "lucide-react";
import { RecordingPanel } from "@/components/editor/recording/recording-panel";
import { useRecordingStore } from "@/stores/recording-store";
import { ClipperPanel } from "@/components/editor/clipper/clipper-panel";
import { useClipperStore } from "@/stores/clipper-store";
import { StoryboardPanel } from "@/components/editor/storyboard/storyboard-panel";
import { useStoryboardStore } from "@/stores/storyboard-store";
import { AvatarPanel } from "@/components/editor/avatar/avatar-panel";
import { useAvatarStore } from "@/stores/avatar-store";

export default function Editor() {
	const params = useParams();
	const projectId = params.project_id as string;

	return (
		<MobileGate>
			<EditorProvider projectId={projectId}>
				<EditorLayout />
				<Onboarding />
				<MigrationDialog />
				<OnboardingTour />
				<ShortcutsModal />
			</EditorProvider>
		</MobileGate>
	);
}

function formatTime(seconds: number): string {
	const m = Math.floor(seconds / 60);
	const s = Math.floor(seconds % 60);
	return `${m}:${s.toString().padStart(2, "0")}`;
}

function TimelineScrubber() {
	const editor = useEditor();
	const currentTime = editor.playback.getCurrentTime();
	const totalDuration = editor.timeline.getTotalDuration() || 1;
	const progress = (currentTime / totalDuration) * 100;
	const isPlaying = editor.playback.getIsPlaying();

	return (
		<div className="shrink-0 px-4 py-2.5 flex items-center gap-3 bg-card/40 backdrop-blur-sm border-t border-border/30">
			<button
				onClick={() => editor.playback.toggle()}
				className="flex items-center justify-center h-7 w-7 rounded-full gradient-primary text-white hover:shadow-[0_0_12px_hsl(262_83%_58%/0.3)] transition-all duration-200"
			>
				{isPlaying ? (
					<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
				) : (
					<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
				)}
			</button>
			<div
				className="flex-1 h-1.5 bg-border/40 rounded-full overflow-hidden cursor-pointer group"
				onClick={(e) => {
					const rect = e.currentTarget.getBoundingClientRect();
					const pct = (e.clientX - rect.left) / rect.width;
					editor.playback.seek({ time: pct * totalDuration });
				}}
			>
				<div
					className="h-full rounded-full transition-all gradient-primary group-hover:shadow-[0_0_8px_hsl(262_83%_58%/0.3)]"
					style={{ width: `${progress}%` }}
				/>
			</div>
			<span className="text-[11px] text-muted-foreground tabular-nums font-mono">
				{formatTime(currentTime)} / {formatTime(totalDuration)}
			</span>
		</div>
	);
}

function AssetDropdown() {
	const editor = useEditor();
	const [open, setOpen] = useState(false);
	const [assets, setAssets] = useState<Array<{ id: string; name: string; type: string; duration?: number; width?: number; height?: number; url?: string; file?: File }>>([]);
	const dropdownRef = useRef<HTMLDivElement>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		const update = () => {
			const all = editor.media.getAssets();
			setAssets(all.map(a => ({ id: a.id, name: a.name, type: a.type, duration: a.duration, width: a.width, height: a.height, url: a.url, file: a.file })));
		};
		update();
		const unsub = editor.media.subscribe(update);
		return unsub;
	}, [editor]);

	const handleDownload = (asset: { name: string; url?: string; file?: File }) => {
		let downloadUrl = asset.url;
		if (!downloadUrl && asset.file) {
			downloadUrl = URL.createObjectURL(asset.file);
		}
		if (!downloadUrl) return;
		const a = document.createElement("a");
		a.href = downloadUrl;
		a.download = asset.name;
		a.click();
		if (!asset.url && downloadUrl) URL.revokeObjectURL(downloadUrl);
	};

	useEffect(() => {
		if (!open) return;
		const handler = (e: MouseEvent) => {
			if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setOpen(false);
		};
		document.addEventListener("mousedown", handler);
		return () => document.removeEventListener("mousedown", handler);
	}, [open]);

	const handleFiles = async (files: File[]) => {
		const activeProject = editor.project.getActive();
		if (!activeProject) return;
		const { processMediaAssets } = await import("@/lib/media/processing");
		const processed = await processMediaAssets({ files, onProgress: () => {} });
		for (const asset of processed) {
			await editor.media.addMediaAsset({ projectId: activeProject.metadata.id, asset });
		}
	};

	const icon = (type: string) => type === "video" ? "\u{1F3AC}" : type === "audio" ? "\u{1F3B5}" : "\u{1F5BC}\uFE0F";

	return (
		<div className="relative" ref={dropdownRef}>
			<button
				onClick={() => setOpen(v => !v)}
				className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-all duration-200"
			>
				<Layers className="h-3.5 w-3.5" />
				Assets{assets.length > 0 ? ` (${assets.length})` : ""}
				<ChevronDown className={`h-3 w-3 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
			</button>

			{open && (
				<div className="absolute top-full left-0 mt-1 w-64 rounded-xl border border-border/40 bg-card/90 backdrop-blur-xl shadow-lg z-50 overflow-hidden">
					{assets.length === 0 ? (
						<div className="p-4 text-center text-xs text-muted-foreground">
							No media attached yet.<br />Use the chat to attach files.
						</div>
					) : (
						<div className="max-h-48 overflow-y-auto scrollbar-thin">
							{assets.map(a => (
								<div key={a.id} className="group flex items-center gap-2 px-3 py-2 text-xs hover:bg-accent/50 transition-colors">
									<span>{icon(a.type)}</span>
									<span className="font-medium text-foreground truncate flex-1">{a.name}</span>
									<span className="text-muted-foreground shrink-0">
										{a.type}{a.duration ? ` \u00B7 ${a.duration.toFixed(1)}s` : ""}{a.width ? ` \u00B7 ${a.width}\u00D7${a.height}` : ""}
									</span>
									<button
										onClick={(e) => { e.stopPropagation(); handleDownload(a); }}
										className="opacity-0 group-hover:opacity-100 shrink-0 rounded p-1 text-muted-foreground hover:text-foreground hover:bg-accent transition-all"
										title={`Download ${a.name}`}
									>
										<Download className="h-3 w-3" />
									</button>
								</div>
							))}
						</div>
					)}
					<div className="border-t border-border/30 p-2">
						<button
							onClick={() => fileInputRef.current?.click()}
							className="w-full rounded-lg px-3 py-1.5 text-xs text-primary hover:bg-primary/5 transition-colors text-center font-medium"
						>
							+ Attach files
						</button>
						<input ref={fileInputRef} type="file" className="hidden" multiple accept="image/*,video/*,audio/*,.zip,.cube,.3dl,.psd,.json,.srt,.vtt,.ttf,.otf,.woff2,.edl,.xml,.fcpxml,.vibeedit"
							onChange={async (e) => { const f = Array.from(e.target.files || []); if (f.length) await handleFiles(f); e.target.value = ""; setOpen(false); }} />
					</div>
				</div>
			)}
		</div>
	);
}

function ToolButton({ onClick, icon: Icon, label, active }: { onClick: () => void; icon: React.ComponentType<{ className?: string }>; label: string; active?: boolean }) {
	return (
		<button
			onClick={onClick}
			className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all duration-200 ${
				active
					? "text-primary bg-primary/10 shadow-[0_0_8px_hsl(262_83%_58%/0.1)]"
					: "text-muted-foreground hover:text-foreground hover:bg-accent/50"
			}`}
		>
			<Icon className="h-3.5 w-3.5" />
			{label}
		</button>
	);
}

function EditorLayout() {
	usePasteMedia();

	const [advancedView, setAdvancedView] = useState(false);
	const { isLoading } = useAIChat();
	const openRecording = useRecordingStore((s) => s.open);
	const openClipper = useClipperStore((s) => s.open);
	const openStoryboard = useStoryboardStore((s) => s.open);
	const openAvatar = useAvatarStore((s) => s.open);

	return (
		<div className="flex h-screen bg-background overflow-hidden">
			{/* LEFT: Chat */}
			<div className="w-[60%] shrink-0 border-r border-border/30 overflow-hidden">
				<ChatPanel />
			</div>

			{/* RIGHT: Preview + controls */}
			<div className="flex-1 flex flex-col min-w-0 overflow-hidden">
				{/* Top toolbar */}
				<div className="shrink-0 border-b border-border/30 px-3 py-1.5 flex items-center justify-between glass-strong">
					<div className="flex items-center gap-1">
						<div className="flex h-6 w-6 items-center justify-center rounded-md gradient-primary mr-1">
							<Sparkles className="h-3 w-3 text-white" />
						</div>
						<AssetDropdown />
					</div>
					<div className="flex items-center gap-1">
						<ToolButton onClick={() => openRecording()} icon={Camera} label="Record" />
						<ToolButton onClick={() => openClipper()} icon={Scissors} label="Auto Clip" />
						<ToolButton onClick={() => openStoryboard()} icon={Clapperboard} label="Storyboard" />
						<ToolButton onClick={() => openAvatar()} icon={Smile} label="Avatar" />
						<ToolButton onClick={() => setAdvancedView((v) => !v)} icon={Layers} label="Timeline" active={advancedView} />
						<div className="w-px h-4 bg-border/30 mx-1" />
						<CreditsBadge />
						<ExportButton />
						<a
							href="/settings"
							target="_blank"
							rel="noopener noreferrer"
							className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-all duration-200"
							title="Settings"
						>
							<Settings className="h-4 w-4" />
						</a>
					</div>
				</div>

				{/* Video preview */}
				<div className="flex-1 min-h-0 relative">
					<PreviewPanel />
					{isLoading && <RenderingOverlay />}
				</div>

				{/* Scrubber */}
				<TimelineScrubber />

				{/* Timeline panel - smooth show/hide */}
				<div
					className="shrink-0 border-t border-border/30 overflow-hidden transition-[max-height] duration-300 ease-in-out"
					style={{ maxHeight: advancedView ? "250px" : "0px" }}
				>
					<div className="h-[250px]">
						<Timeline />
					</div>
				</div>
			</div>
			<RecordingPanel />
			<ClipperPanel />
			<StoryboardPanel />
			<AvatarPanel />
		</div>
	);
}
