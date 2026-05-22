#!/usr/bin/env node
// VibeEdit Video — local render worker.
// Polls the cloud for queued render jobs, runs them on this machine, uploads the MP4.
// Cross-platform; ships as a single self-contained binary via `bun build --compile`.

import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from "node:fs";
import { resolve, join, dirname } from "node:path";
import { tmpdir, hostname } from "node:os";
import { spawn } from "node:child_process";

type JobFile = { path: string; content: string };
type Job = {
	id: string;
	projectName: string;
	fps: number;
	quality: "draft" | "standard" | "high";
	files: JobFile[];
};

const ARGS = new Set(process.argv.slice(2));
const ONCE = ARGS.has("--once");

const CONFIG = {
	url: process.env.VIBEEDIT_URL || "https://vibeedit.video",
	token: process.env.VIBEEDIT_TOKEN || "",
	pollIntervalMs: Number(process.env.VIBEEDIT_POLL_MS || 5000),
	workDir:
		process.env.VIBEEDIT_WORK_DIR ||
		join(tmpdir(), "vibeedit-worker"),
	cliCommand: process.env.VIBEEDIT_HYPERFRAMES_CMD || "hyperframes",
	maxConcurrent: 1,
};

if (!CONFIG.token) {
	console.error(
		"× Missing VIBEEDIT_TOKEN. Get one at https://vibeedit.video/app/settings/worker",
	);
	process.exit(1);
}

console.log(`▲ vibeedit-worker on ${hostname()}`);
console.log(`  url:           ${CONFIG.url}`);
console.log(`  work dir:      ${CONFIG.workDir}`);
console.log(`  hyperframes:   ${CONFIG.cliCommand}`);
console.log(`  poll interval: ${CONFIG.pollIntervalMs}ms`);

mkdirSync(CONFIG.workDir, { recursive: true });

// Sanity-check the CLI is present
await checkCli();

let stopping = false;
process.on("SIGINT", () => {
	console.log("\n· shutting down...");
	stopping = true;
});
process.on("SIGTERM", () => {
	stopping = true;
});

await mainLoop();

async function mainLoop() {
	while (!stopping) {
		try {
			const job = await pollOnce();
			if (job) {
				console.log(`▶ job ${job.id} — ${job.projectName}`);
				await processJob(job);
				console.log(`✓ job ${job.id} done`);
				if (ONCE) {
					console.log("· --once: exiting after one job");
					return;
				}
			} else {
				if (ONCE) {
					console.log("· --once: no job available, exiting");
					return;
				}
				await sleep(CONFIG.pollIntervalMs);
			}
		} catch (error) {
			console.error("· loop error:", (error as Error).message);
			if (ONCE) return;
			await sleep(CONFIG.pollIntervalMs);
		}
	}
}

async function pollOnce(): Promise<Job | null> {
	const response = await fetch(`${CONFIG.url}/api/worker/poll`, {
		headers: { Authorization: `Bearer ${CONFIG.token}` },
	});
	if (response.status === 401) {
		console.error("× unauthorized — token is invalid or revoked");
		process.exit(1);
	}
	if (!response.ok) {
		console.error(`· poll ${response.status}: ${await response.text()}`);
		return null;
	}
	const data = (await response.json()) as { job: Job | null };
	return data.job;
}

async function processJob(job: Job): Promise<void> {
	const jobDir = join(CONFIG.workDir, job.id);
	rmSync(jobDir, { recursive: true, force: true });
	mkdirSync(jobDir, { recursive: true });

	// Write all project files from the job manifest
	for (const file of job.files) {
		const target = join(jobDir, file.path);
		mkdirSync(dirname(target), { recursive: true });
		writeFileSync(target, Buffer.from(file.content, "base64"));
	}
	console.log(`  · wrote ${job.files.length} file(s) to ${jobDir}`);

	const outputPath = join(jobDir, "output.mp4");
	try {
		await reportProgress(job.id, 0.05);
		await runHyperframes(job, jobDir, outputPath);
		await reportProgress(job.id, 0.95);
		await uploadResult(job.id, outputPath);
	} catch (error) {
		const message = (error as Error).message || String(error);
		console.error(`× job ${job.id} failed:`, message);
		await reportFailure(job.id, message);
		return;
	} finally {
		// Best-effort cleanup
		rmSync(jobDir, { recursive: true, force: true });
	}
}

