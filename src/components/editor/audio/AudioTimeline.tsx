"use client";

import { Magnet, Minus, Plus } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
	buildSnapTargets,
	clampZoom,
	DEFAULT_PX_PER_SEC,
	formatSec,
	projectDurationSec,
	pxToSec,
	sceneSpans,
	secToPx,
	snap,
} from "@/lib/audio/clip-math";
import type { Project } from "@/lib/scene-schema";
import { useEditorStore } from "@/store/editor-store";
import { useProjectStore } from "@/store/project-store";
import { AudioClip, type AudioClipKind } from "./AudioClip";
import { AudioRuler } from "./AudioRuler";

/**
 * Multi-lane audio timeline. Walks the project once per render:
 *   - VO lane: every Scene.voiceover.audioUrl, positioned at its
 *     scene's project-relative start.
 *   - Music lane: project.music as one full-duration clip.
 *   - SFX lane: scenes with sceneSfxUrl + future free-floating
 *     project.sfxClips (phase 7).
 *
 * Clip widths are derived from scene.duration (or, for music, the
 * total project duration). Trimming / dragging arrives in phase 6.
 */
interface Props {
	project: Project;
	pxPerSec: number;
	onPxPerSecChange: (next: number) => void;
}

const LANE_HEIGHT = 64;
const LANE_HEADER_W = 100;

