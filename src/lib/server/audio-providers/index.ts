/**
 * generateMusic / generateSfx facade. Routes by provider, downloads the
 * resulting audio to /public/voiceovers/ so the renderer can use a stable
 * local URL. Throws on misconfiguration with a clear message.
 */
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import { replicatePredict } from "../media-providers/replicate";
import { getAudioModel, defaultAudioModelId, type AudioKind } from "./models";

export interface AudioRequest {
  prompt: string;
  modelId?: string;
  durationSec?: number;
}

export interface AudioResult {
  url: string;
  modelId: string;
  provider: string;
  durationSec: number;
}

const AUDIO_DIR = path.join(process.cwd(), "public", "voiceovers");
try {
  fs.mkdirSync(AUDIO_DIR, { recursive: true });
} catch {
  // exists
}

function cacheKey(modelId: string, prompt: string, durationSec: number): string {
  return crypto
    .createHash("sha1")
    .update(`${modelId}:${durationSec}:${prompt}`)
    .digest("hex")
    .slice(0, 20);
}

async function downloadTo(localPath: string, url: string): Promise<number> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`audio download ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await fs.promises.writeFile(localPath, buf);
  return buf.length;
}

async function elevenLabsSfx(req: AudioRequest): Promise<AudioResult> {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw new Error("ELEVENLABS_API_KEY not set");
  const dur = req.durationSec ?? 5;
  const fname = `${cacheKey("elevenlabs-sfx", req.prompt, dur)}.mp3`;
  const out = path.join(AUDIO_DIR, fname);
  if (fs.existsSync(out)) {
    return {
      url: `/voiceovers/${fname}`,
      modelId: "elevenlabs-sfx",
      provider: "elevenlabs",
      durationSec: dur,
    };
  }
  const res = await fetch("https://api.elevenlabs.io/v1/sound-generation", {
    method: "POST",
    headers: {
      "xi-api-key": key,
      "Content-Type": "application/json",
      accept: "audio/mpeg",
    },
    body: JSON.stringify({ text: req.prompt, duration_seconds: dur }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ElevenLabs SFX ${res.status}: ${text.slice(0, 300)}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  await fs.promises.writeFile(out, buf);
  return {
    url: `/voiceovers/${fname}`,
    modelId: "elevenlabs-sfx",
    provider: "elevenlabs",
    durationSec: dur,
  };
}

async function replicateAudio(
  modelId: string,
  slug: string,
  req: AudioRequest,
): Promise<AudioResult> {
  const dur = req.durationSec ?? 8;
  const fname = `${cacheKey(modelId, req.prompt, dur)}.mp3`;
  const out = path.join(AUDIO_DIR, fname);
  if (fs.existsSync(out)) {
    return { url: `/voiceovers/${fname}`, modelId, provider: "replicate", durationSec: dur };
  }
  const { output } = await replicatePredict(slug, {
    prompt: req.prompt,
    duration: dur,
    output_format: "mp3",
  });
  const url = Array.isArray(output) ? output[0] : output;
  await downloadTo(out, url);
  return { url: `/voiceovers/${fname}`, modelId, provider: "replicate", durationSec: dur };
}

export async function generateAudio(
  kind: AudioKind,
  req: AudioRequest,
): Promise<AudioResult> {
  const id = req.modelId ?? defaultAudioModelId(kind);
  const model = getAudioModel(id);
  if (!model || model.kind !== kind) {
    throw new Error(`Unknown ${kind} model: ${id}`);
  }
  if (model.provider === "elevenlabs") return elevenLabsSfx(req);
  if (model.provider === "replicate" && model.slug) {
    return replicateAudio(id, model.slug, req);
  }
  throw new Error(`No provider implementation for ${id}`);
}
