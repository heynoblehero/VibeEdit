"use client";

import { useEffect, useRef, useState } from "react";
import { peakAt } from "@/components/editor/AudioWaveform";
import { sceneStartSec } from "@/lib/audio/clip-math";
import { useEditorStore } from "@/store/editor-store";
import { useProjectStore } from "@/store/project-store";

/**
 * Stereo-style peak meter for the Audio workspace preview. Reads
 * cached waveform peaks at the current playhead and decays the
 * displayed level with a 6dB-per-frame ballistic so the bars don't
 * look like a strobe.
 *
 * This is an approximation — true broadcast-grade metering would tap
 * the live audio graph — but it's accurate enough for users to
 * verify "yes, the voiceover is hot," without an extra Web Audio
 * routing layer that fights the Remotion player.
 */
export function LevelMeter() {
	const project = useProjectStore((s) => s.project);
	const previewFrame = useEditorStore((s) => s.previewFrame);
	const paused = useEditorStore((s) => s.isPaused);
	const mix = project.audioMix;
	const [peak, setPeak] = useState({ voice: 0, music: 0, sfx: 0 });
	const decayRef = useRef({ voice: 0, music: 0, sfx: 0 });

	useEffect(() => {
		const fps = project.fps;
		const tSec = previewFrame / fps;

		// Voice = the active scene's voiceover at its local time.
		let voice = 0;
		const spans = project.scenes.reduce<{ acc: number; ranges: Array<{ id: string; start: number; end: number; src?: string }> }>(
			(s, sc) => {
				const start = s.acc;
				const end = start + (sc.duration ?? 0);
				s.ranges.push({ id: sc.id, start, end, src: sc.voiceover?.audioUrl });
				s.acc = end;
				return s;
			},
			{ acc: 0, ranges: [] },
		).ranges;
		const cur = spans.find((r) => tSec >= r.start && tSec < r.end);
		if (cur?.src) {
			const dur = cur.end - cur.start;
			voice = peakAt(cur.src, dur > 0 ? (tSec - cur.start) / dur : 0);
		}

		// Music plays across the whole project.
		let music = 0;
		if (project.music?.url) {
			const totalSec = spans.length > 0 ? spans[spans.length - 1].end : 1;
			music = peakAt(project.music.url, totalSec > 0 ? tSec / totalSec : 0);
		}

		// SFX = first matching free-floating clip at this frame.
		let sfx = 0;
		const f = previewFrame;
		const clip = (project.sfxClips ?? []).find(
			(c) => f >= c.startFrame && f < c.startFrame + c.durationFrames,
		);
		if (clip) {
			const frac = (f - clip.startFrame) / clip.durationFrames;
			sfx = peakAt(clip.url, frac);
		}

		// Apply master mix multipliers so the meter matches what users
		// hear after the renderer's rail blend.
		voice *= mix?.voice ?? 1;
		music *= mix?.music ?? 1;
		sfx *= mix?.sfx ?? 1;

		// Ballistic decay — peak rises instantly, falls ~6dB per render
		// tick. Keeps the meter readable instead of strobing.
		const next = decayRef.current;
		next.voice = paused ? next.voice * 0.85 : Math.max(voice, next.voice * 0.85);
		next.music = paused ? next.music * 0.85 : Math.max(music, next.music * 0.85);
		next.sfx = paused ? next.sfx * 0.85 : Math.max(sfx, next.sfx * 0.85);
		setPeak({ voice: next.voice, music: next.music, sfx: next.sfx });
	}, [previewFrame, project, mix, paused]);

	// Suppress unused-import lint while keeping sceneStartSec available
	// for future per-clip derivations.
	void sceneStartSec;

	return (
		<div className="flex items-center gap-1.5 px-2 py-1 rounded bg-black/40 border border-orange-500/20">
			<MeterBar label="V" level={peak.voice} />
			<MeterBar label="M" level={peak.music} />
			<MeterBar label="S" level={peak.sfx} />
		</div>
	);
}

function MeterBar({ label, level }: { label: string; level: number }) {
	const pct = Math.min(100, Math.max(0, level * 100));
	const danger = pct > 92;
	const warn = !danger && pct > 78;
	const bar = danger
		? "bg-red-400"
		: warn
			? "bg-orange-300"
			: "bg-emerald-400";
	return (
		<div className="flex flex-col items-center gap-0.5">
			<div className="relative w-2 h-10 bg-neutral-900 rounded overflow-hidden border border-neutral-800">
				<div
					className={`absolute inset-x-0 bottom-0 ${bar} transition-[height] duration-75 ease-linear`}
					style={{ height: `${pct}%` }}
				/>
			</div>
			<span className="text-[8px] text-neutral-500 font-mono">{label}</span>
		</div>
	);
}
