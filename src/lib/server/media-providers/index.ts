/**
 * Top-level "give me an image" / "give me a video" facade. Routes to the
 * right provider based on the model entry. Knows about gpt-image-1 (OpenAI
 * direct), every Replicate-hosted model, and degrades gracefully when env
 * vars aren't configured.
 */

import { applyStoredKeys } from "@/lib/server/runtime-keys";
import { getMediaModel, defaultModelId, type MediaKind } from "./models";
import { replicatePredict } from "./replicate";

export interface ImageRequest {
  prompt: string;
  modelId?: string;
  aspectRatio?: "16:9" | "9:16" | "1:1" | "4:3";
  /** For edit-style models — current image to modify. */
  inputImageUrl?: string;
  /**
   * Optional shot-type hint. Generators get a much better composition
   * when they know whether to frame this as wide / closeup / over-shoulder
   * etc. Mapped to lens/composition language in the prompt suffix.
   */
  shotType?: "wide" | "medium" | "closeup" | "ecu" | "ots" | "insert";
}

export interface VideoRequest {
  prompt: string;
  modelId?: string;
  /** Optional source image for image-to-video. Routes the call to an i2v-capable model. */
  imageUrl?: string;
  aspectRatio?: "16:9" | "9:16" | "1:1";
  durationSec?: number;
}

export interface MediaResult {
  url: string;
  modelId: string;
  provider: string;
}

async function generateOpenAIImage(req: ImageRequest): Promise<MediaResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not set");
  const size =
    req.aspectRatio === "9:16"
      ? "1024x1536"
      : req.aspectRatio === "1:1"
        ? "1024x1024"
        : "1536x1024";
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-image-1",
      prompt: req.prompt,
      size,
      n: 1,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI ${res.status}: ${text.slice(0, 300)}`);
  }
  const data = (await res.json()) as { data?: Array<{ b64_json?: string; url?: string }> };
  const item = data.data?.[0];
  if (!item) throw new Error("OpenAI returned no image");
  // gpt-image-1 returns b64; older endpoints sometimes return URL.
  const url = item.url ?? `data:image/png;base64,${item.b64_json}`;
  return { url, modelId: "gpt-image-1", provider: "openai" };
}

export async function generateImage(req: ImageRequest): Promise<MediaResult> {
  applyStoredKeys();
  const id = req.modelId ?? defaultModelId("image");
  const model = getMediaModel(id);
  if (!model || model.kind !== "image") throw new Error(`Unknown image model: ${id}`);

  if (model.provider === "pollinations") {
    // Free, keyless. URL-based: GET /prompt/<encoded>?width=&height=&nologo=true
    // Native render res (1920x1080 / 1080x1920 / 1024x1024) — match the
    // canvas so we don't upscale a thumbnail. Use Flux model on
    // Pollinations for quality (it's the best free option they expose).
    // Random seed per call so the same prompt across scenes diversifies.
    const w =
      req.aspectRatio === "9:16"
        ? 1080
        : req.aspectRatio === "1:1"
          ? 1024
          : 1920;
    const h =
      req.aspectRatio === "9:16" ? 1920 : req.aspectRatio === "1:1" ? 1024 : 1080;
    const seed = Math.floor(Math.random() * 1_000_000);
    // Flux on Pollinations responds well to inline quality boosters and
    // exclusionary phrasing. We append both to fight the most common
    // failure modes (blur, mangled hands, accidental text, watermarks).
    const negatives =
      "no text, no watermark, no logo, no blurriness, no distorted faces, no extra fingers";
    const shotSuffix: Record<string, string> = {
      wide: "wide establishing shot, full scene visible, 24mm lens",
      medium: "medium shot, subject framed waist up, 50mm lens",
      closeup: "tight close-up, shallow depth of field, 85mm lens",
      ecu: "extreme close-up, macro detail, dramatic lighting",
      ots: "over-the-shoulder shot, foreground bokeh, depth",
      insert: "insert shot, isolated object on clean background",
    };
    const composition = req.shotType ? shotSuffix[req.shotType] : "";
    const finalPrompt = `${req.prompt}${composition ? ", " + composition : ""}. ${negatives}.`;
    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(finalPrompt)}?width=${w}&height=${h}&nologo=true&model=flux&seed=${seed}&enhance=true`;
    // Pollinations supports HEAD-style verification but most clients just
    // hand the URL out — the renderer will fetch it on demand. We do a
    // single GET so we know it's reachable + cached server-side.
    const res = await fetch(url, { method: "GET" });
    if (!res.ok) {
      throw new Error(`Pollinations ${res.status}`);
    }
    return { url, modelId: id, provider: "pollinations" };
  }
  if (model.provider === "openai") {
    return generateOpenAIImage(req);
  }
  if (model.provider === "replicate") {
    if (!model.slug) throw new Error(`Model ${id} missing slug`);
    const { output } = await replicatePredict(model.slug, {
      ...(model.defaultInput ?? {}),
      prompt: req.prompt,
      ...(req.aspectRatio ? { aspect_ratio: req.aspectRatio } : {}),
    });
    const url = Array.isArray(output) ? output[0] : output;
    return { url, modelId: id, provider: "replicate" };
  }
  throw new Error(`No provider implementation for ${id}`);
}

export async function generateVideo(req: VideoRequest): Promise<MediaResult> {
  applyStoredKeys();
  const id = req.modelId ?? defaultModelId("video");
  const model = getMediaModel(id);
  if (!model || model.kind !== "video") throw new Error(`Unknown video model: ${id}`);

  if (model.provider === "replicate") {
    if (!model.slug) throw new Error(`Model ${id} missing slug`);
    const input: Record<string, unknown> = {
      prompt: req.prompt,
      ...(req.imageUrl ? { image: req.imageUrl, start_image: req.imageUrl } : {}),
      ...(req.aspectRatio ? { aspect_ratio: req.aspectRatio } : {}),
      ...(req.durationSec
        ? { duration: req.durationSec, num_frames: req.durationSec * 24 }
        : {}),
    };
    const { output } = await replicatePredict(model.slug, input);
    const url = Array.isArray(output) ? output[0] : output;
    return { url, modelId: id, provider: "replicate" };
  }
  throw new Error(`No provider implementation for ${id}`);
}

export type { MediaKind };
