import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import { publicUrlFor, storageDir } from "./runtime-storage";

/**
 * OpenAI TTS helper, server-only.
 *
 * Same logic as `/api/tts/route.ts` but as a callable function so the
 * chat agent's `generate_voiceover` tool can invoke it directly without
 * going through localhost HTTP.
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

export interface TtsResult {
	url: string;
	name: string;
	bytes: number;
	durationSec: number;
	voice: string;
}

export async function generateTts(input: {
	text: string;
	voice?: string;
	model?: string;
}): Promise<TtsResult> {
	const text = input.text.trim();
	const voice = (input.voice ?? "alloy").toLowerCase();
	const model = input.model ?? "tts-1";
	if (!text) throw new Error("text is required");
	if (text.length > 4000) throw new Error("text too long (max 4000 chars)");
	if (!OPENAI_VOICES.has(voice)) throw new Error(`unknown voice "${voice}"`);

	const apiKey = process.env.OPENAI_API_KEY;
	if (!apiKey) {
		throw new Error("OPENAI_API_KEY missing on server — set it in .env.local");
	}

	const upstream = await fetch("https://api.openai.com/v1/audio/speech", {
		method: "POST",
		headers: {
			Authorization: `Bearer ${apiKey}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({ model, voice, input: text, response_format: "mp3" }),
	});
	if (!upstream.ok) {
		const detail = await upstream.text();
		throw new Error(`openai tts ${upstream.status}: ${detail.slice(0, 400)}`);
	}
	const buf = Buffer.from(await upstream.arrayBuffer());
	if (buf.byteLength === 0) throw new Error("empty TTS response");

	const dir = storageDir("uploads");
	const digest = crypto.createHash("sha1").update(buf).digest("hex").slice(0, 16);
	const finalName = `${digest}.mp3`;
	const finalPath = path.join(dir, finalName);
	if (!fs.existsSync(finalPath)) {
		await fs.promises.writeFile(finalPath, buf);
	}

	// Same estimator as the route handler — the browser refines once
	// it loads the audio metadata.
	const estimatedSec = Math.max(1, text.length / 15);

	return {
		url: publicUrlFor("uploads", finalName),
		name: `tts-${voice}-${digest.slice(0, 6)}.mp3`,
		bytes: buf.byteLength,
		durationSec: estimatedSec,
		voice,
	};
}
