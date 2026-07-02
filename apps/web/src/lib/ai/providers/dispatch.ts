/*
 * Multi-model generation dispatch.
 *
 * One entry point per asset task (image / video / music / voice / motion) that
 * takes a *resolved* ModelEntry (see lib/ai/models.ts + model-prefs.ts) and runs
 * the right provider. The generation tools in tools.ts call these instead of
 * hitting a single hard-coded provider, so the user's Auto/Manual model choice
 * actually changes what runs.
 *
 * Credential resolution:
 *   - official providers → BYOK key from ctx.apiKeys first, else the model's
 *     credentialEnv from process.env.
 *   - unofficial providers (cookie/relay) → require BOTH the model's endpointEnv
 *     (base URL of the user's self-hosted proxy) and credentialEnv (token/cookie)
 *     in process.env. We never bake secrets into the repo; these are wired by
 *     pointing the env vars at the operator's own running service.
 *
 * When a model isn't configured we throw ProviderNotConfiguredError so the
 * calling tool can fall back to the official default for that task instead of
 * failing the whole agent turn.
 */

import type { ModelEntry } from "../models";
import { getManagedCredential, resolveApiKey } from "@/lib/providers/pool";
import {
  replicateGenerateImage,
  replicateGenerateVideo,
  type ReplicateImageOptions,
} from "./replicate";

export type ApiKeys = Partial<Record<"replicate" | "elevenlabs" | "anthropic", string>>;

export class ProviderNotConfiguredError extends Error {
  constructor(model: ModelEntry) {
    const need = model.official
      ? `set ${model.credentialEnv ?? "the provider API key"}`
      : `set ${model.endpointEnv} (proxy URL) and ${model.credentialEnv} (token/cookie)`;
    super(`${model.label} isn't configured yet — an admin needs to ${need}.`);
    this.name = "ProviderNotConfiguredError";
  }
}

type ImageAspect = NonNullable<ReplicateImageOptions["aspectRatio"]>;
type VideoAspect = "16:9" | "9:16" | "1:1";

// ---------------------------------------------------------------------------
// Credential helpers
// ---------------------------------------------------------------------------

const BYOK_PROVIDERS = new Set(["replicate", "elevenlabs", "anthropic"]);

/** Resolve the official-provider API key: managed pool → BYOK → env. */
function officialKey(model: ModelEntry, apiKeys?: ApiKeys): string {
  const byok =
    apiKeys && BYOK_PROVIDERS.has(model.provider)
      ? apiKeys[model.provider as keyof ApiKeys]
      : undefined;
  const key = resolveApiKey(model.provider, model.credentialEnv, byok);
  if (!key) throw new ProviderNotConfiguredError(model);
  return key;
}

/**
 * Resolve an unofficial proxy's { base, secret }: managed pool first (a proxy-
 * kind credential carries both the endpoint URL and the secret), else the env
 * pair. Both parts must be present.
 */
function proxyConfig(model: ModelEntry): { base: string; secret: string } {
  const managed = getManagedCredential(model.provider);
  if (managed?.endpoint && managed.secret) {
    return { base: managed.endpoint.replace(/\/+$/, ""), secret: managed.secret };
  }
  const base = model.endpointEnv ? process.env[model.endpointEnv] : undefined;
  const secret = model.credentialEnv ? process.env[model.credentialEnv] : undefined;
  if (!base || !secret) throw new ProviderNotConfiguredError(model);
  return { base: base.replace(/\/+$/, ""), secret };
}

