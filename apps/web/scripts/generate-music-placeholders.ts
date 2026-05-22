#!/usr/bin/env tsx
/*
 * Generates short procedural placeholder music tracks via ffmpeg so the URLs
 * in src/lib/stock/registry.ts return real audio (instead of 404). These are
 * not finished music — they're mood-distinct sine/triangle loops so the agent
 * has something playable while waiting for real CC0 sourcing.
 *
 * Usage: bun run music:placeholders
 */

import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

type Track = {
	slug: string;
	durationSeconds: number;
	bpm: number;
	// 'a*sin(2*PI*F*t)' filter expression. Multiple tones layered for character.
	expression: string;
	volumeDb: number;
};

const TRACKS: Track[] = [
	{
		slug: "comic-pulse",
		durationSeconds: 12,
		bpm: 128,
		expression:
			"sin(2*PI*220*t)*0.4 + sin(2*PI*330*t)*0.2 + 0.4*sin(2*PI*55*t)*sin(2*PI*4*t)",
		volumeDb: -10,
	},
	{
		slug: "anime-rush",
		durationSeconds: 12,
		bpm: 140,
		expression:
			"sin(2*PI*440*t)*0.3 + sin(2*PI*880*t)*0.15 + 0.5*sin(2*PI*65*t)*sin(2*PI*5*t)",
		volumeDb: -10,
	},
	{
		slug: "history-drone",
		durationSeconds: 16,
		bpm: 70,
		expression:
			"sin(2*PI*110*t)*0.5 + sin(2*PI*165*t)*0.25 + sin(2*PI*82.5*t)*0.3",
		volumeDb: -12,
	},
	{
		slug: "finance-pulse",
		durationSeconds: 12,
		bpm: 124,
		expression:
			"sin(2*PI*262*t)*0.3 + sin(2*PI*392*t)*0.2 + 0.4*sin(2*PI*65*t)*sin(2*PI*4*t)",
		volumeDb: -10,
	},
	{
		slug: "sleep-pad",
		durationSeconds: 20,
		bpm: 55,
		expression:
			"sin(2*PI*220*t)*0.4 + sin(2*PI*277*t)*0.3 + sin(2*PI*329*t)*0.2",
		volumeDb: -14,
	},
	{
		slug: "scary-rumble",
		durationSeconds: 16,
		bpm: 60,
		expression: "sin(2*PI*48*t)*0.6 + sin(2*PI*72*t)*0.2 + sin(2*PI*55*t)*0.3",
		volumeDb: -10,
	},
	{
		slug: "tech-driver",
		durationSeconds: 12,
		bpm: 118,
		expression:
			"sin(2*PI*196*t)*0.3 + sin(2*PI*392*t)*0.2 + 0.4*sin(2*PI*65*t)*sin(2*PI*4*t)",
		volumeDb: -10,
	},
	{
		slug: "scifi-pulse",
		durationSeconds: 16,
		bpm: 90,
		expression:
			"sin(2*PI*220*t)*0.3 + sin(2*PI*330*t)*0.2 + sin(2*PI*55*t)*0.4",
		volumeDb: -12,
	},
];

function main() {
	const outDir = resolve(process.cwd(), "public", "stock", "music");
	mkdirSync(outDir, { recursive: true });
	for (const track of TRACKS) {
		const outPath = `${outDir}/${track.slug}.mp3`;
		const filter = `aevalsrc=exprs=${escapeFilter(track.expression)}:sample_rate=44100:duration=${track.durationSeconds},volume=${track.volumeDb}dB`;
		const args = [
			"-y",
			"-f",
			"lavfi",
			"-i",
			filter,
			"-codec:a",
			"libmp3lame",
			"-b:a",
			"96k",
			outPath,
		];
		const result = spawnSync("ffmpeg", args, { stdio: "ignore" });
		if (result.status !== 0) {
			console.error(`× ffmpeg failed for ${track.slug} (status ${result.status})`);
			process.exit(1);
		}
		console.log(`✓ ${track.slug}.mp3 (${track.durationSeconds}s, ${track.bpm}bpm)`);
	}
}

function escapeFilter(expression: string): string {
	// ffmpeg's lavfi expression parser needs commas/colons escaped inside aevalsrc.
	return expression.replace(/,/g, "\\,").replace(/:/g, "\\:");
}

main();
