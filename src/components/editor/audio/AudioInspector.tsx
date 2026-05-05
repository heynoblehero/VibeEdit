"use client";

import { Bookmark, Check, Trash2, X } from "lucide-react";
import { type ReactNode, useState } from "react";
import type { AudioSfxClip, MusicBed, Voiceover } from "@/lib/scene-schema";
import {
	type LibraryAssetKind,
	useAssetLibraryStore,
} from "@/store/asset-library-store";
import { useEditorStore } from "@/store/editor-store";
import { useProjectStore } from "@/store/project-store";

/**
 * Right-pane editor for whichever clip is selected in the audio
 * timeline. Mutates the project directly so changes flow through
 * Composition.tsx and the timeline UI immediately.
 *
 * Selected-clip id format mirrors the timeline: `{kind}:{id}`.
 *   - vo:<sceneId>      → edits scene.voiceover
 *   - music:project     → edits project.music
 *   - sfx:<sceneId>     → edits scene.audioGain (one knob until phase 7's
 *                          free-floating sfxClips ship richer fields)
 */
export function AudioInspector() {
	const selected = useEditorStore((s) => s.audioSelectedClipId);
	const setSelected = useEditorStore((s) => s.setAudioSelectedClipId);
	const project = useProjectStore((s) => s.project);
	const updateScene = useProjectStore((s) => s.updateScene);
	const setMusic = useProjectStore((s) => s.setMusic);
	const updateSfxClip = useProjectStore((s) => s.updateSfxClip);
	const removeSfxClip = useProjectStore((s) => s.removeSfxClip);

	if (!selected) {
		return (
			<div className="rounded-md border border-dashed border-neutral-800 p-3 space-y-1.5">
				<div className="text-[11px] text-neutral-400">Select a clip on the timeline.</div>
				<div className="text-[10px] text-neutral-500">
					Trim, fade, and gain controls appear here.
				</div>
			</div>
		);
	}

	const [kind, id] = selected.split(":");

	if (kind === "vo") {
		const scene = project.scenes.find((s) => s.id === id);
		if (!scene?.voiceover) {
			return <Empty onClose={() => setSelected(null)} />;
		}
		const vo = scene.voiceover;
		const patch = (next: Partial<Voiceover>) =>
			updateScene(scene.id, { voiceover: { ...vo, ...next } });
		const idx = project.scenes.findIndex((s) => s.id === id) + 1;
		return (
			<Card title={`Voiceover · Scene ${idx}`} onClose={() => setSelected(null)}>
				<Meta src={vo.audioUrl} duration={vo.audioDurationSec} extra={`${vo.voice} · ${vo.provider}`} />
				<TrimGroup
					start={vo.trimStartSec ?? 0}
					end={vo.trimEndSec ?? vo.audioDurationSec}
					max={vo.audioDurationSec}
					onChange={(start, end) => patch({ trimStartSec: start, trimEndSec: end })}
				/>
				<FadeGroup
					fadeIn={vo.fadeInSec ?? 0}
					fadeOut={vo.fadeOutSec ?? 0}
					maxFade={Math.min(2, vo.audioDurationSec / 2)}
					onChange={(fadeIn, fadeOut) =>
						patch({ fadeInSec: fadeIn, fadeOutSec: fadeOut })
					}
				/>
				<Gain value={vo.gain ?? 1} onChange={(g) => patch({ gain: g })} />
				<div className="flex items-center justify-between pt-1 border-t border-neutral-800/60">
					<SaveToLibraryButton url={vo.audioUrl} name={`Scene ${idx} VO`} kind="sfx" />
					<DangerRow
						label="Remove"
						onClick={() => updateScene(scene.id, { voiceover: undefined })}
					/>
				</div>
			</Card>
		);
	}

	if (kind === "music") {
		if (!project.music) return <Empty onClose={() => setSelected(null)} />;
		const m = project.music;
		const totalSec = project.scenes.reduce((acc, s) => acc + (s.duration ?? 0), 0);
		const patch = (next: Partial<MusicBed>) => setMusic({ ...m, ...next });
		return (
			<Card title="Music · project bed" onClose={() => setSelected(null)}>
				<Meta src={m.url} duration={totalSec} extra={m.name} />
				<TrimGroup
					start={m.trimStartSec ?? 0}
					end={m.trimEndSec ?? totalSec}
					max={Math.max(totalSec, m.trimEndSec ?? totalSec)}
					onChange={(start, end) => patch({ trimStartSec: start, trimEndSec: end })}
				/>
				<FadeGroup
					fadeIn={m.fadeInSec ?? 0.6}
					fadeOut={m.fadeOutSec ?? 0.6}
					maxFade={Math.min(4, totalSec / 2)}
					onChange={(fadeIn, fadeOut) => patch({ fadeInSec: fadeIn, fadeOutSec: fadeOut })}
				/>
				<div className="space-y-1">
					<Label>Volume</Label>
					<input
						type="range"
						min={0}
						max={1}
						step={0.01}
						value={m.volume ?? 0.55}
						onChange={(e) => patch({ volume: Number(e.target.value) })}
						className="w-full accent-orange-400"
					/>
					<RangeMeta value={`${Math.round((m.volume ?? 0.55) * 100)}%`} />
				</div>
				<div className="space-y-1">
					<Label>Ducked under voice</Label>
					<input
						type="range"
						min={0}
						max={1}
						step={0.01}
						value={m.duckedVolume ?? 0.18}
						onChange={(e) => patch({ duckedVolume: Number(e.target.value) })}
						className="w-full accent-orange-400"
					/>
					<RangeMeta value={`${Math.round((m.duckedVolume ?? 0.18) * 100)}%`} />
				</div>
				<div className="flex items-center justify-between pt-1 border-t border-neutral-800/60">
					<SaveToLibraryButton url={m.url} name={m.name} kind="music" />
					<DangerRow label="Remove" onClick={() => setMusic(undefined)} />
				</div>
			</Card>
		);
	}

	if (kind === "sfxclip") {
		const clip = project.sfxClips?.find((c) => c.id === id);
		if (!clip) return <Empty onClose={() => setSelected(null)} />;
		const fps = project.fps;
		const sourceDurationSec = clip.durationFrames / fps;
		const patch = (next: Partial<AudioSfxClip>) => updateSfxClip(clip.id, next);
		return (
			<Card title={`SFX clip · ${clip.name}`} onClose={() => setSelected(null)}>
				<Meta src={clip.url} duration={sourceDurationSec} extra={clip.name} />
				<div className="space-y-1">
					<Label>Position (frames)</Label>
					<input
						type="number"
						value={clip.startFrame}
						min={0}
						step={1}
						onChange={(e) =>
							patch({ startFrame: Math.max(0, Number(e.target.value)) })
						}
						className="w-full px-2 py-1 text-[11px] rounded bg-neutral-950 border border-neutral-800 text-neutral-200"
					/>
				</div>
				<TrimGroup
					start={clip.trimStartSec ?? 0}
					end={clip.trimEndSec ?? sourceDurationSec}
					max={sourceDurationSec}
					onChange={(start, end) => patch({ trimStartSec: start, trimEndSec: end })}
				/>
				<FadeGroup
					fadeIn={clip.fadeInSec ?? 0}
					fadeOut={clip.fadeOutSec ?? 0}
					maxFade={Math.min(2, sourceDurationSec / 2)}
					onChange={(fadeIn, fadeOut) =>
						patch({ fadeInSec: fadeIn, fadeOutSec: fadeOut })
					}
				/>
				<Gain value={clip.gain ?? 1} onChange={(g) => patch({ gain: g })} />
				<div className="flex items-center justify-between pt-1 border-t border-neutral-800/60">
					<SaveToLibraryButton url={clip.url} name={clip.name} kind="sfx" />
					<DangerRow
						label="Remove"
						onClick={() => {
							removeSfxClip(clip.id);
							setSelected(null);
						}}
					/>
				</div>
			</Card>
		);
	}

	if (kind === "sfx") {
		const scene = project.scenes.find((s) => s.id === id);
		if (!scene) return <Empty onClose={() => setSelected(null)} />;
		const idx = project.scenes.findIndex((s) => s.id === id) + 1;
		return (
			<Card title={`SFX · Scene ${idx}`} onClose={() => setSelected(null)}>
				<Meta
					src={scene.sceneSfxUrl ?? ""}
					duration={scene.duration}
					extra={scene.sfxId ?? "Custom SFX"}
				/>
				<Gain
					value={scene.audioGain ?? 1}
					onChange={(g) => updateScene(scene.id, { audioGain: g })}
				/>
				<div className="flex items-center justify-between pt-1 border-t border-neutral-800/60">
					{scene.sceneSfxUrl ? (
						<SaveToLibraryButton
							url={scene.sceneSfxUrl}
							name={scene.sfxId ?? `Scene ${idx} SFX`}
							kind="sfx"
						/>
					) : (
						<span />
					)}
					<DangerRow
						label="Remove"
						onClick={() =>
							updateScene(scene.id, { sceneSfxUrl: undefined, sfxId: undefined })
						}
					/>
				</div>
			</Card>
		);
	}

	return <Empty onClose={() => setSelected(null)} />;
}

