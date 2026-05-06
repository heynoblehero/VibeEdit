import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import type { NextRequest } from "next/server";
import { getRun, respondToRun } from "@/lib/agent/runner";
import { publicUrlFor, storageDir } from "@/lib/server/runtime-storage";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_BYTES = 50 * 1024 * 1024; // 50 MB cap — same envelope as music/upload

const ALLOWED_EXT_BY_KIND: Record<string, string[]> = {
	image: [".png", ".jpg", ".jpeg", ".webp", ".gif"],
	video: [".mp4", ".mov", ".webm"],
	audio: [".mp3", ".wav", ".m4a", ".ogg"],
};

/**
 * Accept an asset upload from the AgentSheet's upload card. Writes
 * the file into runtime-storage's `uploads/` subdir (persistent across
 * dokku redeploys) and resolves the run's pending upload promise so
 * the agent loop continues.
 *
 * One-shot per pending upload — if the run isn't currently paused
 * waiting for an upload, this returns 409.
 */
export async function POST(
	request: NextRequest,
	{ params }: { params: Promise<{ runId: string }> },
) {
	const { runId } = await params;
	const run = getRun(runId);
	if (!run) {
		return Response.json({ error: "unknown run" }, { status: 404 });
	}
	if (!run.pending || run.pending.kind !== "upload") {
		return Response.json(
			{ error: "run is not awaiting an upload" },
			{ status: 409 },
		);
	}

	const expectedKind = run.pending.request.mediaType;
	const allowedExts = ALLOWED_EXT_BY_KIND[expectedKind] ?? [];

	let form: FormData;
	try {
		form = await request.formData();
	} catch {
		return Response.json({ error: "invalid multipart body" }, { status: 400 });
	}
	const file = form.get("file");
	if (!(file instanceof File)) {
		return Response.json({ error: "file required" }, { status: 400 });
	}
	if (file.size > MAX_BYTES) {
		return Response.json(
			{
				error: `file too large (${(file.size / 1024 / 1024).toFixed(1)} MB, max 50 MB)`,
			},
			{ status: 413 },
		);
	}

	const ext = (path.extname(file.name).toLowerCase() || "").trim();
	if (allowedExts.length > 0 && !allowedExts.includes(ext)) {
		return Response.json(
			{
				error: `expected ${expectedKind} (${allowedExts.join(", ")}), got "${ext || "no extension"}"`,
			},
			{ status: 415 },
		);
	}

	const buffer = Buffer.from(await file.arrayBuffer());
	const hash = crypto.createHash("sha1").update(buffer).digest("hex").slice(0, 16);
	const safeExt = allowedExts.includes(ext) ? ext : ext || ".bin";
	const filename = `agent-${hash}${safeExt}`;
	const dir = storageDir("uploads");
	const outPath = path.join(dir, filename);
	try {
		await fs.promises.writeFile(outPath, buffer);
	} catch (e) {
		return Response.json(
			{
				error: `failed to write upload: ${
					e instanceof Error ? e.message : String(e)
				}`,
			},
			{ status: 500 },
		);
	}

	const url = publicUrlFor("uploads", filename);

	// Resume the run with the URL.
	const result = respondToRun(runId, { kind: "upload", uploadUrl: url });
	if (!result.ok) {
		return Response.json({ error: result.error }, { status: 409 });
	}

	return Response.json({ ok: true, url });
}
