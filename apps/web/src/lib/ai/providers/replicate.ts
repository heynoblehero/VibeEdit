/*
 * Minimal Replicate client for image generation.
 *
 * Default model: Flux Schnell — fastest + cheapest text-to-image, ~1s per
 * variant at 1024×1024. The Replicate "predictions" API is async (long-poll)
 * but Flux Schnell on the official model alias is fast enough that we just
 * poll until done with a short timeout.
 */

export type ReplicateImageOptions = {
  apiKey: string;
  prompt: string;
  aspectRatio?: "1:1" | "16:9" | "9:16" | "4:3" | "3:4";
  model?: string;
  signal?: AbortSignal;
};

const DEFAULT_MODEL = "black-forest-labs/flux-schnell";
const POLL_INTERVAL_MS = 800;
const MAX_POLL_MS = 60_000;

type Prediction = {
  id: string;
  status: "starting" | "processing" | "succeeded" | "failed" | "canceled";
  output: string | string[] | null;
  error: string | null;
};

export async function replicateGenerateImage(options: ReplicateImageOptions): Promise<Buffer> {
  const model = options.model || DEFAULT_MODEL;
  const aspect = options.aspectRatio || "1:1";
  const startResponse = await fetch(`https://api.replicate.com/v1/models/${model}/predictions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${options.apiKey}`,
      "content-type": "application/json",
      Prefer: "wait=10",
    },
    body: JSON.stringify({
      input: {
        prompt: options.prompt,
        aspect_ratio: aspect,
        num_outputs: 1,
        output_format: "png",
        output_quality: 90,
      },
    }),
    signal: options.signal,
  });
  if (!startResponse.ok) {
    const text = await startResponse.text().catch(() => "");
    throw new Error(`replicate start failed: ${startResponse.status} ${text.slice(0, 400)}`);
  }
  let prediction = (await startResponse.json()) as Prediction;
  const startedAt = Date.now();
  while (prediction.status === "starting" || prediction.status === "processing") {
    if (Date.now() - startedAt > MAX_POLL_MS) {
      throw new Error(`replicate timed out after ${MAX_POLL_MS / 1000}s`);
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    const pollResponse = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
      headers: { Authorization: `Bearer ${options.apiKey}` },
      signal: options.signal,
    });
    if (!pollResponse.ok) {
      const text = await pollResponse.text().catch(() => "");
      throw new Error(`replicate poll failed: ${pollResponse.status} ${text.slice(0, 400)}`);
    }
    prediction = (await pollResponse.json()) as Prediction;
  }
  if (prediction.status !== "succeeded") {
    throw new Error(`replicate ${prediction.status}: ${prediction.error || "unknown error"}`);
  }
  const imageUrl = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
  if (!imageUrl || typeof imageUrl !== "string") {
    throw new Error("replicate returned no image URL");
  }
  const imageResponse = await fetch(imageUrl, { signal: options.signal });
  if (!imageResponse.ok) {
    throw new Error(`replicate image fetch failed: ${imageResponse.status}`);
  }
  const buffer = Buffer.from(await imageResponse.arrayBuffer());
  if (buffer.length === 0) throw new Error("replicate returned empty image");
  return buffer;
}

/**
 * Remove the background from an image, returning a transparent PNG buffer.
 * Same model the remove_background tool uses (851-labs/background-remover) —
 * exposed here so the persona generator can produce a clean, floatable
 * character in one shot.
 */