function Card({
	title,
	onClose,
	children,
}: {
	title: string;
	onClose: () => void;
	children: ReactNode;
}) {
	return (
		<div className="rounded-md border border-orange-500/30 bg-neutral-950/60 p-3 space-y-3">
			<div className="flex items-center justify-between">
				<span className="text-[11px] uppercase tracking-wider text-orange-300 font-semibold">
					{title}
				</span>
				<button
					type="button"
					onClick={onClose}
					className="text-neutral-500 hover:text-neutral-200"
					title="Close"
				>
					<X className="h-3.5 w-3.5" />
				</button>
			</div>
			{children}
		</div>
	);
}

function Empty({ onClose }: { onClose: () => void }) {
	return (
		<Card title="Clip" onClose={onClose}>
			<div className="text-[11px] text-neutral-400">
				This clip is no longer on the timeline.
			</div>
		</Card>
	);
}

function Meta({
	src,
	duration,
	extra,
}: {
	src: string;
	duration: number;
	extra?: string;
}) {
	return (
		<div className="space-y-1.5">
			{extra ? <div className="text-[10px] text-neutral-400 truncate">{extra}</div> : null}
			<div className="text-[10px] text-neutral-500">{duration.toFixed(2)}s source</div>
			{src ? (
				<audio
					src={src}
					controls
					className="w-full h-7"
					style={{ filter: "hue-rotate(45deg) saturate(1.4)" }}
				/>
			) : null}
		</div>
	);
}

