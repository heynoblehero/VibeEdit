/**
 * Pixel ↔ second conversions for the Audio workspace timeline. The
 * Audio timeline uses its own zoom rather than reusing the video
 * timeline's `useEditorStore.timelineZoom` so users can scrub the
 * audio at a different scale than the scene strip above.
 */

import type { Project, Scene } from "@/lib/scene-schema";

/** Default px/sec — comfortable for a 30-60s short on a 1440px screen. */
export const DEFAULT_PX_PER_SEC = 60;

/** Hard floor / ceiling so zoom never collapses or explodes the layout. */
export const PX_PER_SEC_BOUNDS = { min: 8, max: 240 } as const;

export function clampZoom(value: number): number {
	return Math.max(PX_PER_SEC_BOUNDS.min, Math.min(PX_PER_SEC_BOUNDS.max, value));
}

export const secToPx = (sec: number, pxPerSec: number): number => sec * pxPerSec;
export const pxToSec = (px: number, pxPerSec: number): number => px / pxPerSec;

/** Total project duration in seconds — sum of scene durations. */
export function projectDurationSec(project: Project): number {
	return project.scenes.reduce((acc, s) => acc + (s.duration ?? 0), 0);
}

/** Where this scene starts on the project timeline (seconds from t=0). */
export function sceneStartSec(project: Project, scene: Scene): number {
	let acc = 0;
	for (const s of project.scenes) {
		if (s.id === scene.id) return acc;
		acc += s.duration ?? 0;
	}
	return acc;
}

/** Build (start, end) for every scene — useful for the SFX overlay. */
export function sceneSpans(project: Project): { id: string; start: number; end: number }[] {
	let cursor = 0;
	return project.scenes.map((s) => {
		const start = cursor;
		const end = start + (s.duration ?? 0);
		cursor = end;
		return { id: s.id, start, end };
	});
}

/** Format a time in seconds as M:SS for the ruler / clip labels. */
export function formatSec(totalSec: number): string {
	if (!Number.isFinite(totalSec) || totalSec < 0) return "0:00";
	const m = Math.floor(totalSec / 60);
	const s = Math.floor(totalSec % 60);
	return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * Snap a candidate time (sec) to the nearest interesting time —
 * scene boundaries, clip edges, and the playhead. The threshold scales
 * inversely with zoom: at high zoom the snap radius shrinks so users
 * can still place clips between two close cuts.
 */
export interface SnapTarget {
	sec: number;
	kind: "scene" | "playhead" | "clip-edge";
}

export function snap(
	candidate: number,
	targets: SnapTarget[],
	pxPerSec: number,
): { value: number; hit: SnapTarget | null } {
	// 8px-radius snap window converted to seconds at the current zoom.
	const radius = 8 / Math.max(1, pxPerSec);
	let best: SnapTarget | null = null;
	let bestDist = radius;
	for (const t of targets) {
		const d = Math.abs(t.sec - candidate);
		if (d < bestDist) {
			bestDist = d;
			best = t;
		}
	}
	return best ? { value: best.sec, hit: best } : { value: candidate, hit: null };
}

/** Build the canonical snap-target list for a given project + playhead. */
export function buildSnapTargets(
	project: Project,
	playheadSec: number | null,
): SnapTarget[] {
	const targets: SnapTarget[] = [];
	const spans = sceneSpans(project);
	for (const s of spans) {
		targets.push({ sec: s.start, kind: "scene" });
	}
	if (spans.length > 0) {
		targets.push({ sec: spans[spans.length - 1].end, kind: "scene" });
	}
	if (playheadSec !== null && Number.isFinite(playheadSec)) {
		targets.push({ sec: playheadSec, kind: "playhead" });
	}
	return targets;
}
