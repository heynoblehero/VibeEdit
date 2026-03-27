"use client";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { ChatPanel } from "@/components/editor/panels/chat";
import { Timeline } from "@/components/editor/panels/timeline";
import { PreviewPanel } from "@/components/editor/panels/preview";
import { EditorProvider } from "@/components/providers/editor-provider";
import { Onboarding } from "@/components/editor/onboarding";
import { MigrationDialog } from "@/components/editor/dialogs/migration-dialog";
import { usePasteMedia } from "@/hooks/use-paste-media";
import { MobileGate } from "@/components/editor/mobile-gate";
import { ExportButton } from "@/components/editor/export-button";
import { useAIChat } from "@/hooks/use-ai-chat";
import { useEditor } from "@/hooks/use-editor";

export default function Editor() {
	const params = useParams();
	const projectId = params.project_id as string;

	return (
		<MobileGate>
			<EditorProvider projectId={projectId}>
				<EditorLayout />
				<Onboarding />
				<MigrationDialog />
			</EditorProvider>
		</MobileGate>
	);
}

function StarryOverlay() {
	return (
		<div className="absolute inset-0 z-10 bg-[#0a0a0f]/90 flex items-center justify-center overflow-hidden">
			{Array.from({ length: 50 }).map((_, i) => (
				<div
					key={i}
					className="absolute rounded-full bg-white animate-pulse"
					style={{
						width: Math.random() * 3 + 1,
						height: Math.random() * 3 + 1,
						top: `${Math.random() * 100}%`,
						left: `${Math.random() * 100}%`,
						animationDelay: `${Math.random() * 3}s`,
						animationDuration: `${1.5 + Math.random() * 2}s`,
						opacity: Math.random() * 0.7 + 0.3,
					}}
				/>
			))}
			<div className="text-white/60 text-sm font-medium z-20">
				<div className="flex items-center gap-2">
					<div className="flex gap-1">
						<div className="h-1.5 w-1.5 rounded-full bg-white/60 animate-bounce" style={{ animationDelay: "0ms" }} />
						<div className="h-1.5 w-1.5 rounded-full bg-white/60 animate-bounce" style={{ animationDelay: "150ms" }} />
						<div className="h-1.5 w-1.5 rounded-full bg-white/60 animate-bounce" style={{ animationDelay: "300ms" }} />
					</div>
					<span>Creating your vision</span>
				</div>
			</div>
		</div>
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

	return (
		<div className="shrink-0 border-t border-border px-4 py-2 flex items-center gap-3">
			<button
				onClick={() => editor.playback.toggle()}
				className="text-muted-foreground hover:text-foreground transition-colors"
			>
				<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
			</button>
			<div className="flex-1 h-1 bg-border rounded-full overflow-hidden cursor-pointer">
				<div className="h-full bg-primary rounded-full transition-all" style={{ width: `${progress}%` }} />
			</div>
			<span className="text-xs text-muted-foreground tabular-nums">
				{formatTime(currentTime)} / {formatTime(totalDuration)}
			</span>
		</div>
	);
}

function AssetDropdown() {
	const editor = useEditor();
	const [open, setOpen] = useState(false);
	const [assets, setAssets] = useState<Array<{ id: string; name: string; type: string; duration?: number; width?: number; height?: number }>>([]);
	const dropdownRef = useRef<HTMLDivElement>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		const update = () => {
			const all = editor.media.getAssets();
			setAssets(all.map(a => ({ id: a.id, name: a.name, type: a.type, duration: a.duration, width: a.width, height: a.height })));
		};
		update();
		const unsub = editor.media.subscribe(update);
		return unsub;
	}, [editor]);

	// Close on click outside
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
				className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
			>
				Assets{assets.length > 0 ? ` (${assets.length})` : ""}
				<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`transition-transform ${open ? "rotate-180" : ""}`}><path d="m6 9 6 6 6-6"/></svg>
			</button>

			{open && (
				<div className="absolute top-full left-0 mt-1 w-64 rounded-xl border border-border bg-card shadow-lg z-50 overflow-hidden">
					{assets.length === 0 ? (
						<div className="p-4 text-center text-xs text-muted-foreground">
							No media attached yet.<br />Use the chat to attach files.
						</div>
					) : (
						<div className="max-h-48 overflow-y-auto scrollbar-thin">
							{assets.map(a => (
								<div key={a.id} className="flex items-center gap-2 px-3 py-2 text-xs hover:bg-muted/50 transition-colors">
									<span>{icon(a.type)}</span>
									<span className="font-medium text-foreground truncate flex-1">{a.name}</span>
									<span className="text-muted-foreground shrink-0">
										{a.type}{a.duration ? ` \u00B7 ${a.duration.toFixed(1)}s` : ""}{a.width ? ` \u00B7 ${a.width}\u00D7${a.height}` : ""}
									</span>
								</div>
							))}
						</div>
					)}
					<div className="border-t border-border p-2">
						<button
							onClick={() => fileInputRef.current?.click()}
							className="w-full rounded-lg px-3 py-1.5 text-xs text-primary hover:bg-primary/5 transition-colors text-center"
						>
							+ Attach files
						</button>
						<input ref={fileInputRef} type="file" className="hidden" multiple accept="image/*,video/*,audio/*,.zip,.cube,.3dl,.psd,.json"
							onChange={async (e) => { const f = Array.from(e.target.files || []); if (f.length) await handleFiles(f); e.target.value = ""; setOpen(false); }} />
					</div>
				</div>
			)}
		</div>
	);
}

function EditorLayout() {
	usePasteMedia();

	const [advancedView, setAdvancedView] = useState(false);
	const { isLoading } = useAIChat();

	return (
		<div className="flex h-screen bg-background">
			{/* LEFT: Chat (60%) */}
			<div className="w-[60%] shrink-0 border-r border-border">
				<ChatPanel />
			</div>

			{/* RIGHT: Preview + controls (40%) */}
			<div className="flex-1 flex flex-col">
				{/* Render button bar */}
				<div className="shrink-0 border-b border-border px-3 py-2 flex items-center justify-between bg-card">
					<AssetDropdown />
					<div className="flex items-center gap-2">
						<button
							onClick={() => setAdvancedView((v) => !v)}
							className="rounded-md px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
						>
							{advancedView ? "Hide Timeline" : "Timeline"}
						</button>
						<ExportButton />
					</div>
				</div>

				{/* Video preview with optional starry overlay */}
				<div className="flex-1 min-h-0 relative">
					<PreviewPanel />
					{isLoading && <StarryOverlay />}
				</div>

				{/* Slim timeline scrubber */}
				<TimelineScrubber />

				{/* Advanced: full timeline */}
				{advancedView && (
					<div className="shrink-0 h-[250px] border-t border-border">
						<Timeline />
					</div>
				)}
			</div>
		</div>
	);
}
