/**
 * TRUSTED EXTERNAL SERVICES
 *
 * Only whitelisted services and domains can be called.
 * The AI cannot make arbitrary HTTP requests — it can only
 * call pre-approved endpoints defined in this registry.
 *
 * To add a new service:
 * 1. Add it to TRUSTED_SERVICES below
 * 2. Add its allowed domains to ALLOWED_DOMAINS
 * 3. Implement the handler function
 * 4. Add to the switch in generateMedia()
 */

// ── Domain allowlist — no other domains can be contacted ──
const ALLOWED_DOMAINS = new Set([
  "api.elevenlabs.io",
  "api.stability.ai",
  "api.suno.ai",
]);

// ── Trusted service registry ──
export const TRUSTED_SERVICES = {
  elevenlabs: {
    name: "ElevenLabs",
    description: "AI voice generation & text-to-speech",
    actions: ["tts"],
    domain: "api.elevenlabs.io",
    website: "https://elevenlabs.io",
  },
  stability: {
    name: "Stability AI",
    description: "AI image generation (Stable Diffusion)",
    actions: ["generate"],
    domain: "api.stability.ai",
    website: "https://stability.ai",
  },
  suno: {
    name: "Suno",
    description: "AI music generation (coming soon)",
    actions: [],
    domain: "api.suno.ai",
    website: "https://suno.ai",
  },
} as const;

export type TrustedServiceId = keyof typeof TRUSTED_SERVICES;

export interface GenerateMediaParams {
  service: TrustedServiceId;
  action: string;
  params: Record<string, unknown>;
  apiKey: string;
}

export interface GenerateMediaResult {
  success: boolean;
  data?: ArrayBuffer;
  mimeType?: string;
  filename?: string;
  error?: string;
}

// ── Security: validate that a URL is on an allowed domain ──
function validateUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ALLOWED_DOMAINS.has(parsed.hostname);
  } catch {
    return false;
  }
}

// ── Security: validate service + action ──
function validateRequest(service: string, action: string): string | null {
  if (!(service in TRUSTED_SERVICES)) {
    return `Service "${service}" is not trusted. Allowed: ${Object.keys(TRUSTED_SERVICES).join(", ")}`;
  }
  const svc = TRUSTED_SERVICES[service as TrustedServiceId];
  if (!svc.actions.includes(action)) {
    return `Action "${action}" is not allowed for ${svc.name}. Allowed: ${svc.actions.join(", ") || "none (coming soon)"}`;
  }
  return null;
}

// ── ElevenLabs TTS ──
async function elevenLabsTTS(params: Record<string, unknown>, apiKey: string): Promise<GenerateMediaResult> {
  const text = params.text as string;
  if (!text) return { success: false, error: "text is required for ElevenLabs TTS" };

  const voiceId = (params.voiceId as string) || "21m00Tcm4TlvDq8ikWAM";
  const modelId = (params.modelId as string) || "eleven_monolingual_v1";
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`;

  if (!validateUrl(url)) {
    return { success: false, error: "URL validation failed — blocked by domain allowlist" };
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "xi-api-key": apiKey,
    },
    body: JSON.stringify({
      text,
      model_id: modelId,
      voice_settings: {
        stability: (params.stability as number) ?? 0.5,
        similarity_boost: (params.similarityBoost as number) ?? 0.75,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    return { success: false, error: `ElevenLabs error (${response.status}): ${errorText}` };
  }

  const data = await response.arrayBuffer();
  const sanitized = text.slice(0, 30).replace(/[^a-zA-Z0-9 ]/g, "").replace(/\s+/g, "_");
  return { success: true, data, mimeType: "audio/mpeg", filename: `elevenlabs_${sanitized}.mp3` };
}

// ── Stability AI Image ──
async function stabilityImage(params: Record<string, unknown>, apiKey: string): Promise<GenerateMediaResult> {
  const prompt = params.prompt as string;
  if (!prompt) return { success: false, error: "prompt is required for Stability AI" };

  const url = "https://api.stability.ai/v2beta/stable-image/generate/sd3";
  if (!validateUrl(url)) {
    return { success: false, error: "URL validation failed — blocked by domain allowlist" };
  }

  const form = new FormData();
  form.append("prompt", prompt);
  form.append("output_format", "png");
  if (params.width) form.append("width", String(params.width));
  if (params.height) form.append("height", String(params.height));

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Accept": "image/*",
    },
    body: form,
  });

  if (!response.ok) {
    const errorText = await response.text();
    return { success: false, error: `Stability error (${response.status}): ${errorText}` };
  }

  const data = await response.arrayBuffer();
  const sanitized = prompt.slice(0, 30).replace(/[^a-zA-Z0-9 ]/g, "").replace(/\s+/g, "_");
  return { success: true, data, mimeType: "image/png", filename: `generated_${sanitized}.png` };
}

// ── Main dispatcher (only trusted services reach here) ──
export async function generateMedia(params: GenerateMediaParams): Promise<GenerateMediaResult> {
  const { service, action, params: serviceParams, apiKey } = params;

  // Security gate
  const validationError = validateRequest(service, action);
  if (validationError) {
    return { success: false, error: validationError };
  }

  switch (service) {
    case "elevenlabs":
      return elevenLabsTTS(serviceParams, apiKey);
    case "stability":
      return stabilityImage(serviceParams, apiKey);
    case "suno":
      return { success: false, error: "Suno integration coming soon" };
    default:
      return { success: false, error: `Blocked: "${service}" is not a trusted service` };
  }
}

// ── Public: list available services (for UI settings page) ──
export function getTrustedServices() {
  return Object.entries(TRUSTED_SERVICES).map(([id, svc]) => ({
    id,
    name: svc.name,
    description: svc.description,
    actions: svc.actions,
    available: svc.actions.length > 0,
  }));
}
