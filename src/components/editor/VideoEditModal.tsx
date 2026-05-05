"use client";

import { Crop, Film, Gauge, Palette, Repeat, Scissors, VolumeX, Wand2, Volume2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Scene } from "@/lib/scene-schema";
import { PropertyModal } from "./PropertyModal";

/**
 * One-stop video edit modal for the bg video. Surfaces every common
 * video edit (trim, speed, loop, mute) plus quick-jumps to the deeper
 * modals (Crop / Look / Animate) so the user never has to hunt across
 * the property panel for a single video.
 *
 * Live preview at the top is a plain HTML5 <video> driven by the trim
 * handles — not Remotion — so dragging the in/out bars feels instant.
 */

interface Props {
	open: boolean;
	onClose: () => void;
	scene: Scene;
	update: (patch: Partial<Scene>) => void;
	onOpenCrop: () => void;
	onOpenLook: () => void;
	onOpenAnimate: () => void;
}

export function VideoEditModal({ open, onClose, scene, update, onOpenCrop, onOpenLook, onOpenAnimate }: Props) {
	const bg = scene.background;
	const videoRef = useRef<HTMLVideoElement | null>(null);
	const [duration, setDuration] = useState<number | null>(null);
	const [currentTime, setCurrentTime] = useState(0);
	const [playing, setPlaying] = useState(false);

	const startSec = bg.videoStartSec ?? 0;
	const endSec = bg.videoEndSec ?? duration ?? 30;
	const playbackRate = bg.videoPlaybackRate ?? 1;
	const looping = !!bg.videoLoop;
	const muted = bg.videoMuted ?? true;

	useEffect(() => {
		if (!open) {
			videoRef.current?.pause();
			setPlaying(false);
		}
	}, [open]);

	useEffect(() => {
		const v = videoRef.current;
		if (!v) return;
		v.playbackRate = playbackRate;
	}, [playbackRate, open]);

	const setBg = (patch: Partial<typeof bg>) =>
		update({ background: { ...bg, ...patch } });

	const seek = (t: number) => {
		const v = videoRef.current;
		if (v) {
			v.currentTime = Math.max(0, Math.min(duration ?? t, t));
			setCurrentTime(v.currentTime);
		}
	};

	const togglePlay = () => {
		const v = videoRef.current;
		if (!v) return;
		if (v.paused) {
			v.currentTime = Math.max(startSec, Math.min(endSec, v.currentTime));
			v.play();
			setPlaying(true);
		} else {
			v.pause();
			setPlaying(false);
		}
	};

	const onTimeUpdate = () => {
		const v = videoRef.current;
		if (!v) return;
		setCurrentTime(v.currentTime);
		// Stop or loop at the trim end.
		if (v.currentTime >= endSec) {
			if (looping) {
				v.currentTime = startSec;
			} else {
				v.pause();
				setPlaying(false);
			}
		}
		if (v.currentTime < startSec - 0.05) v.currentTime = startSec;
	};

	const trimDuration = Math.max(0.05, endSec - startSec);
	const sceneSec = scene.duration;
	const effectiveSec = trimDuration / playbackRate;

	const sliderMax = duration ?? 60;

	return (
		<PropertyModal
			open={open}
			onClose={onClose}
			title="Edit video"
			subtitle={`Trim ${startSec.toFixed(1)}s → ${endSec.toFixed(1)}s · ${playbackRate}× · ${effectiveSec.toFixed(1)}s on screen / ${sceneSec.toFixed(1)}s scene`}
			accent="sky"
			width="huge"
		>
			<div className="space-y-4">
				<div className="rounded-md overflow-hidden bg-black border border-neutral-800">
					{/* biome-ignore lint/a11y/useMediaCaption: source clip — captions handled separately */}
					<video
						ref={videoRef}
						src={bg.videoUrl}
						muted={muted}
						playsInline
						className="w-full max-h-[300px] object-contain bg-black"
						onLoadedMetadata={(e) => {
							setDuration(e.currentTarget.duration);
							e.currentTarget.currentTime = startSec;
						}}
						onTimeUpdate={onTimeUpdate}
					/>
					<div className="flex items-center gap-2 px-2 py-1.5 bg-neutral-950/70 border-t border-neutral-800">
						<button
							type="button"
							onClick={togglePlay}
							className="text-[11px] px-2 py-1 rounded bg-sky-500 hover:bg-sky-400 text-neutral-950 font-semibold"
						>
							{playing ? "Pause" : "Play"}
						</button>
						<span className="text-[10px] font-mono text-neutral-400 tabular-nums">
							{currentTime.toFixed(2)}s / {(duration ?? 0).toFixed(2)}s
						</span>
						<input
							type="range"
							min={0}
							max={sliderMax}
							step={0.05}
							value={currentTime}
							onChange={(e) => seek(Number(e.target.value))}
							className="flex-1 accent-sky-500 h-1"
						/>
						<button
							type="button"
							onClick={() => setBg({ videoMuted: !muted })}
							className="text-neutral-400 hover:text-white"
							title={muted ? "Unmute" : "Mute"}
						>
							{muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
						</button>
					</div>
				</div>

				<section className="rounded-md border border-neutral-800 bg-neutral-950/40 p-3 space-y-3">
					<div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-neutral-400">
						<Scissors className="h-3 w-3" /> Trim
					</div>
					<div className="space-y-2">
						<div className="space-y-1">
							<div className="flex items-baseline justify-between">
								<label className="text-[10px] uppercase tracking-wider text-neutral-500">
									Start
								</label>
								<span className="text-[10px] font-mono text-neutral-400 tabular-nums">
									{startSec.toFixed(2)}s
								</span>
							</div>
							<input
								type="range"
								min={0}
								max={sliderMax}
								step={0.05}
								value={startSec}
								onChange={(e) => {
									const v = Math.min(Number(e.target.value), endSec - 0.1);
									setBg({ videoStartSec: v });
									seek(v);
								}}
								className="w-full accent-sky-500 h-1.5"
							/>
						</div>
						<div className="space-y-1">
							<div className="flex items-baseline justify-between">
								<label className="text-[10px] uppercase tracking-wider text-neutral-500">
									End
								</label>
								<span className="text-[10px] font-mono text-neutral-400 tabular-nums">
									{endSec.toFixed(2)}s
								</span>
							</div>
							<input
								type="range"
								min={0}
								max={sliderMax}
								step={0.05}
								value={endSec}
								onChange={(e) => {
									const v = Math.max(Number(e.target.value), startSec + 0.1);
									setBg({ videoEndSec: v });
									seek(v);
								}}
								className="w-full accent-sky-500 h-1.5"
							/>
						</div>
						<div className="flex items-center gap-2 text-[10px] text-neutral-500">
							<button
								type="button"
								onClick={() => {
									setBg({ videoStartSec: undefined, videoEndSec: undefined });
								}}
								className="px-2 py-0.5 rounded border border-neutral-800 hover:border-neutral-600"
							>
								Reset trim
							</button>
							<span className="font-mono tabular-nums">
								Clip · {trimDuration.toFixed(2)}s
							</span>
						</div>
					</div>
				</section>

				<section className="rounded-md border border-neutral-800 bg-neutral-950/40 p-3 space-y-3">
					<div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-neutral-400">
						<Gauge className="h-3 w-3" /> Playback
					</div>
					<div className="grid grid-cols-2 gap-3">
						<div className="space-y-1">
							<label className="text-[10px] uppercase tracking-wider text-neutral-500">
								Speed
							</label>
							<div className="flex items-center gap-1 flex-wrap">
								{[0.25, 0.5, 1, 1.5, 2, 4].map((s) => (
									<button
										key={s}
										type="button"
										onClick={() => setBg({ videoPlaybackRate: s === 1 ? undefined : s })}
										className={`text-[11px] px-2 py-1 rounded border ${
											playbackRate === s
												? "border-sky-500 bg-sky-500/15 text-sky-200"
												: "border-neutral-700 text-neutral-400 hover:border-neutral-500"
										}`}
									>
										{s}×
									</button>
								))}
							</div>
						</div>
						<div className="space-y-1">
							<label className="text-[10px] uppercase tracking-wider text-neutral-500">
								Loop
							</label>
							<button
								type="button"
								onClick={() => setBg({ videoLoop: looping ? undefined : true })}
								className={`flex items-center gap-1.5 text-[11px] px-2 py-1.5 rounded border ${
									looping
										? "border-sky-500 bg-sky-500/15 text-sky-200"
										: "border-neutral-700 text-neutral-400 hover:border-neutral-500"
								}`}
							>
								<Repeat className="h-3 w-3" />
								{looping ? "Looping when scene > clip" : "Stops at clip end"}
							</button>
						</div>
					</div>
				</section>

				<section className="rounded-md border border-neutral-800 bg-neutral-950/40 p-3 space-y-2">
					<div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-neutral-400">
						<Wand2 className="h-3 w-3" /> Effects & motion
					</div>
					<div className="text-[10px] text-neutral-500 mb-1">
						Open the focused tool for each effect — they all save to this video.
					</div>
					<div className="grid grid-cols-3 gap-2">
						<JumpButton
							icon={<Crop className="h-3 w-3" />}
							label="Crop"
							hint="Reframe / zoom"
							onClick={() => {
								onClose();
								onOpenCrop();
							}}
							active={!!bg.videoCrop}
						/>
						<JumpButton
							icon={<Palette className="h-3 w-3" />}
							label="Look & key"
							hint="Color, blur, key"
							onClick={() => {
								onClose();
								onOpenLook();
							}}
							active={
								(bg.colorGrade && bg.colorGrade !== "neutral") ||
								!!bg.chromaKey ||
								!!bg.lumaKey
							}
						/>
						<JumpButton
							icon={<Film className="h-3 w-3" />}
							label="Move & animate"
							hint="Pan / zoom over time"
							onClick={() => {
								onClose();
								onOpenAnimate();
							}}
							active={false}
						/>
					</div>
				</section>
			</div>
		</PropertyModal>
	);
}

function JumpButton({
	icon,
	label,
	hint,
	onClick,
	active,
}: {
	icon: React.ReactNode;
	label: string;
	hint: string;
	onClick: () => void;
	active: boolean;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={`flex flex-col items-start gap-0.5 text-left px-2 py-2 rounded-md border transition-colors ${
				active
					? "border-sky-500 bg-sky-500/15 text-sky-200"
					: "border-neutral-700 text-neutral-300 hover:border-neutral-500 hover:bg-neutral-900"
			}`}
		>
			<span className="flex items-center gap-1.5 text-[11px] font-semibold">
				{icon}
				{label}
			</span>
			<span className="text-[9px] text-neutral-500">{hint}</span>
		</button>
	);
}
