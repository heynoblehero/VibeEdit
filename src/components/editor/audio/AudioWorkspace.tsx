"use client";

import { Film, Library, Mic, Music, Sliders, Sparkles } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { DEFAULT_PX_PER_SEC } from "@/lib/audio/clip-math";
import { useProjectStore } from "@/store/project-store";
import { useWorkspaceStore } from "@/store/workspace-store";
import { AudioInspector } from "./AudioInspector";
import { AudioLibraryPanel } from "./AudioLibraryPanel";
import { AudioMixer } from "./AudioMixer";
import { AudioPreview } from "./AudioPreview";
import { AudioTimeline } from "./AudioTimeline";
import { RecordingPanel } from "./RecordingPanel";
import { TTSPanel } from "./TTSPanel";

/**
 * Audio workspace shell. Three columns:
 *   - Left rail: Mixer / TTS / Record / Library panels.
 *   - Center: video preview (AudioPreview) above the multi-lane
 *     timeline, so the user can scrub the cut while editing audio.
 *   - Right: per-clip inspector (trim, fade, gain, save-to-library).
 *
 * Orange chrome to contrast with the green Video workspace.
 */
export function AudioWorkspace() {
	const project = useProjectStore((s) => s.project);
	const setTab = useWorkspaceStore((s) => s.setTab);
	const sceneCount = project.scenes.length;
	const totalSec = project.scenes.reduce((acc, s) => acc + (s.duration ?? 0), 0);
	const voCount = project.scenes.filter((s) => s.voiceover?.audioUrl).length;
	const sfxCount = project.scenes.filter((s) => s.sceneSfxUrl || s.sfxId).length;
	const hasMusic = !!project.music?.url;

	const [leftPanel, setLeftPanel] = useState<"mixer" | "tts" | "record" | "library">(
		"mixer",
	);
	const [pxPerSec, setPxPerSec] = useState(DEFAULT_PX_PER_SEC);

	return (
		<div className="flex-1 flex flex-col min-h-0 bg-neutral-925">
			{/* Subtle workspace identity strip — 2px accent at the very top
			    instead of 2px borders on every edge. */}
			<div className="h-0.5 shrink-0 bg-gradient-to-r from-orange-500/0 via-orange-500/60 to-orange-500/0" />
			<div className="flex-1 flex min-h-0">
			{/* Left rail: panels live here. */}
			<aside className="w-72 border-r border-neutral-800 bg-neutral-950/60 shrink-0 flex flex-col">
				<div className="flex gap-0.5 p-0.5 m-2 rounded-md bg-neutral-950 border border-neutral-800">
					<RailButton
						active={leftPanel === "mixer"}
						onClick={() => setLeftPanel("mixer")}
						icon={<Sliders className="h-3.5 w-3.5" />}
						label="Mix"
					/>
					<RailButton
						active={leftPanel === "tts"}
						onClick={() => setLeftPanel("tts")}
						icon={<Sparkles className="h-3.5 w-3.5" />}
						label="TTS"
					/>
					<RailButton
						active={leftPanel === "record"}
						onClick={() => setLeftPanel("record")}
						icon={<Mic className="h-3.5 w-3.5" />}
						label="Record"
					/>
					<RailButton
						active={leftPanel === "library"}
						onClick={() => setLeftPanel("library")}
						icon={<Library className="h-3.5 w-3.5" />}
						label="Library"
					/>
				</div>
				<div className="flex-1 overflow-y-auto px-3 pb-3">
					{leftPanel === "mixer" ? (
						<AudioMixer />
					) : leftPanel === "tts" ? (
						<TTSPanel />
					) : leftPanel === "record" ? (
						<RecordingPanel />
					) : (
						<AudioLibraryPanel />
					)}
				</div>
			</aside>

			{/* Center: video preview + multi-lane audio timeline. */}
			<section
				className="flex-1 min-w-0 flex flex-col bg-neutral-950"
				aria-label="Audio workspace"
			>
				<header className="flex items-center justify-between px-4 py-2.5 border-b border-neutral-800 bg-neutral-900 shrink-0">
					<div className="flex items-center gap-3">
						<Music className="h-4 w-4 text-orange-300" />
						<span className="text-[11px] uppercase tracking-wider text-orange-300 font-semibold">
							Audio workspace
						</span>
						<span className="text-[10px] text-neutral-500">
							{sceneCount} scene{sceneCount === 1 ? "" : "s"} · {totalSec.toFixed(1)}s
							· {voCount} VO · {sfxCount} SFX
							{hasMusic ? " · music" : ""}
						</span>
					</div>
				</header>
				{sceneCount === 0 ? (
					<div className="flex-1 flex items-center justify-center">
						<EmptyState
							accent="audio"
							icon={<Music className="h-5 w-5" />}
							title="No scenes to attach audio to yet"
							description="Audio lives on scenes — voiceovers attach per scene, music plays across the whole project. Hop to Video, add a scene, then come back."
							primaryAction={
								<Button
									variant="primary"
									accent="audio"
									size="sm"
									leadingIcon={<Film className="h-3.5 w-3.5" />}
									onClick={() => setTab(project.id, "video")}
								>
									Go to Video
								</Button>
							}
						/>
					</div>
				) : (
					<>
						<AudioPreview />
						<div className="flex-1 min-h-0 overflow-hidden">
							<AudioTimeline
								project={project}
								pxPerSec={pxPerSec}
								onPxPerSecChange={setPxPerSec}
							/>
						</div>
					</>
				)}
			</section>

			{/* Right: clip inspector. */}
			<aside
				data-audio-inspector
				className="w-72 border-l border-neutral-800 bg-neutral-950/60 shrink-0 flex flex-col"
			>
				<div className="sticky top-0 z-10 flex items-center justify-between px-3 py-2 border-b border-neutral-800 bg-neutral-900 shrink-0">
					<span className="text-[11px] uppercase tracking-wider text-orange-300 font-semibold">
						Inspector
					</span>
				</div>
				<div className="flex-1 overflow-y-auto p-3">
					<AudioInspector />
				</div>
			</aside>
			</div>
		</div>
	);
}

function RailButton({
	active,
	onClick,
	icon,
	label,
}: {
	active: boolean;
	onClick: () => void;
	icon: React.ReactNode;
	label: string;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-1.5 rounded text-[10px] transition-colors ${
				active
					? "bg-orange-500/20 text-orange-200"
					: "text-neutral-500 hover:text-white"
			}`}
		>
			{icon}
			<span>{label}</span>
		</button>
	);
}
