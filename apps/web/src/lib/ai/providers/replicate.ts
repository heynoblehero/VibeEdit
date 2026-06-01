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