async function fetchBuffer(url: string, signal?: AbortSignal): Promise<Buffer> {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`download failed: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length === 0) throw new Error("provider returned empty file");
  return buf;
}

// ---------------------------------------------------------------------------
// Image
// ---------------------------------------------------------------------------

// Registry id → Replicate model alias for the image models we host on Replicate.
const REPLICATE_IMAGE_ALIASES: Record<string, string> = {
  "flux-schnell": "black-forest-labs/flux-schnell",
  "flux-pro": "black-forest-labs/flux-1.1-pro",
  ideogram: "ideogram-ai/ideogram-v2",
};

export async function generateImageWithModel(opts: {
  model: ModelEntry;
  apiKeys?: ApiKeys;
  prompt: string;
  aspectRatio?: ImageAspect;
  signal?: AbortSignal;
}): Promise<Buffer> {
  const { model, apiKeys, prompt, aspectRatio = "1:1", signal } = opts;
  switch (model.provider) {
    case "replicate":
      return replicateGenerateImage({
        apiKey: officialKey(model, apiKeys),
        prompt,
        aspectRatio,
        model: REPLICATE_IMAGE_ALIASES[model.id],
        signal,
      });
    case "midjourney-proxy":
      return midjourneyGenerate(model, prompt, signal);
    default:
      throw new Error(`unsupported image provider: ${model.provider}`);
  }
}

// Midjourney via a self-hosted midjourney-proxy (novelzk/midjourney-proxy API
// shape). Submit → poll task → download. Guessed against the documented proxy
// API; verify the auth header + paths against your deployed proxy version.
async function midjourneyGenerate(
  model: ModelEntry,
  prompt: string,
  signal?: AbortSignal,
): Promise<Buffer> {
  const { base, secret } = proxyConfig(model);
  const headers = { "content-type": "application/json", "mj-api-secret": secret };
  const submit = await fetch(`${base}/mj/submit/imagine`, {
    method: "POST",
    headers,
    body: JSON.stringify({ prompt }),
    signal,
  });
  if (!submit.ok) throw new Error(`midjourney submit failed: ${submit.status}`);
  const submitJson = (await submit.json()) as { result?: string | number; code?: number };
  const taskId = submitJson.result;
  if (!taskId) throw new Error("midjourney submit returned no task id");

  const deadline = Date.now() + 300_000;
  for (;;) {
    if (Date.now() > deadline) throw new Error("midjourney timed out");
    await new Promise((r) => setTimeout(r, 4_000));
    const poll = await fetch(`${base}/mj/task/${taskId}/fetch`, { headers, signal });
    if (!poll.ok) continue;
    const task = (await poll.json()) as {
      status?: string;
      imageUrl?: string;
      failReason?: string;
    };
    if (task.status === "SUCCESS" && task.imageUrl) return fetchBuffer(task.imageUrl, signal);
    if (task.status === "FAILURE") throw new Error(`midjourney failed: ${task.failReason ?? ""}`);
  }
}

// ---------------------------------------------------------------------------
// Video
// ---------------------------------------------------------------------------

// Registry id → Replicate video alias for the models we can run on Replicate
// today. Kling + Luma have solid Replicate hosts; this is the path that
// actually works without standing up a vendor account.
const REPLICATE_VIDEO_ALIASES: Record<string, string> = {
  kling: "kwaivgi/kling-v1.6-standard",
  luma: "luma/ray",
};

export async function generateVideoWithModel(opts: {
  model: ModelEntry;
  apiKeys?: ApiKeys;
  prompt: string;
  aspectRatio?: VideoAspect;
  duration?: "5" | "10";
  signal?: AbortSignal;
}): Promise<Buffer> {
  const { model, apiKeys, prompt, aspectRatio = "16:9", duration = "5", signal } = opts;

  // Models we can serve through Replicate use the Replicate token.
  const replicateAlias = REPLICATE_VIDEO_ALIASES[model.id];
  if (replicateAlias) {
    // Managed pool → BYOK → env, all under the "replicate" provider.
    const apiKey = resolveApiKey("replicate", "REPLICATE_API_TOKEN", apiKeys?.replicate);
    if (!apiKey) throw new ProviderNotConfiguredError(model);
    return replicateGenerateVideo({ apiKey, prompt, aspectRatio, duration, model: replicateAlias });
  }

  // Runway / Pika have no first-class Replicate host here — call their official
  // REST API. Payloads are best-effort against published docs; verify against
  // your account's API version. Gated on the vendor key being present.
  switch (model.provider) {
    case "runway":
      return runwayGenerate(officialKey(model, apiKeys), prompt, aspectRatio, duration, signal);
    case "pika":
      return pikaGenerate(officialKey(model, apiKeys), prompt, aspectRatio, duration, signal);
    default:
      throw new Error(`unsupported video provider: ${model.provider}`);
  }
}

// Runway Gen-3 official API (best-effort shape). Submit a text/image-to-video
// task, poll for the asset URL.
async function runwayGenerate(
  apiKey: string,
  prompt: string,
  aspectRatio: VideoAspect,
  duration: "5" | "10",
  signal?: AbortSignal,
): Promise<Buffer> {
  const ratio =
    aspectRatio === "9:16" ? "768:1280" : aspectRatio === "1:1" ? "960:960" : "1280:768";
  const submit = await fetch("https://api.dev.runwayml.com/v1/text_to_video", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
      "X-Runway-Version": "2024-11-06",
    },
    body: JSON.stringify({
      promptText: prompt,
      model: "gen3a_turbo",
      ratio,
      duration: Number(duration),
    }),
    signal,
  });
  if (!submit.ok) throw new Error(`runway submit failed: ${submit.status}`);
  const { id } = (await submit.json()) as { id?: string };
  if (!id) throw new Error("runway submit returned no task id");
  const deadline = Date.now() + 300_000;
  for (;;) {
    if (Date.now() > deadline) throw new Error("runway timed out");
    await new Promise((r) => setTimeout(r, 5_000));
    const poll = await fetch(`https://api.dev.runwayml.com/v1/tasks/${id}`, {
      headers: { Authorization: `Bearer ${apiKey}`, "X-Runway-Version": "2024-11-06" },
      signal,
    });
    if (!poll.ok) continue;
    const task = (await poll.json()) as { status?: string; output?: string[] };
    if (task.status === "SUCCEEDED" && task.output?.[0]) return fetchBuffer(task.output[0], signal);
    if (task.status === "FAILED") throw new Error("runway task failed");
  }
}

