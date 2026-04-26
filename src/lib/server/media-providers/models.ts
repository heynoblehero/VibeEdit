/**
 * Catalog of image + video models the editor can call. Each entry is
 * a hint sheet: what the model is good for, where to call it, and how
 * to shape the input. The agent reads the description fields when the
 * user doesn't pin a model.
 *
 * Adding a new model = one entry here + (if Replicate-hosted) zero
 * extra code: replicate.ts uses `slug` directly.
 */

export type MediaKind = "image" | "video";
export type Provider = "replicate" | "openai" | "google" | "volcano" | "pollinations";

export interface MediaModel {
  /** Canonical id used in env / agent tool args. */
  id: string;
  kind: MediaKind;
  provider: Provider;
  /** For Replicate models: <owner>/<model>[:<version>]. */
  slug?: string;
  /** Short human-readable name. */
  name: string;
  /** One-sentence description used in the agent's system context. */
  description: string;
  /** Free-form tags so the agent can filter by intent. */
  tags: string[];
  /** Rough cost per generation in USD — actual billing comes from the provider. */
  estimatedCostUsd: number;
  /** Resolution hint. Image models: max side. Video models: WxH. */
  resolution: string;
  /** Video only. */
  maxDurationSec?: number;
  /** Video only — does it produce native audio? */
  nativeAudio?: boolean;
  /** Default input shape — overridden per call. Replicate accepts arbitrary keys. */
  defaultInput?: Record<string, unknown>;
}

export const MEDIA_MODELS: MediaModel[] = [
  // ----- IMAGE -----
  {
    id: "pollinations",
    kind: "image",
    provider: "pollinations",
    name: "Pollinations (free)",
    description:
      "Free, keyless. URL-based generation — no API key required. Quality is OK (Flux-class), latency 5-15s. Use this as the safety-net default when no other image keys are set on the server.",
    tags: ["free", "default-no-key", "keyless"],
    estimatedCostUsd: 0,
    resolution: "1024",
  },
  {
    id: "gpt-image-1",
    kind: "image",
    provider: "openai",
    name: "GPT-Image 1",
    description:
      "OpenAI's flagship image model. Best for iterative edits ('change the sky to sunset'), strong text rendering, all-round quality. Use when the user asks for tweaks to an existing image.",
    tags: ["edit", "default", "text-in-image", "all-rounder"],
    estimatedCostUsd: 0.04,
    resolution: "1024-2048",
  },
  {
    id: "flux-1.1-pro-ultra",
    kind: "image",
    provider: "replicate",
    slug: "black-forest-labs/flux-1.1-pro-ultra",
    name: "Flux 1.1 Pro Ultra",
    description:
      "Top-tier photorealism, best for hero shots and cinematic stills. Slower and pricier than schnell. Use when the user wants the absolute best visual quality.",
    tags: ["premium", "photoreal", "hero"],
    estimatedCostUsd: 0.06,
    resolution: "up to 4MP",
    defaultInput: { aspect_ratio: "16:9", output_format: "jpg" },
  },
  {
    id: "flux-schnell",
    kind: "image",
    provider: "replicate",
    slug: "black-forest-labs/flux-schnell",
    name: "Flux Schnell",
    description:
      "Cheap and fast. Good for bulk b-roll backgrounds where quality is less critical. <1s, ~$0.003/image.",
    tags: ["cheap", "fast", "bulk"],
    estimatedCostUsd: 0.003,
    resolution: "1024",
    defaultInput: { aspect_ratio: "16:9" },
  },
  {
    id: "instant-id",
    kind: "image",
    provider: "replicate",
    slug: "zsxkib/instant-id",
    name: "InstantID (face consistency)",
    description:
      "Identity-preserving face generation. Pass a face photo + prompt and it generates the same person in the new context. Use whenever scene.subjectId is set on a person subject so 'Sarah' looks like 'Sarah' across all scenes.",
    tags: ["consistency", "face", "identity", "subject"],
    estimatedCostUsd: 0.005,
    resolution: "1024",
    defaultInput: { num_inference_steps: 30, guidance_scale: 5 },
  },
  {
    id: "flux-redux",
    kind: "image",
    provider: "replicate",
    slug: "black-forest-labs/flux-redux-dev",
    name: "Flux Redux (img2img)",
    description:
      "Image-to-image conditioning. Pass a reference image + prompt — output preserves the structure/style of the reference. Use for product/object subjects where you want the SAME object in a new context.",
    tags: ["consistency", "img2img", "product", "subject"],
    estimatedCostUsd: 0.005,
    resolution: "1024",
  },
  {
    id: "ideogram-v3-turbo",
    kind: "image",
    provider: "replicate",
    slug: "ideogram-ai/ideogram-v3-turbo",
    name: "Ideogram v3 Turbo",
    description:
      "Best in class for legible text inside images. Use this for posters, title cards, anything with significant typography.",
    tags: ["text-in-image", "poster", "typography"],
    estimatedCostUsd: 0.03,
    resolution: "1280",
    defaultInput: { aspect_ratio: "16:9" },
  },

  // ----- VIDEO -----
  {
    id: "seedance-1-pro",
    kind: "video",
    provider: "replicate",
    slug: "bytedance/seedance-1-pro",
    name: "Seedance 1 Pro",
    description:
      "ByteDance's text-to-video. Best price-to-quality in the catalog right now. Fast (~30s), great motion, accurate prompt-following. Default unless a reason to pick something else.",
    tags: ["default", "value", "fast"],
    estimatedCostUsd: 0.2,
    resolution: "1920x1080",
    maxDurationSec: 12,
  },
  {
    id: "kling-v2.0",
    kind: "video",
    provider: "replicate",
    slug: "kwaivgi/kling-v2.0",
    name: "Kling 2.0",
    description:
      "Kuaishou Kling 2.0. Cinematic camera moves and the strongest image-to-video in the catalog. Pick this when the source is a still photo or you need character consistency across the clip.",
    tags: ["i2v", "image-to-video", "cinematic", "character"],
    estimatedCostUsd: 0.5,
    resolution: "1920x1080",
    maxDurationSec: 10,
  },
  {
    id: "veo-3",
    kind: "video",
    provider: "replicate",
    slug: "google/veo-3",
    name: "Google Veo 3",
    description:
      "Premium quality ceiling. The ONLY model in the catalog with native synced audio (dialogue, ambient, sfx) — pick this when the user wants 'a clip with sound' or for the hero opener. Pricey.",
    tags: ["premium", "audio", "hero"],
    estimatedCostUsd: 0.5,
    resolution: "1920x1080",
    maxDurationSec: 8,
    nativeAudio: true,
  },
  {
    id: "ltx-video",
    kind: "video",
    provider: "replicate",
    slug: "lightricks/ltx-video",
    name: "LTX Video",
    description:
      "Lightning-fast (~4s) and cheap (~$0.02). Mid-tier quality. Use for background b-roll, bulk filler, or anything where iteration speed matters more than polish.",
    tags: ["fast", "cheap", "bulk", "broll"],
    estimatedCostUsd: 0.02,
    resolution: "1216x704",
    maxDurationSec: 5,
  },
];

