import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";

/**
 * Frame + audio-peak sampling for the AI critic.
 *
 * Given a rendered MP4 and its duration, sample N evenly spaced
 * frames as PNGs and a parallel array of audio RMS peaks. The agent
 * runner sends the frame PNGs as image content blocks to Sonnet's
 * vision endpoint and the peaks as text — so the Critic can spot
 * timing issues (e.g. silent stretches, audio cut off) without
 * needing audio playback.
 *
 * Returns base64 PNGs to keep the call site simple — no temp-file
 * juggling on the runner side. PNGs are deleted before return.
 */

export interface SampledFrame {
	/** Timestamp in seconds. */
	tSec: number;
	/** Base64-encoded PNG (no data:image prefix). */
	base64: string;
}

export interface SamplingResult {
	frames: SampledFrame[];
	/** RMS audio peaks at 1Hz, length ≈ floor(duration). 0..1 floats. */
	audioPeaks: number[];
}

const DEFAULT_FRAME_COUNT = 12;

/**
 * Run a child process and capture stdout into a Buffer (for binary
 * data) and stderr into a string (for diagnostics).
 */
function runFfmpeg(
	args: string[],
	options: { binary?: boolean } = {},
): Promise<{ stdout: Buffer; stderr: string; code: number }> {
	return new Promise((resolve, reject) => {
		const proc = spawn("ffmpeg", args);
		const stdoutChunks: Buffer[] = [];
		let stderr = "";
		proc.stdout.on("data", (c: Buffer) => stdoutChunks.push(c));
		proc.stderr.on("data", (c: Buffer) => {
			stderr += c.toString();
		});
		proc.on("error", (e) =>
			reject(new Error(`ffmpeg spawn failed: ${e.message}. Is ffmpeg installed on PATH?`)),
		);
		proc.on("close", (code) => {
			resolve({ stdout: Buffer.concat(stdoutChunks), stderr, code: code ?? -1 });
		});
		// Mark binary so the Buffer concat path is hot — minor: this
		// option is here for symmetry, the real binary handling is in
		// stdout chunk capture above.
		void options.binary;
	});
}

/**
 * Sample a frame at `tSec` from `videoPath` as a PNG, return base64.
 * Writes via an explicit out-path because piping PNG over stdout
 * occasionally truncates on some ffmpeg builds; file IO is robust.
 */
async function sampleOneFrame(
	videoPath: string,
	tSec: number,
	tmpDir: string,
): Promise<string> {
	const out = path.join(tmpDir, `${randomUUID()}.png`);
	const args = [
		"-hide_banner",
		"-loglevel",
		"error",
		"-ss",
		tSec.toFixed(3),
		"-i",
		videoPath,
		"-frames:v",
		"1",
		// Slight downscale for token economy — vision API handles 768
		// long-edge thumbs without losing meaningful detail. 540p source
		// → 540 long edge for portrait, 960 for landscape; cap at 768
		// either way.
		"-vf",
		"scale='min(768,iw)':'min(768,ih)':force_original_aspect_ratio=decrease",
		"-y",
		out,
	];
	const { stderr, code } = await runFfmpeg(args);
	if (code !== 0) {
		throw new Error(`ffmpeg frame extract failed (t=${tSec}): ${stderr.slice(-300)}`);
	}
	const buf = await fs.promises.readFile(out);
	await fs.promises.unlink(out).catch(() => undefined);
	return buf.toString("base64");
}

/**
 * Compute audio RMS peaks at 1Hz using ffmpeg's `astats` filter. The
 * output is parsed line-by-line — `lavfi.astats.Overall.RMS_level` is
 * negative dBFS; we convert to a 0..1 normalized value (silence → 0,
 * full-scale → 1).
 */
async function sampleAudioPeaks(
	videoPath: string,
	durationSec: number,
): Promise<number[]> {
	const sampleHz = 1; // 1 RMS sample per second — coarse but enough for the critic
	const args = [
		"-hide_banner",
		"-loglevel",
		"error",
		"-i",
		videoPath,
		// 1 sample / sec via metric_window aligned to sample rate. astats
		// emits METADATA logs we parse below.
		"-af",
		`asetnsamples=44100,astats=metadata=1:reset=1,ametadata=mode=print:key=lavfi.astats.Overall.RMS_level`,
		"-f",
		"null",
		"-",
	];
	const { stderr, code } = await runFfmpeg(args);
	if (code !== 0) {
		throw new Error(`ffmpeg audio stats failed: ${stderr.slice(-300)}`);
	}
	const peaks: number[] = [];
	// stderr lines look like: "[Parsed_ametadata_2 @ 0x...] frame:5 pts:220500 ..."
	// followed by "lavfi.astats.Overall.RMS_level=-23.456"
	const lines = stderr.split("\n");
	for (const line of lines) {
		const match = line.match(/lavfi\.astats\.Overall\.RMS_level=(-?[\d.]+)/);
		if (!match) continue;
		const dB = parseFloat(match[1]);
		// -inf or NaN → silence. Otherwise normalize -60dB..0dB to 0..1.
		if (!Number.isFinite(dB)) {
			peaks.push(0);
			continue;
		}
		const clamped = Math.min(0, Math.max(-60, dB));
		peaks.push(1 + clamped / 60);
	}
	// Cap to expected number of samples so we never overshoot.
	const expected = Math.max(1, Math.floor(durationSec * sampleHz));
	return peaks.slice(0, expected);
}

/**
 * Sample `count` frames evenly spaced over the video plus per-second
 * audio peaks. Both cheap on a 540p preview render.
 */
export async function sampleVideo(
	videoPath: string,
	durationSec: number,
	options: { count?: number } = {},
): Promise<SamplingResult> {
	const count = options.count ?? DEFAULT_FRAME_COUNT;
	if (durationSec <= 0) throw new Error("durationSec must be > 0");

	const tmpDir = path.join(os.tmpdir(), `vibeedit-sample-${randomUUID()}`);
	await fs.promises.mkdir(tmpDir, { recursive: true });

	try {
		// Time points: skip the literal first / last frame because they
		// often catch a black fade frame; offset by 5% on each side.
		const margin = durationSec * 0.05;
		const usable = durationSec - 2 * margin;
		const frames: SampledFrame[] = [];
		for (let i = 0; i < count; i++) {
			const t =
				count === 1 ? durationSec / 2 : margin + (usable * i) / (count - 1);
			const base64 = await sampleOneFrame(videoPath, t, tmpDir);
			frames.push({ tSec: t, base64 });
		}

		const audioPeaks = await sampleAudioPeaks(videoPath, durationSec).catch(() => {
			// Audio stats failing isn't fatal — likely a video-only
			// source. Critic can still review the visuals.
			return [];
		});

		return { frames, audioPeaks };
	} finally {
		await fs.promises.rm(tmpDir, { recursive: true, force: true }).catch(() => undefined);
	}
}
