/**
 * Time-format helpers shared across the editor. SMPTE (HH:MM:SS:FF) is
 * the editor convention, so we surface it on every playhead and
 * timecode strip. The shorter `MM:SS.cc` is for casual surfaces (scene
 * cards, dashboard tiles) where a frame count would be noise.
 */

export function smpte(frame: number, fps: number): string {
	const totalSec = Math.max(0, Math.floor(frame / fps));
	const hh = Math.floor(totalSec / 3600);
	const mm = Math.floor((totalSec % 3600) / 60);
	const ss = totalSec % 60;
	const ff = Math.max(0, Math.floor(frame - totalSec * fps));
	const pad = (n: number) => n.toString().padStart(2, "0");
	const tail = `${pad(mm)}:${pad(ss)}:${pad(ff)}`;
	return hh > 0 ? `${pad(hh)}:${tail}` : tail;
}

export function shortDuration(sec: number): string {
	if (sec < 60) return `${sec.toFixed(1)}s`;
	const m = Math.floor(sec / 60);
	const s = Math.floor(sec % 60);
	return `${m}:${s.toString().padStart(2, "0")}`;
}