export function getMediaModel(id: string): MediaModel | undefined {
  return MEDIA_MODELS.find((m) => m.id === id);
}

export function listMediaModels(kind?: MediaKind): MediaModel[] {
  return kind ? MEDIA_MODELS.filter((m) => m.kind === kind) : MEDIA_MODELS;
}

/** Default model id when the user / agent doesn't specify. Adapts to
 * which env vars are configured so it never picks a model that will
 * 501 immediately. */
export function defaultModelId(kind: MediaKind): string {
  if (kind === "video") {
    if (process.env.REPLICATE_API_TOKEN) return "seedance-1-pro";
    // No video fallback today — caller will get a clear 501.
    return "seedance-1-pro";
  }
  // Image: prefer the user's configured key, fall back to free pollinations.
  if (process.env.OPENAI_API_KEY) return "gpt-image-1";
  if (process.env.REPLICATE_API_TOKEN) return "flux-1.1-pro-ultra";
  return "pollinations";
}

/**
 * Compact text block dropped into the agent's system prompt so it knows
 * the menu without us hand-curating per-tool descriptions.
 */
export function modelCatalogSystemBlock(): string {
  const lines = ["Available media models (call with model arg or omit for default):"];
  for (const m of MEDIA_MODELS) {
    lines.push(
      `- ${m.id} [${m.kind}] · ~$${m.estimatedCostUsd}/gen · ${m.tags.join(", ")} — ${m.description}`,
    );
  }
  lines.push(
    `Defaults: image → ${defaultModelId("image")}, video → ${defaultModelId("video")}.`,
  );
  return lines.join("\n");
}