async function runHyperframes(
	job: Job,
	projectDir: string,
	outputPath: string,
): Promise<void> {
	return new Promise<void>((resolveP, rejectP) => {
		const args = [
			"render",
			projectDir,
			"--output",
			outputPath,
			"--fps",
			String(job.fps),
			"--quality",
			job.quality,
		];
		const child = spawn(CONFIG.cliCommand, args, {
			stdio: ["ignore", "pipe", "pipe"],
		});
		let stderrBuf = "";
		const parseProgress = (chunk: Buffer) => {
			const text = chunk.toString();
			const m = text.match(/(\d+(?:\.\d+)?)\s*%/);
			if (m) {
				const p = Math.max(
					0.05,
					Math.min(0.94, Number(m[1]) / 100),
				);
				reportProgress(job.id, p).catch(() => {});
			}
		};
		child.stdout.on("data", parseProgress);
		child.stderr.on("data", (chunk: Buffer) => {
			parseProgress(chunk);
			stderrBuf += chunk.toString();
			if (stderrBuf.length > 8000) stderrBuf = stderrBuf.slice(-8000);
		});
		child.on("error", rejectP);
		child.on("exit", (code) =>
			code === 0
				? resolveP()
				: rejectP(
						new Error(
							`hyperframes exited ${code}: ${stderrBuf.slice(-2000)}`,
						),
					),
		);
	});
}

async function reportProgress(jobId: string, progress: number): Promise<void> {
	await fetch(`${CONFIG.url}/api/worker/job/${jobId}/progress`, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${CONFIG.token}`,
			"content-type": "application/json",
		},
		body: JSON.stringify({ progress }),
	}).catch(() => {});
}

async function uploadResult(jobId: string, outputPath: string): Promise<void> {
	if (!existsSync(outputPath))
		throw new Error("hyperframes finished but no output.mp4 was produced");
	const buf = readFileSync(outputPath);
	const response = await fetch(
		`${CONFIG.url}/api/worker/job/${jobId}/upload?outcome=done`,
		{
			method: "POST",
			headers: {
				Authorization: `Bearer ${CONFIG.token}`,
				"content-type": "video/mp4",
			},
			body: buf,
		},
	);
	if (!response.ok) {
		throw new Error(
			`upload ${response.status}: ${await response.text()}`,
		);
	}
}

async function reportFailure(jobId: string, message: string): Promise<void> {
	await fetch(
		`${CONFIG.url}/api/worker/job/${jobId}/upload?outcome=failed`,
		{
			method: "POST",
			headers: {
				Authorization: `Bearer ${CONFIG.token}`,
				"content-type": "application/json",
			},
			body: JSON.stringify({ error: message }),
		},
	).catch(() => {});
}

async function checkCli(): Promise<void> {
	const ok = await new Promise<boolean>((resolveP) => {
		const child = spawn(CONFIG.cliCommand, ["--version"], {
			stdio: ["ignore", "ignore", "ignore"],
		});
		child.on("error", () => resolveP(false));
		child.on("exit", (code) => resolveP(code === 0));
	});
	if (!ok) {
		console.error(
			`× '${CONFIG.cliCommand}' not found on PATH. Install with:`,
		);
		console.error(`    npm i -g hyperframes`);
		console.error(
			`  Or set VIBEEDIT_HYPERFRAMES_CMD to the absolute binary path.`,
		);
		process.exit(1);
	}
	console.log(`  ✓ hyperframes CLI present`);
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolveP) => setTimeout(resolveP, ms));
}

void resolve;