// Pika official API (best-effort shape).
async function pikaGenerate(
  apiKey: string,
  prompt: string,
  aspectRatio: VideoAspect,
  duration: "5" | "10",
  signal?: AbortSignal,
): Promise<Buffer> {
  const submit = await fetch("https://api.pika.art/v1/generate", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({ prompt, aspectRatio, duration: Number(duration) }),
    signal,
  });
  if (!submit.ok) throw new Error(`pika submit failed: ${submit.status}`);
  const { id } = (await submit.json()) as { id?: string };
  if (!id) throw new Error("pika submit returned no job id");
  const deadline = Date.now() + 300_000;
  for (;;) {
    if (Date.now() > deadline) throw new Error("pika timed out");
    await new Promise((r) => setTimeout(r, 5_000));
    const poll = await fetch(`https://api.pika.art/v1/jobs/${id}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal,
    });
    if (!poll.ok) continue;
    const job = (await poll.json()) as { status?: string; videoUrl?: string };
    if (job.status === "finished" && job.videoUrl) return fetchBuffer(job.videoUrl, signal);
    if (job.status === "failed") throw new Error("pika job failed");
  }
}

// ---------------------------------------------------------------------------
// Music
// ---------------------------------------------------------------------------

export async function generateMusicWithModel(opts: {
  model: ModelEntry;
  apiKeys?: ApiKeys;
  prompt: string;
  instrumental?: boolean;
  signal?: AbortSignal;
}): Promise<Buffer> {
  const { model, apiKeys, prompt, instrumental = false, signal } = opts;
  switch (model.provider) {
    case "suno":
    case "udio":
      return sunoLikeGenerate(model, prompt, instrumental, signal);
    case "replicate": {
      // riffusion (official, on Replicate).
      const apiKey = officialKey(model, apiKeys);
      return replicateMusic(apiKey, prompt, signal);
    }
    default:
      throw new Error(`unsupported music provider: ${model.provider}`);
  }
}

// Suno / Udio via a self-hosted proxy (gcui-art/suno-api shape). The proxy holds
// the account cookie; we also forward the cookie env as a header best-effort.
async function sunoLikeGenerate(
  model: ModelEntry,
  prompt: string,
  instrumental: boolean,
  signal?: AbortSignal,
): Promise<Buffer> {
  const { base, secret } = proxyConfig(model);
  const res = await fetch(`${base}/api/generate`, {
    method: "POST",
    headers: { "content-type": "application/json", Cookie: secret },
    body: JSON.stringify({ prompt, make_instrumental: instrumental, wait_audio: true }),
    signal,
  });
  if (!res.ok) throw new Error(`${model.provider} generate failed: ${res.status}`);
  const json = (await res.json()) as Array<{ audio_url?: string }> | { audio_url?: string };
  const audioUrl = Array.isArray(json) ? json[0]?.audio_url : json.audio_url;
  if (!audioUrl) throw new Error(`${model.provider} returned no audio url`);
  return fetchBuffer(audioUrl, signal);
}

// Riffusion on Replicate — predictions API, output.audio is a URL.
async function replicateMusic(
  apiKey: string,
  prompt: string,
  signal?: AbortSignal,
): Promise<Buffer> {
  const start = await fetch("https://api.replicate.com/v1/models/riffusion/riffusion/predictions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
      Prefer: "wait=30",
    },
    body: JSON.stringify({ input: { prompt_a: prompt } }),
    signal,
  });
  if (!start.ok) throw new Error(`riffusion start failed: ${start.status}`);
  let pred = (await start.json()) as {
    id: string;
    status: string;
    output: { audio?: string } | null;
    error: string | null;
  };
  const deadline = Date.now() + 120_000;
  while (pred.status === "starting" || pred.status === "processing") {
    if (Date.now() > deadline) throw new Error("riffusion timed out");
    await new Promise((r) => setTimeout(r, 1_500));
    const poll = await fetch(`https://api.replicate.com/v1/predictions/${pred.id}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal,
    });
    if (!poll.ok) continue;
    pred = await poll.json();
  }
  if (pred.status !== "succeeded" || !pred.output?.audio) {
    throw new Error(`riffusion ${pred.status}: ${pred.error ?? "no audio"}`);
  }
  return fetchBuffer(pred.output.audio, signal);
}

