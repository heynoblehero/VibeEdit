"use client";

import { Player, type PlayerRef } from "@remotion/player";
import { Pause, Play, SkipBack, SkipForward } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { totalDurationFrames } from "@/lib/scene-schema";
import { VideoComposition } from "@/remotion/Composition";
import { useEditorStore } from "@/store/editor-store";
import { useProjectStore } from "@/store/project-store";
import { LevelMeter } from "./LevelMeter";

/**
 * Compact video preview for the Audio workspace. Shares play/pause +
 * frame state with `useEditorStore` so the user can scrub the project
 * while editing audio clips. Sizes to the project aspect ratio so a
 * 9:16 short doesn't get squashed and a 16:9 video doesn't waste
 * vertical real estate.
 *
 * Lighter than the main Preview component — no overlays, no canvas
 * manipulator, no scene-only mode. The Audio workspace just needs to
 * watch the cut and hear the audio in sync.
 */
export function AudioPreview() {
	const project = useProjectStore((s) => s.project);
	const isPaused = useEditorStore((s) => s.isPaused);
	const setPaused = useEditorStore((s) => s.setPaused);
	const previewFrame = useEditorStore((s) => s.previewFrame);
	const setPreviewFrame = useEditorStore((s) => s.setPreviewFrame);

	const playerRef = useRef<PlayerRef>(null);
	const [seekTick, setSeekTick] = useState(0);

	const totalFrames = useMemo(
		() => Math.max(1, totalDurationFrames(project.scenes, project.fps)),
		[project.scenes, project.fps],
	);

	const charMap = useMemo(() => {
		const out: Record<string, string> = {};
		for (const s of project.scenes) {
			if (s.characterId && s.characterUrl) out[s.characterId] = s.characterUrl;
		}
		return out;
	}, [project.scenes]);

	const sfxMap = useMemo(() => {
		const out: Record<string, string> = {};
		for (const s of project.scenes) {
			if (s.sfxId && s.sceneSfxUrl) out[s.sfxId] = s.sceneSfxUrl;
		}
		return out;
	}, [project.scenes]);

	useEffect(() => {
		const player = playerRef.current;
		if (!player) return;
		if (isPaused) {
			player.pause();
		} else {
			player.play();
		}
	}, [isPaused, seekTick]);

	useEffect(() => {
		const player = playerRef.current;
		if (!player) return;
		const onFrame = (e: { detail: { frame: number } }) => {
			setPreviewFrame(e.detail.frame);
		};
		player.addEventListener("frameupdate", onFrame);
		return () => {
			try {
				player.removeEventListener("frameupdate", onFrame);
			} catch {
				// Player unmounted between mount + cleanup
			}
		};
	}, [setPreviewFrame]);

	const skip = (frames: number) => {
		const player = playerRef.current;
		if (!player) return;
		const next = Math.max(0, Math.min(totalFrames - 1, previewFrame + frames));
		player.seekTo(next);
		setPreviewFrame(next);
		setSeekTick((t) => t + 1);
	};

	return (
		<div className="flex flex-col gap-2 p-3 border-b-2 border-orange-500/40 bg-neutral-950 shrink-0">
			<div className="flex items-center justify-between">
				<span className="text-[10px] uppercase tracking-wider text-orange-300 font-semibold">
					Preview
				</span>
				<div className="flex items-center gap-2">
					<LevelMeter />
					<span className="text-[10px] font-mono text-neutral-500 tabular-nums">
						{(previewFrame / project.fps).toFixed(2)}s / {(totalFrames / project.fps).toFixed(2)}s
					</span>
				</div>
			</div>
			<div
				className="flex items-center justify-center"
				style={{ containerType: "size", height: 220 }}
			>
				<div
					className="relative bg-black rounded-md overflow-hidden border border-orange-500/40"
					style={{
						width: `min(100cqw, 100cqh * ${project.width} / ${project.height})`,
						height: `min(100cqh, 100cqw * ${project.height} / ${project.width})`,
					}}
				>
					<Player
						ref={playerRef}
						component={VideoComposition}
						inputProps={{
							scenes: project.scenes,
							fps: project.fps,
							characters: charMap,
							sfx: sfxMap,
							music: project.music,
							captionStyle: project.captionStyle,
							cuts: project.cuts,
							width: project.width,
							height: project.height,
							audioMix: project.audioMix,
							sfxClips: project.sfxClips,
							tracks: project.tracks,
						}}
						durationInFrames={totalFrames}
						fps={project.fps}
						compositionWidth={project.width}
						compositionHeight={project.height}
						style={{ width: "100%", height: "100%" }}
						controls={false}
						loop
						autoPlay={false}
						initialFrame={Math.min(previewFrame, totalFrames - 1)}
					/>
				</div>
			</div>
			<div className="flex items-center justify-center gap-1">
				<button
					type="button"
					onClick={() => skip(-project.fps)}
					className="p-1.5 rounded text-neutral-300 hover:text-orange-200 hover:bg-orange-500/10"
					title="Back 1 second"
				>
					<SkipBack className="h-3.5 w-3.5" />
				</button>
				<button
					type="button"
					onClick={() => setPaused(!isPaused)}
					className="px-3 py-1.5 rounded bg-orange-500 hover:bg-orange-400 text-neutral-950 font-semibold text-[11px] flex items-center gap-1"
				>
					{isPaused ? (
						<Play className="h-3.5 w-3.5 fill-current" />
					) : (
						<Pause className="h-3.5 w-3.5 fill-current" />
					)}
					{isPaused ? "Play" : "Pause"}
				</button>
				<button
					type="button"
					onClick={() => skip(project.fps)}
					className="p-1.5 rounded text-neutral-300 hover:text-orange-200 hover:bg-orange-500/10"
					title="Forward 1 second"
				>
					<SkipForward className="h-3.5 w-3.5" />
				</button>
			</div>
		</div>
	);
}