function TrimGroup({
	start,
	end,
	max,
	onChange,
}: {
	start: number;
	end: number;
	max: number;
	onChange: (start: number, end: number) => void;
}) {
	const safeMax = Math.max(max, end, 0.1);
	return (
		<div className="space-y-2">
			<Label>Trim</Label>
			<div className="space-y-1">
				<div className="flex items-center justify-between text-[10px] text-neutral-400">
					<span>Start</span>
					<span className="font-mono tabular-nums">{start.toFixed(2)}s</span>
				</div>
				<input
					type="range"
					min={0}
					max={safeMax}
					step={0.05}
					value={Math.min(start, end - 0.05)}
					onChange={(e) =>
						onChange(Math.min(Number(e.target.value), end - 0.05), end)
					}
					className="w-full accent-orange-400"
				/>
			</div>
			<div className="space-y-1">
				<div className="flex items-center justify-between text-[10px] text-neutral-400">
					<span>End</span>
					<span className="font-mono tabular-nums">{end.toFixed(2)}s</span>
				</div>
				<input
					type="range"
					min={0}
					max={safeMax}
					step={0.05}
					value={Math.max(end, start + 0.05)}
					onChange={(e) =>
						onChange(start, Math.max(Number(e.target.value), start + 0.05))
					}
					className="w-full accent-orange-400"
				/>
			</div>
		</div>
	);
}