export async function replicateRemoveBackground(
  apiKey: string,
  imageDataUri: string,
  signal?: AbortSignal,
): Promise<Buffer> {
  const startResponse = await fetch(
    "https://api.replicate.com/v1/models/851-labs/background-remover/predictions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
        Prefer: "wait=30",
      },
      body: JSON.stringify({ input: { image: imageDataUri } }),
      signal,
    },
  );
  if (!startResponse.ok) {
    const text = await startResponse.text().catch(() => "");
    throw new Error(`replicate bg-remove failed: ${startResponse.status} ${text.slice(0, 400)}`);
  }
  let prediction = (await startResponse.json()) as Prediction;
  const startedAt = Date.now();
  while (prediction.status === "starting" || prediction.status === "processing") {
    if (Date.now() - startedAt > MAX_POLL_MS) throw new Error("replicate bg-remove timed out");
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    const pollResponse = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal,
    });
    if (!pollResponse.ok)
      throw new Error(`replicate bg-remove poll failed: ${pollResponse.status}`);
    prediction = (await pollResponse.json()) as Prediction;
  }
  if (prediction.status !== "succeeded") {
    throw new Error(`replicate bg-remove ${prediction.status}: ${prediction.error || "unknown"}`);
  }
  const url = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
  if (!url || typeof url !== "string") throw new Error("replicate bg-remove returned no image");
  const imageResponse = await fetch(url, { signal });
  if (!imageResponse.ok)
    throw new Error(`replicate bg-remove fetch failed: ${imageResponse.status}`);
  const buffer = Buffer.from(await imageResponse.arrayBuffer());
  if (buffer.length === 0) throw new Error("replicate bg-remove returned empty image");
  return buffer;
}

export type ReplicateVideoOptions = {
  apiKey: string;
  prompt: string;
  aspectRatio?: "16:9" | "9:16" | "1:1";
  duration?: "5" | "10";
  // Any Replicate text-to-video model alias. Default Kling 1.6 standard; swap to
  // luma/ray, wan-video/*, minimax/* etc. without touching call sites.
  model?: string;
  signal?: AbortSignal;
};

const DEFAULT_VIDEO_MODEL = "kwaivgi/kling-v1.6-standard";
const VIDEO_POLL_INTERVAL_MS = 4_000;
const VIDEO_MAX_POLL_MS = 300_000;

// Text-to-video via Replicate. Same predictions API as images, but video
// renders take 30–120s so we poll longer. Returns the downloaded MP4 bytes.
export async function replicateGenerateVideo(options: ReplicateVideoOptions): Promise<Buffer> {
  const model = options.model || DEFAULT_VIDEO_MODEL;
  const startResponse = await fetch(`https://api.replicate.com/v1/models/${model}/predictions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${options.apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      input: {
        prompt: options.prompt,
        duration: options.duration || "5",
        aspect_ratio: options.aspectRatio || "16:9",
      },
    }),
    signal: options.signal,
  });
  if (!startResponse.ok) {
    const text = await startResponse.text().catch(() => "");
    throw new Error(`replicate video start failed: ${startResponse.status} ${text.slice(0, 400)}`);
  }
  let prediction = (await startResponse.json()) as Prediction;
  const startedAt = Date.now();
  while (prediction.status === "starting" || prediction.status === "processing") {
    if (Date.now() - startedAt > VIDEO_MAX_POLL_MS) {
      throw new Error(`replicate video timed out after ${VIDEO_MAX_POLL_MS / 1000}s`);
    }
    await new Promise((resolve) => setTimeout(resolve, VIDEO_POLL_INTERVAL_MS));
    const pollResponse = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
      headers: { Authorization: `Bearer ${options.apiKey}` },
      signal: options.signal,
    });
    if (!pollResponse.ok) continue;
    prediction = (await pollResponse.json()) as Prediction;
  }
  if (prediction.status !== "succeeded") {
    throw new Error(`replicate video ${prediction.status}: ${prediction.error || "unknown error"}`);
  }
  const videoUrl = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
  if (!videoUrl || typeof videoUrl !== "string") {
    throw new Error("replicate returned no video URL");
  }
  const videoResponse = await fetch(videoUrl, { signal: options.signal });
  if (!videoResponse.ok) {
    throw new Error(`replicate video fetch failed: ${videoResponse.status}`);
  }
  const buffer = Buffer.from(await videoResponse.arrayBuffer());
  if (buffer.length === 0) throw new Error("replicate returned empty video");
  return buffer;
}
