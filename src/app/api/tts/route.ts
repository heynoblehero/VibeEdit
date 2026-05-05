import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { NextRequest } from "next/server";
import { publicUrlFor, storageDir } from "@/lib/server/runtime-storage";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * OpenAI TTS proxy. Accepts {text, voice, model?, provider?} JSON, calls
 * the OpenAI audio.speech endpoint, and writes the returned mp3 into
 * the same content-addressed uploads dir as user uploads. The client
 * gets back {url, name, bytes, durationSec} and attaches it to a
 * Voiceover or as a free-floating SFX clip.
 *
 * Why proxy instead of calling OpenAI from the browser:
 *  - Keeps the API key server-side (OPENAI_API_KEY env).
 *  - Lets the file land in the same uploads dir as everything else, so
 *    Remotion's renderer can read it without CORS gymnastics.
 *
 * Errors return 4xx/5xx with a JSON body so the panel can surface them.
 */
const OPENAI_VOICES = new Set([
	"alloy",
	"ash",
	"ballad",
	"coral",
	"echo",
	"fable",
	"onyx",
	"nova",
	"sage",
	"shimmer",
	"verse",
]);

export async function POST(request: NextRequest) {
	let body: { text?: string; voice?: string; model?: string; provider?: string };
	try {
		body = await request.json();
	} catch {
		return Response.json({ error: "expected JSON body" }, { status: 400 });
	}

	const text = (body.text ?? "").trim();
	const voice = (body.voice ?? "alloy").toLowerCase();
	const model = body.model ?? "tts-1";
	const provider = body.provider ?? "openai";

	if (!text) {
		return Response.json({ error: "text is required" }, { status: 400 });
	}
	if (text.length > 4000) {
		return Response.json(
			{ error: "text too long (max 4000 chars)" },
			{ status: 400 },
		);
	}
	if (provider !== "openai") {
		return Response.json(
			{ error: `provider "${provider}" not yet supported — only openai for now` },
			{ status: 400 },
		);
	}
	if (!OPENAI_VOICES.has(voice)) {
		return Response.json(
			{ error: `unknown voice "${voice}"` },
			{ status: 400 },
		);
	}

	const apiKey = process.env.OPENAI_API_KEY;
	if (!apiKey) {
		return Response.json(
			{ error: "OPENAI_API_KEY missing on server — set it in .env.local" },
			{ status: 500 },
		);
	}

	const upstream = await fetch("https://api.openai.com/v1/audio/speech", {
		method: "POST",
		headers: {
			Authorization: `Bearer ${apiKey}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			model,
			voice,
			input: text,
			response_format: "mp3",
		}),
	});

	if (!upstream.ok) {
		const detail = await upstream.text();
		return Response.json(
			{ error: `openai ${upstream.status}: ${detail.slice(0, 400)}` },
			{ status: 502 },
		);
	}

	const buf = Buffer.from(await upstream.arrayBuffer());
	if (buf.byteLength === 0) {
		return Response.json({ error: "empty TTS response" }, { status: 502 });
	}

	const dir = storageDir("uploads");
	const digest = crypto.createHash("sha1").update(buf).digest("hex").slice(0, 16);
	const finalName = `${digest}.mp3`;
	const finalPath = path.join(dir, finalName);
	if (!fs.existsSync(finalPath)) {
		await fs.promises.writeFile(finalPath, buf);
	}

	// Rough duration estimate: OpenAI tts-1 averages ~150 chars / 10s
	// at 1x speed. Replaced by the browser's HTMLAudioElement once the
	// client loads the file, but we send it back so the UI can show
	// something while the audio metadata is loading.
	const estimatedSec = Math.max(1, text.length / 15);

	return Response.json({
		url: publicUrlFor("uploads", finalName),
		name: `tts-${voice}-${digest.slice(0, 6)}.mp3`,
		bytes: buf.byteLength,
		durationSec: estimatedSec,
		voice,
		provider,
	});
}