function FadeGroup({
	fadeIn,
	fadeOut,
	maxFade,
	onChange,
}: {
	fadeIn: number;
	fadeOut: number;
	maxFade: number;
	onChange: (fadeIn: number, fadeOut: number) => void;
}) {
	return (
		<div className="space-y-2">
			<Label>Fades</Label>
			<div className="space-y-1">
				<div className="flex items-center justify-between text-[10px] text-neutral-400">
					<span>Fade in</span>
					<span className="font-mono tabular-nums">{fadeIn.toFixed(2)}s</span>
				</div>
				<input
					type="range"
					min={0}
					max={maxFade}
					step={0.05}
					value={fadeIn}
					onChange={(e) => onChange(Number(e.target.value), fadeOut)}
					className="w-full accent-orange-400"
				/>
			</div>
			<div className="space-y-1">
				<div className="flex items-center justify-between text-[10px] text-neutral-400">
					<span>Fade out</span>
					<span className="font-mono tabular-nums">{fadeOut.toFixed(2)}s</span>
				</div>
				<input
					type="range"
					min={0}
					max={maxFade}
					step={0.05}
					value={fadeOut}
					onChange={(e) => onChange(fadeIn, Number(e.target.value))}
					className="w-full accent-orange-400"
				/>
			</div>
		</div>
	);
}

function Gain({ value, onChange }: { value: number; onChange: (v: number) => void }) {
	return (
		<div className="space-y-1">
			<div className="flex items-center justify-between">
				<Label>Gain</Label>
				<span className="text-[10px] font-mono text-neutral-400 tabular-nums">
					{Math.round(value * 100)}%
				</span>
			</div>
			<input
				type="range"
				min={0}
				max={2}
				step={0.01}
				value={value}
				onChange={(e) => onChange(Number(e.target.value))}
				className="w-full accent-orange-400"
			/>
		</div>
	);
}

function Label({ children }: { children: ReactNode }) {
	return (
		<div className="text-[10px] uppercase tracking-wider text-orange-300/80 font-semibold">
			{children}
		</div>
	);
}

function RangeMeta({ value }: { value: string }) {
	return (
		<div className="text-[10px] font-mono text-neutral-500 tabular-nums text-right">
			{value}
		</div>
	);
}

function SaveToLibraryButton({
	url,
	name,
	kind,
}: {
	url: string;
	name: string;
	kind: LibraryAssetKind;
}) {
	const add = useAssetLibraryStore((s) => s.add);
	const assets = useAssetLibraryStore((s) => s.assets);
	const alreadySaved = assets.some((a) => a.url === url);
	const [justSaved, setJustSaved] = useState(false);

	const save = () => {
		if (alreadySaved) return;
		add({ url, name, kind, tags: [] });
		setJustSaved(true);
		window.setTimeout(() => setJustSaved(false), 1800);
	};

	return (
		<button
			type="button"
			onClick={save}
			disabled={alreadySaved}
			className="flex items-center gap-1.5 text-[11px] text-orange-300 hover:text-orange-200 disabled:text-neutral-500 disabled:cursor-default"
		>
			{justSaved || alreadySaved ? (
				<Check className="h-3 w-3" />
			) : (
				<Bookmark className="h-3 w-3" />
			)}
			{alreadySaved ? "In library" : justSaved ? "Saved" : "Save to library"}
		</button>
	);
}

function DangerRow({ label, onClick }: { label: string; onClick: () => void }) {
	return (
		<button
			type="button"
			onClick={onClick}
			className="flex items-center gap-1.5 text-[11px] text-red-300/80 hover:text-red-300"
		>
			<Trash2 className="h-3 w-3" />
			{label}
		</button>
	);
}