// ---------------------------------------------------------------------------
// Motion (character animation / pose transfer)
// ---------------------------------------------------------------------------

// Viggle via a self-hosted proxy. Proxy APIs vary a lot between forks; this is a
// best-effort submit→poll against a common shape. Verify against your deployment.
export async function generateMotionWithModel(opts: {
  model: ModelEntry;
  imageUrl: string;
  prompt?: string;
  signal?: AbortSignal;
}): Promise<Buffer> {
  const { model, imageUrl, prompt = "", signal } = opts;
  if (model.provider !== "viggle") {
    throw new Error(`unsupported motion provider: ${model.provider}`);
  }
  const { base, secret } = proxyConfig(model);
  const headers = { "content-type": "application/json", Authorization: `Bearer ${secret}` };
  const submit = await fetch(`${base}/api/animate`, {
    method: "POST",
    headers,
    body: JSON.stringify({ image: imageUrl, prompt }),
    signal,
  });
  if (!submit.ok) throw new Error(`viggle submit failed: ${submit.status}`);
  const { id } = (await submit.json()) as { id?: string };
  if (!id) throw new Error("viggle submit returned no task id");
  const deadline = Date.now() + 300_000;
  for (;;) {
    if (Date.now() > deadline) throw new Error("viggle timed out");
    await new Promise((r) => setTimeout(r, 5_000));
    const poll = await fetch(`${base}/api/task/${id}`, { headers, signal });
    if (!poll.ok) continue;
    const task = (await poll.json()) as { status?: string; videoUrl?: string };
    if (task.status === "success" && task.videoUrl) return fetchBuffer(task.videoUrl, signal);
    if (task.status === "failed") throw new Error("viggle task failed");
  }
}
