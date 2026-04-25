/**
 * AI-avatar provider adapter.
 *
 * Given a scene's voiceover audio (+ optional portrait image), generate a
 * talking-head video and return a URL. Lets us swap Hallo2 / SadTalker /
 * Runway without touching the rest of the app.
 *
 * Configure via env:
 *   AVATAR_PROVIDER=fal            # or "replicate" or "none"
 *   FAL_API_KEY=...                # for fal-ai/hallo
 *   REPLICATE_API_TOKEN=...        # for replicate.com (TODO)
 *   AVATAR_DEFAULT_PORTRAIT_URL=   # fallback face when no image is uploaded
 */

import { applyStoredKeys } from "./runtime-keys";

export interface AvatarGenerationRequest {
  /** Public URL of the source portrait image. */
  imageUrl: string;
  /** Public URL of the driving audio (WAV/MP3). */
  audioUrl: string;
  /** Optional prompt influencing expression/style. */
  prompt?: string;
}

export interface AvatarGenerationResult {
  videoUrl: string;
  provider: string;
  durationMs: number;
}

export interface AvatarProvider {
  id: string;
  generate(req: AvatarGenerationRequest): Promise<AvatarGenerationResult>;
}

class NoneProvider implements AvatarProvider {
  id = "none";
  async generate(): Promise<AvatarGenerationResult> {
    throw new Error(
      "No AI-avatar provider configured. Set AVATAR_PROVIDER=fal (+ FAL_API_KEY) or =replicate (+ REPLICATE_API_TOKEN).",
    );
  }
}

// fal.ai — https://fal.ai/models/fal-ai/hallo
// Uses the sync endpoint so we can return a URL in a single request/response.
// The async queue endpoint would be better for prod (> 10s inferences).
class FalProvider implements AvatarProvider {
  id = "fal";
  async generate(req: AvatarGenerationRequest): Promise<AvatarGenerationResult> {
    const key = process.env.FAL_API_KEY;
    if (!key) throw new Error("FAL_API_KEY not set");
    const started = Date.now();
    const res = await fetch("https://fal.run/fal-ai/hallo", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Key ${key}`,
      },
      body: JSON.stringify({
        source_image_url: req.imageUrl,
        driving_audio_url: req.audioUrl,
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`fal.ai ${res.status}: ${text.slice(0, 300)}`);
    }
    const data = (await res.json()) as { video?: { url?: string } };
    const url = data.video?.url;
    if (!url) throw new Error("fal.ai returned no video URL");
    return { videoUrl: url, provider: "fal", durationMs: Date.now() - started };
  }
}

export function getAvatarProvider(): AvatarProvider {
  applyStoredKeys();
  const id = (process.env.AVATAR_PROVIDER ?? "none").toLowerCase();
  switch (id) {
    case "fal":
      return new FalProvider();
    // TODO: ReplicateProvider — hallo2 / sadtalker via replicate.com
    default:
      return new NoneProvider();
  }
}
