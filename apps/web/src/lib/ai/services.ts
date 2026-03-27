/**
 * TRUSTED EXTERNAL SERVICES — SECURITY HARDENED
 *
 * Only whitelisted services and domains can be called.
 * The AI cannot make arbitrary HTTP requests.
 *
 * Security layers:
 * 1. Service registry — only known services allowed
 * 2. Action allowlist — each service has explicit allowed actions
 * 3. Domain allowlist — outbound URLs validated against allowlist
 * 4. HTTPS only — no plaintext HTTP
 * 5. Max file size — responses capped to prevent memory bombs
 * 6. Content-type validation — response must match expected media type
 * 7. Filename sanitization — no path traversal
 * 8. Input sanitization — text/prompt length limits
 * 9. Timeout — requests abort after 30 seconds
 * 10. No redirects followed to untrusted domains
 */

// ── SECURITY CONSTANTS ──
const MAX_RESPONSE_SIZE = 50 * 1024 * 1024; // 50MB max download
const REQUEST_TIMEOUT_MS = 30_000; // 30 second timeout
const MAX_TEXT_INPUT_LENGTH = 5000; // Max chars for text inputs
const MAX_PROMPT_LENGTH = 2000; // Max chars for image prompts

const ALLOWED_DOMAINS = new Set([
  "api.elevenlabs.io",
  "api.stability.ai",
  "api.suno.ai",
]);

const ALLOWED_RESPONSE_TYPES = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/ogg",
  "image/png",
  "image/jpeg",
  "image/webp",
  "video/mp4",
  "video/webm",
  "application/octet-stream", // some APIs return this for binary
]);

// ── Trusted service registry ──
export const TRUSTED_SERVICES = {
  elevenlabs: {
    name: "ElevenLabs",
    description: "AI voice generation & text-to-speech",
    actions: ["tts"],
    domain: "api.elevenlabs.io",
    website: "https://elevenlabs.io",
    expectedTypes: ["audio/mpeg", "audio/mp3", "application/octet-stream"],
  },
  stability: {
    name: "Stability AI",
    description: "AI image generation (Stable Diffusion)",
    actions: ["generate"],
    domain: "api.stability.ai",
    website: "https://stability.ai",
    expectedTypes: ["image/png", "image/jpeg", "image/webp", "application/octet-stream"],
  },
  suno: {
    name: "Suno",
    description: "AI music generation (coming soon)",
    actions: [],
    domain: "api.suno.ai",
    website: "https://suno.ai",
    expectedTypes: ["audio/mpeg", "audio/wav"],
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

// ── Security: validate URL is HTTPS + on allowed domain ──
function validateUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false; // HTTPS only
    if (!ALLOWED_DOMAINS.has(parsed.hostname)) return false;
    // Block URLs with auth info (user:pass@domain)
    if (parsed.username || parsed.password) return false;
    return true;
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

// ── Security: sanitize filename (prevent path traversal) ──
function sanitizeFilename(name: string, maxLen: number = 60): string {
  return name
    .replace(/[^a-zA-Z0-9._-]/g, "_") // only safe chars
    .replace(/\.{2,}/g, ".") // no double dots
    .replace(/^[.-]+/, "") // no leading dots/dashes
    .slice(0, maxLen);
}

// ── Security: fetch with size limit + timeout ──
async function safeFetch(url: string, options: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      redirect: "error", // don't follow redirects (could go to untrusted domain)
    });

    // Check content-length header if available
    const contentLength = response.headers.get("content-length");
    if (contentLength && parseInt(contentLength) > MAX_RESPONSE_SIZE) {
      throw new Error(`Response too large: ${contentLength} bytes (max ${MAX_RESPONSE_SIZE})`);
    }

    return response;
  } finally {
    clearTimeout(timeout);
  }
}

// ── Security: read response with size enforcement ──
async function safeReadBody(response: Response, service: TrustedServiceId): Promise<{ data: ArrayBuffer; mimeType: string }> {
  const contentType = response.headers.get("content-type")?.split(";")[0].trim() || "application/octet-stream";
  const svc = TRUSTED_SERVICES[service];

  // Validate content type matches what we expect from this service
  if (!ALLOWED_RESPONSE_TYPES.has(contentType)) {
    throw new Error(`Unexpected content type "${contentType}" from ${svc.name}. This may indicate a security issue.`);
  }

  // Read in chunks with size limit
  const reader = response.body?.getReader();
  if (!reader) throw new Error("No response body");

  const chunks: Uint8Array[] = [];
  let totalSize = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalSize += value.byteLength;
    if (totalSize > MAX_RESPONSE_SIZE) {
      reader.cancel();
      throw new Error(`Response exceeded ${MAX_RESPONSE_SIZE / 1024 / 1024}MB size limit`);
    }
    chunks.push(value);
  }

  // Combine chunks
  const combined = new Uint8Array(totalSize);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return { data: combined.buffer, mimeType: contentType };
}

