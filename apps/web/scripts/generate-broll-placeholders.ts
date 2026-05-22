#!/usr/bin/env tsx
/*
 * Generates short procedural placeholder b-roll loops via ffmpeg so the URLs
 * in src/lib/stock/registry.ts return real MP4 instead of 404. These are
 * obviously procedural — replace with sourced CC0 clips before launch.
 *
 * Usage: bun run broll:placeholders
 */

import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

type Clip = {
	slug: string;
	durationSeconds: number;
	width: number;
	height: number;
	// One lavfi source. Each clip uses a different generator to stay distinct.
	source: string;
};

const CLIPS: Clip[] = [
	{
		slug: "neon-city-aerial",
		durationSeconds: 8,
		width: 1920,
		height: 1080,
		source:
			"color=#0a0d20:size=1920x1080:duration=8,format=yuv420p,geq=r='128+80*sin(0.04*X+T*2)':g='40+60*sin(0.02*Y-T*2)':b='180+70*sin(0.03*X+0.04*Y+T*3)'",
	},
	{
		slug: "money-rain",
		durationSeconds: 6,
		width: 1920,
		height: 1080,
		source:
			"color=#0d2515:size=1920x1080:duration=6,format=yuv420p,geq=r='80+10*sin(X*0.5+T*10)':g='180+60*sin(Y*0.2+T*8)':b='40+20*sin(X*0.3+T*5)'",
	},
	{
		slug: "glitch-overlay",
		durationSeconds: 5,
		width: 1920,
		height: 1080,
		source:
			"mandelbrot=size=1920x1080:rate=24:maxiter=30:end_pts=5,hue=h=t*120:s=1",
	},
	{
		slug: "particles-purple",
		durationSeconds: 8,
		width: 1920,
		height: 1080,
		source:
			"color=#1a0a2e:size=1920x1080:duration=8,format=yuv420p,geq=r='40+20*sin(hypot(X-960\\,Y-540)*0.02-T*3)':g='10+10*sin(hypot(X-960\\,Y-540)*0.02-T*3)':b='80+50*sin(hypot(X-960\\,Y-540)*0.02-T*3)'",
	},
	{
		slug: "starfield-slow",
		durationSeconds: 10,
		width: 1920,
		height: 1080,
		source:
			"color=#000005:size=1920x1080:duration=10,format=yuv420p,geq=r='200*lt(mod(X*Y+T*200\\,4000)\\,15)':g='200*lt(mod(X*Y+T*200\\,4000)\\,15)':b='240*lt(mod(X*Y+T*200\\,4000)\\,15)'",
	},
	{
		slug: "parchment-burn",
		durationSeconds: 6,
		width: 1920,
		height: 1080,
		source:
			"color=#2a1c10:size=1920x1080:duration=6,format=yuv420p,geq=r='180+40*sin(X*0.005+Y*0.005+T)':g='140+30*sin(X*0.005+Y*0.005+T)':b='90+20*sin(X*0.005+Y*0.005+T)'",
	},
	{
		slug: "rain-window",
		durationSeconds: 12,
		width: 1920,
		height: 1080,
		source:
			"color=#0a1525:size=1920x1080:duration=12,format=yuv420p,geq=r='30+10*sin(Y*0.5-T*40)':g='40+15*sin(Y*0.5-T*40)':b='80+30*sin(Y*0.5-T*40)'",
	},
];

function main() {
	const outDir = resolve(process.cwd(), "public", "stock", "broll");
	mkdirSync(outDir, { recursive: true });
	for (const clip of CLIPS) {
		const outPath = `${outDir}/${clip.slug}.mp4`;
		const args = [
			"-y",
			"-f",
			"lavfi",
			"-i",
			clip.source,
			"-t",
			String(clip.durationSeconds),
			"-c:v",
			"libx264",
			"-pix_fmt",
			"yuv420p",
			"-preset",
			"veryfast",
			"-crf",
			"30",
			"-movflags",
			"+faststart",
			outPath,
		];
		const result = spawnSync("ffmpeg", args, { stdio: "ignore" });
		if (result.status !== 0) {
			console.error(`× ffmpeg failed for ${clip.slug} (status ${result.status})`);
			process.exit(1);
		}
		console.log(`✓ ${clip.slug}.mp4 (${clip.durationSeconds}s)`);
	}
}

main();