export function AudioTimeline({ project, pxPerSec, onPxPerSecChange }: Props) {
	const selectedId = useEditorStore((s) => s.audioSelectedClipId);
	const setSelected = useEditorStore((s) => s.setAudioSelectedClipId);
	const previewFrame = useEditorStore((s) => s.previewFrame);
	const setPreviewFrame = useEditorStore((s) => s.setPreviewFrame);
	const setPaused = useEditorStore((s) => s.setPaused);
	const updateScene = useProjectStore((s) => s.updateScene);
	const setMusic = useProjectStore((s) => s.setMusic);
	const updateSfxClip = useProjectStore((s) => s.updateSfxClip);
	const beginHistoryGroup = useProjectStore((s) => s.beginHistoryGroup);
	const endHistoryGroup = useProjectStore((s) => s.endHistoryGroup);

	// Snap toggle — power users who nudge clips by single frames want
	// the magnetic edges off. Persisted so the preference survives.
	const [snapEnabled, setSnapEnabled] = useState(true);
	useEffect(() => {
		try {
			const v = window.localStorage.getItem("vibeedit:audio-snap");
			if (v !== null) setSnapEnabled(v === "1");
		} catch {}
	}, []);
	const toggleSnap = () => {
		setSnapEnabled((v) => {
			const next = !v;
			try {
				window.localStorage.setItem("vibeedit:audio-snap", next ? "1" : "0");
			} catch {}
			return next;
		});
	};

	// Snapshot of "original" values captured at drag start. Keyed by
	// clip id so concurrent drags (impossible today, but cheap to be
	// safe) don't trip over each other.
	const dragOrigin = useRef<
		Map<
			string,
			{
				startFrame?: number;
				trimStart?: number;
				trimEnd?: number;
				audioDuration?: number;
			}
		>
	>(new Map());

	const totalSec = projectDurationSec(project);
	const totalPx = secToPx(totalSec, pxPerSec);
	const playheadSec = previewFrame / project.fps;
	const playheadPx = secToPx(playheadSec, pxPerSec);

	const seekFromClick = (e: React.MouseEvent<HTMLButtonElement>) => {
		const rect = e.currentTarget.getBoundingClientRect();
		const x = e.clientX - rect.left;
		const sec = pxToSec(x, pxPerSec);
		const frame = Math.max(0, Math.round(sec * project.fps));
		setPreviewFrame(frame);
		setPaused(true);
	};

	const lanes = useMemo(() => {
		const spans = sceneSpans(project);
		const spanById = new Map(spans.map((s) => [s.id, s]));

		const vo: Array<{ id: string; src: string; label: string; start: number; end: number }> = [];
		const sfx: Array<{ id: string; src: string; label: string; start: number; end: number }> = [];

		project.scenes.forEach((scene, idx) => {
			const span = spanById.get(scene.id);
			if (!span) return;
			if (scene.voiceover?.audioUrl) {
				vo.push({
					id: `vo:${scene.id}`,
					src: scene.voiceover.audioUrl,
					label: `Scene ${idx + 1}`,
					start: span.start,
					end: span.end,
				});
			}
			if (scene.sceneSfxUrl) {
				sfx.push({
					id: `sfx:${scene.id}`,
					src: scene.sceneSfxUrl,
					label: scene.sfxId ?? `SFX ${idx + 1}`,
					start: span.start,
					end: span.end,
				});
			}
		});

		// Free-floating SFX clips dropped on the project timeline (phase 7).
		const fps = project.fps;
		(project.sfxClips ?? []).forEach((clip) => {
			const start = clip.startFrame / fps;
			const end = (clip.startFrame + clip.durationFrames) / fps;
			sfx.push({
				id: `sfxclip:${clip.id}`,
				src: clip.url,
				label: clip.name,
				start,
				end,
			});
		});

		const music = project.music?.url
			? {
					id: "music:project",
					src: project.music.url,
					label: project.music.name || "Music",
					start: 0,
					end: totalSec,
				}
			: null;

		return { vo, music, sfx };
	}, [project, totalSec]);

	const lanesConfig: Array<{
		key: AudioClipKind;
		title: string;
		hint: string;
		clips: Array<{ id: string; src?: string; label: string; subLabel?: string; start: number; end: number }>;
	}> = [
		{
			key: "vo",
			title: "Voiceover",
			hint: `${lanes.vo.length} clip${lanes.vo.length === 1 ? "" : "s"}`,
			clips: lanes.vo.map((c) => ({ ...c, subLabel: formatSec(c.end - c.start) })),
		},
		{
			key: "music",
			title: "Music",
			hint: lanes.music ? "1 clip" : "no bed",
			clips: lanes.music ? [{ ...lanes.music, subLabel: project.music?.name }] : [],
		},
		{
			key: "sfx",
			title: "SFX",
			hint: `${lanes.sfx.length} clip${lanes.sfx.length === 1 ? "" : "s"}`,
			clips: lanes.sfx.map((c) => ({ ...c, subLabel: formatSec(c.end - c.start) })),
		},
	];

	return (
		<div className="flex flex-col h-full min-h-0">
			<div className="flex items-center justify-between px-3 py-1.5 border-b border-neutral-800 bg-neutral-925 shrink-0">
				<span className="text-[10px] uppercase tracking-wider text-neutral-500">
					{formatSec(totalSec)} · {project.scenes.length} scene
					{project.scenes.length === 1 ? "" : "s"}
				</span>
				<div className="flex items-center gap-1.5">
					<button
						type="button"
						onClick={toggleSnap}
						title={snapEnabled ? "Snap on (click to disable)" : "Snap off"}
						className={`p-1 rounded ${
							snapEnabled
								? "text-orange-300 bg-orange-500/10"
								: "text-neutral-500 hover:bg-neutral-800"
						}`}
					>
						<Magnet className="h-3 w-3" />
					</button>
					<button
						type="button"
						className="p-1 rounded hover:bg-neutral-800 text-neutral-400"
						onClick={() => onPxPerSecChange(clampZoom(pxPerSec / 1.5))}
						title="Zoom out"
					>
						<Minus className="h-3 w-3" />
					</button>
					<span className="text-[10px] font-mono text-neutral-500 w-14 text-center">
						{Math.round(pxPerSec)} px/s
					</span>
					<button
						type="button"
						className="p-1 rounded hover:bg-neutral-800 text-neutral-400"
						onClick={() => onPxPerSecChange(clampZoom(pxPerSec * 1.5))}
						title="Zoom in"
					>
						<Plus className="h-3 w-3" />
					</button>
					<button
						type="button"
						className="ml-1 px-1.5 py-0.5 text-[10px] rounded hover:bg-neutral-800 text-neutral-400"
						onClick={() => onPxPerSecChange(DEFAULT_PX_PER_SEC)}
						title="Reset zoom"
					>
						Fit
					</button>
				</div>
			</div>
			<div className="flex-1 min-h-0 overflow-auto">
				<div className="flex" style={{ minWidth: LANE_HEADER_W + totalPx }}>
					<div
						className="sticky left-0 z-20 shrink-0 bg-neutral-925 border-r border-neutral-800"
						style={{ width: LANE_HEADER_W }}
					>
						{/* Spacer for ruler */}
						<div className="h-[22px] border-b border-neutral-800" />
						{lanesConfig.map((lane) => (
							<div
								key={lane.key}
								className="border-b border-neutral-800 px-3 py-2 flex flex-col justify-center"
								style={{ height: LANE_HEIGHT }}
							>
								<span className="text-[10px] uppercase tracking-wider font-semibold text-orange-300">
									{lane.title}
								</span>
								<span className="text-[9px] text-neutral-500">{lane.hint}</span>
							</div>
						))}
					</div>
					<div className="flex flex-col relative" style={{ width: totalPx }}>
						{/* Click ruler to seek; doubles as the seek surface. */}
						<button
							type="button"
							onClick={seekFromClick}
							onKeyDown={(e) => {
								if (e.key === "Enter" || e.key === " ") {
									setPaused(true);
								}
							}}
							className="absolute top-0 left-0 right-0 h-[22px] z-20 cursor-col-resize"
							title="Click to seek"
							aria-label="Seek timeline"
						/>
						<AudioRuler durationSec={totalSec} pxPerSec={pxPerSec} />
						{/* Playhead spanning all lanes */}
						<div
							className="pointer-events-none absolute top-0 bottom-0 z-30"
							style={{ left: playheadPx, transform: "translateX(-1px)" }}
						>
							<div className="w-0.5 h-full bg-orange-400 shadow-[0_0_6px_rgba(251,146,60,0.6)]" />
							<div className="absolute -top-0.5 -left-1.5 w-3 h-3 rotate-45 bg-orange-400 shadow-md" />
						</div>
						{lanesConfig.map((lane) => (
							<div
								key={lane.key}
								className="relative border-b border-neutral-800 bg-neutral-950"
								style={{ height: LANE_HEIGHT, width: totalPx }}
							>
								{/* Scene-boundary tick marks for orientation */}
								{lane.key === "music" || lane.key === "sfx"
									? sceneSpans(project).map((span) => (
											<div
												key={`${lane.key}-${span.id}`}
												className="absolute top-0 bottom-0 border-l border-neutral-800/60 pointer-events-none"
												style={{ left: secToPx(span.start, pxPerSec) }}
											/>
										))
									: null}
								{lane.clips.map((clip) => {
									const left = secToPx(clip.start, pxPerSec);
									const width = secToPx(clip.end - clip.start, pxPerSec);
									const [clipKind, clipDataId] = clip.id.split(":");

									// Move is opt-in per kind. Only sfxclip is freely positioned.
									const onMoveSec =
										clipKind === "sfxclip"
											? (deltaSec: number, phase: "start" | "drag" | "end") => {
													const found = project.sfxClips?.find(
														(c) => c.id === clipDataId,
													);
													if (!found) return;
													if (phase === "start") {
														dragOrigin.current.set(clip.id, {
															startFrame: found.startFrame,
														});
														beginHistoryGroup();
														return;
													}
													const origin =
														dragOrigin.current.get(clip.id)?.startFrame ??
														found.startFrame;
													// Snap the leading edge to scene boundaries / playhead
													// — but only if the user has the magnet enabled.
													const candidateSec =
														(origin + deltaSec * project.fps) / project.fps;
													let resolved = candidateSec;
													if (snapEnabled) {
														const playheadSec =
															previewFrame !== null
																? previewFrame / project.fps
																: null;
														const targets = buildSnapTargets(
															project,
															playheadSec,
														);
														resolved = snap(candidateSec, targets, pxPerSec).value;
													}
													const next = Math.max(
														0,
														Math.round(resolved * project.fps),
													);
													updateSfxClip(clipDataId, { startFrame: next });
													if (phase === "end") {
														dragOrigin.current.delete(clip.id);
														endHistoryGroup();
													}
												}
											: undefined;

									// Trim — supported for vo / music / sfxclip; the in-scene
									// "sfx" kind is read-only positioning so skip.
									const onTrimSec =
										clipKind === "vo" ||
										clipKind === "music" ||
										clipKind === "sfxclip"
											? (
													startDelta: number,
													endDelta: number,
													phase: "start" | "drag" | "end",
												) => {
													if (clipKind === "vo") {
														const scene = project.scenes.find(
															(s) => s.id === clipDataId,
														);
														if (!scene?.voiceover) return;
														const vo = scene.voiceover;
														if (phase === "start") {
															dragOrigin.current.set(clip.id, {
																trimStart: vo.trimStartSec ?? 0,
																trimEnd: vo.trimEndSec ?? vo.audioDurationSec,
																audioDuration: vo.audioDurationSec,
															});
															beginHistoryGroup();
															return;
														}
														const origin = dragOrigin.current.get(clip.id);
														if (!origin) return;
														const dur = origin.audioDuration ?? vo.audioDurationSec;
														const newStart = Math.max(
															0,
															Math.min(
																(origin.trimEnd ?? dur) - 0.05,
																(origin.trimStart ?? 0) + startDelta,
															),
														);
														const newEnd = Math.max(
															newStart + 0.05,
															Math.min(
																dur,
																(origin.trimEnd ?? dur) + endDelta,
															),
														);
														updateScene(scene.id, {
															voiceover: {
																...vo,
																trimStartSec: newStart,
																trimEndSec: newEnd,
															},
														});
														if (phase === "end") {
															dragOrigin.current.delete(clip.id);
															endHistoryGroup();
														}
													} else if (clipKind === "music" && project.music) {
														const m = project.music;
														if (phase === "start") {
															dragOrigin.current.set(clip.id, {
																trimStart: m.trimStartSec ?? 0,
																trimEnd: m.trimEndSec ?? totalSec,
															});
															beginHistoryGroup();
															return;
														}
														const origin = dragOrigin.current.get(clip.id);
														if (!origin) return;
														const newStart = Math.max(
															0,
															(origin.trimStart ?? 0) + startDelta,
														);
														const newEnd = Math.max(
															newStart + 0.05,
															(origin.trimEnd ?? totalSec) + endDelta,
														);
														setMusic({
															...m,
															trimStartSec: newStart,
															trimEndSec: newEnd,
														});
														if (phase === "end") {
															dragOrigin.current.delete(clip.id);
															endHistoryGroup();
														}
													} else if (clipKind === "sfxclip") {
														const found = project.sfxClips?.find(
															(c) => c.id === clipDataId,
														);
														if (!found) return;
														const dur = found.durationFrames / project.fps;
														if (phase === "start") {
															dragOrigin.current.set(clip.id, {
																trimStart: found.trimStartSec ?? 0,
																trimEnd: found.trimEndSec ?? dur,
															});
															beginHistoryGroup();
															return;
														}
														const origin = dragOrigin.current.get(clip.id);
														if (!origin) return;
														const newStart = Math.max(
															0,
															Math.min(
																(origin.trimEnd ?? dur) - 0.05,
																(origin.trimStart ?? 0) + startDelta,
															),
														);
														const newEnd = Math.max(
															newStart + 0.05,
															Math.min(
																dur,
																(origin.trimEnd ?? dur) + endDelta,
															),
														);
														updateSfxClip(clipDataId, {
															trimStartSec: newStart,
															trimEndSec: newEnd,
														});
														if (phase === "end") {
															dragOrigin.current.delete(clip.id);
															endHistoryGroup();
														}
													}
												}
											: undefined;

									return (
										<AudioClip
											key={clip.id}
											kind={lane.key}
											id={clip.id}
											src={clip.src}
											leftPx={left}
											widthPx={width}
											pxPerSec={pxPerSec}
											label={clip.label}
											subLabel={clip.subLabel}
											selected={selectedId === clip.id}
											onSelect={() =>
												setSelected(selectedId === clip.id ? null : clip.id)
											}
											onMoveSec={onMoveSec}
											onTrimSec={onTrimSec}
										/>
									);
								})}
								{lane.clips.length === 0 ? (
									<div className="absolute inset-0 flex items-center justify-center text-[10px] text-neutral-600 italic pointer-events-none">
										No {lane.title.toLowerCase()} clips
									</div>
								) : null}
							</div>
						))}
					</div>
				</div>
			</div>
		</div>
	);
}