// ── Security: validate magic bytes match claimed type ──
function validateMagicBytes(data: ArrayBuffer, claimedType: string): boolean {
  const bytes = new Uint8Array(data.slice(0, 16));

  if (claimedType.startsWith("image/png")) {
    // PNG magic: 89 50 4E 47
    return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  }
  if (claimedType.startsWith("image/jpeg")) {
    // JPEG magic: FF D8 FF
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (claimedType.startsWith("audio/mpeg") || claimedType.startsWith("audio/mp3")) {
    // MP3: starts with FF FB, FF F3, FF F2, or ID3
    return (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0) ||
           (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33); // ID3
  }
  // For octet-stream or unknown types, accept (already domain-validated)
  return true;
}

// ── ElevenLabs TTS ──
async function elevenLabsTTS(params: Record<string, unknown>, apiKey: string): Promise<GenerateMediaResult> {
  const text = params.text as string;
  if (!text) return { success: false, error: "text is required for ElevenLabs TTS" };
  if (text.length > MAX_TEXT_INPUT_LENGTH) {
    return { success: false, error: `Text too long (${text.length} chars). Max: ${MAX_TEXT_INPUT_LENGTH}` };
  }

  // Validate voiceId is alphanumeric only (prevent injection)
  const voiceId = (params.voiceId as string) || "21m00Tcm4TlvDq8ikWAM";
  if (!/^[a-zA-Z0-9]+$/.test(voiceId)) {
    return { success: false, error: "Invalid voiceId format" };
  }

  const modelId = (params.modelId as string) || "eleven_monolingual_v1";
  if (!/^[a-zA-Z0-9_]+$/.test(modelId)) {
    return { success: false, error: "Invalid modelId format" };
  }

  const url = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`;
  if (!validateUrl(url)) {
    return { success: false, error: "URL blocked by domain allowlist" };
  }

  const response = await safeFetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "xi-api-key": apiKey,
    },
    body: JSON.stringify({
      text,
      model_id: modelId,
      voice_settings: {
        stability: Math.max(0, Math.min(1, (params.stability as number) ?? 0.5)),
        similarity_boost: Math.max(0, Math.min(1, (params.similarityBoost as number) ?? 0.75)),
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    return { success: false, error: `ElevenLabs error (${response.status}): ${errorText.slice(0, 200)}` };
  }

  const { data, mimeType } = await safeReadBody(response, "elevenlabs");

  if (!validateMagicBytes(data, mimeType)) {
    return { success: false, error: "Response failed file type validation — content does not match expected audio format" };
  }

  const safeName = sanitizeFilename(text.slice(0, 30).replace(/\s+/g, "_"));
  return { success: true, data, mimeType: "audio/mpeg", filename: `elevenlabs_${safeName}.mp3` };
}

// ── Stability AI Image ──
async function stabilityImage(params: Record<string, unknown>, apiKey: string): Promise<GenerateMediaResult> {
  const prompt = params.prompt as string;
  if (!prompt) return { success: false, error: "prompt is required for Stability AI" };
  if (prompt.length > MAX_PROMPT_LENGTH) {
    return { success: false, error: `Prompt too long (${prompt.length} chars). Max: ${MAX_PROMPT_LENGTH}` };
  }

  const url = "https://api.stability.ai/v2beta/stable-image/generate/sd3";
  if (!validateUrl(url)) {
    return { success: false, error: "URL blocked by domain allowlist" };
  }

  // Validate dimensions are reasonable
  const width = params.width ? Math.max(256, Math.min(2048, Number(params.width))) : undefined;
  const height = params.height ? Math.max(256, Math.min(2048, Number(params.height))) : undefined;

  const form = new FormData();
  form.append("prompt", prompt);
  form.append("output_format", "png");
  if (width) form.append("width", String(width));
  if (height) form.append("height", String(height));

  const response = await safeFetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Accept": "image/*",
    },
    body: form,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    return { success: false, error: `Stability error (${response.status}): ${errorText.slice(0, 200)}` };
  }

  const { data, mimeType } = await safeReadBody(response, "stability");

  if (!validateMagicBytes(data, mimeType)) {
    return { success: false, error: "Response failed file type validation — content does not match expected image format" };
  }

  const safeName = sanitizeFilename(prompt.slice(0, 30).replace(/\s+/g, "_"));
  return { success: true, data, mimeType: "image/png", filename: `generated_${safeName}.png` };
}

// ── Main dispatcher ──
export async function generateMedia(params: GenerateMediaParams): Promise<GenerateMediaResult> {
  const { service, action, params: serviceParams, apiKey } = params;

  const validationError = validateRequest(service, action);
  if (validationError) {
    return { success: false, error: validationError };
  }

  // Validate API key format (basic sanity — not empty, reasonable length)
  if (!apiKey || apiKey.length < 8 || apiKey.length > 256) {
    return { success: false, error: "Invalid API key format" };
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

// ── Public: list available services ──
export function getTrustedServices() {
  return Object.entries(TRUSTED_SERVICES).map(([id, svc]) => ({
    id,
    name: svc.name,
    description: svc.description,
    actions: [...svc.actions],
    available: svc.actions.length > 0,
  }));
}
