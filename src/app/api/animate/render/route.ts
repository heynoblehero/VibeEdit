import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { renderMedia, selectComposition } from "@remotion/renderer";
import type { NextRequest } from "next/server";
import { ANIMATION_TEMPLATES, type AnimationSpec } from "@/lib/animate/spec";
import { getRemotionBundle } from "@/lib/server/remotion-bundle";
import { publicUrlFor, storageDir } from "@/lib/server/runtime-storage";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Renders one AnimationSpec to mp4. Reuses the existing Remotion
 * bundle via getRemotionBundle() — the AnimationComposition is
 * registered in Root.tsx so no per-job bundling. Output lands in the
 * same uploads dir as user files; we hash the rendered bytes for
 * dedupe across re-renders.
 */
export async function POST(request: NextRequest) {
	let body: { spec?: AnimationSpec };
	try {
		body = await request.json();
	} catch {
		return Response.json({ error: "expected JSON body" }, { status: 400 });
	}
	const spec = body.spec;
	if (!spec || !ANIMATION_TEMPLATES[spec.templateId]) {
		return Response.json(
			{ error: "missing or unknown spec.templateId" },
			{ status: 400 },
		);
	}
	const fps = clamp(spec.fps, 12, 60);
	const width = clamp(spec.width, 64, 4096);
	const height = clamp(spec.height, 64, 4096);
	const durationInFrames = clamp(spec.durationFrames, 1, fps * 60); // up to 1 min

	const inputProps = {
		templateId: spec.templateId,
		props: spec.props ?? {},
		durationInFrames,
		fps,
		width,
		height,
	};

	let outPath: string;
	try {
		const serveUrl = await getRemotionBundle();
		const composition = await selectComposition({
			serveUrl,
			id: "VibeEditAnimation",
			inputProps,
		});

		const tmpName = `.tmp-anim-${crypto.randomBytes(6).toString("hex")}.mp4`;
		outPath = path.join(storageDir("uploads"), tmpName);

		await renderMedia({
			composition,
			serveUrl,
			codec: "h264",
			outputLocation: outPath,
			inputProps,
			crf: 20,
			jpegQuality: 92,
		});
	} catch (err) {
		const detail = err instanceof Error ? err.message : String(err);
		return Response.json({ error: `render failed: ${detail}` }, { status: 500 });
	}

	// Content-addressed: hash the rendered file so identical re-renders
	// (same spec) reuse the existing url.
	const buf = await fs.readFile(outPath);
	const digest = crypto.createHash("sha1").update(buf).digest("hex").slice(0, 16);
	const finalName = `anim-${digest}.mp4`;
	const finalPath = path.join(storageDir("uploads"), finalName);
	try {
		await fs.access(finalPath);
		await fs.unlink(outPath).catch(() => {});
	} catch {
		await fs.rename(outPath, finalPath);
	}

	return Response.json({
		url: publicUrlFor("uploads", finalName),
		name: spec.name ?? ANIMATION_TEMPLATES[spec.templateId].label,
		bytes: buf.byteLength,
		durationSec: durationInFrames / fps,
		width,
		height,
	});
}

function clamp(v: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, Math.round(v)));
}
