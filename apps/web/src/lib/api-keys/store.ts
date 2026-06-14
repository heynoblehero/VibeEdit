/*
 * BYOK API-key store — strictly browser-local.
 *
 * Keys live in window.localStorage only. They are attached to outgoing chat
 * requests in-memory and forwarded to provider APIs server-side for that one
 * request; nothing is persisted to our database. The tradeoff is that users
 * re-paste keys on a new device, but our server stays out of the credential
 * blast radius.
 */

export type ProviderId = "replicate" | "elevenlabs" | "openai" | "anthropic";

export type ProviderMeta = {
  id: ProviderId;
  name: string;
  description: string;
  getKeyUrl: string;
  placeholder: string;
  keyPrefix?: string;
};

export const PROVIDERS: ProviderMeta[] = [
  {
    id: "replicate",
    name: "Replicate",
    description:
      "All AI media: stills (Flux/SDXL), b-roll video (Kling), and background removal. One key for everything.",
    getKeyUrl: "https://replicate.com/account/api-tokens",
    placeholder: "r8_xxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    keyPrefix: "r8_",
  },
  {
    id: "elevenlabs",
    name: "ElevenLabs",
    description: "Narration / voiceover. Reads any script into an MP3.",
    getKeyUrl: "https://elevenlabs.io/app/settings/api-keys",
    placeholder: "sk_xxxxxxxx",
  },
  {
    id: "openai",
    name: "OpenAI",
    description: "DALL·E images, gpt-4o audio. Fallback when other providers fail.",
    getKeyUrl: "https://platform.openai.com/api-keys",
    placeholder: "sk-xxxxxxxx",
    keyPrefix: "sk-",
  },
  {
    id: "anthropic",
    name: "Anthropic",
    description: "Optional: use your own Claude key for chat (BYOK billing).",
    getKeyUrl: "https://console.anthropic.com/settings/keys",
    placeholder: "sk-ant-xxxxxxxx",
    keyPrefix: "sk-ant-",
  },
];

const LS_PREFIX = "vibeedit:apikey:";

function lsKey(provider: ProviderId): string {
  return `${LS_PREFIX}${provider}`;
}

export function getApiKey(provider: ProviderId): string | null {
  if (typeof window === "undefined") return null;
  const value = window.localStorage.getItem(lsKey(provider));
  return value && value.trim() ? value.trim() : null;
}

export function setApiKey(provider: ProviderId, value: string): void {
  if (typeof window === "undefined") return;
  const trimmed = value.trim();
  if (!trimmed) {
    window.localStorage.removeItem(lsKey(provider));
    return;
  }
  window.localStorage.setItem(lsKey(provider), trimmed);
  notify();
}

export function clearApiKey(provider: ProviderId): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(lsKey(provider));
  notify();
}

export function getAllApiKeys(): Partial<Record<ProviderId, string>> {
  const out: Partial<Record<ProviderId, string>> = {};
  for (const provider of PROVIDERS) {
    const value = getApiKey(provider.id);
    if (value) out[provider.id] = value;
  }
  return out;
}

export function hasAnyKey(): boolean {
  return PROVIDERS.some((p) => !!getApiKey(p.id));
}

export function maskKey(value: string | null): string {
  if (!value) return "(not set)";
  if (value.length <= 8) return "•".repeat(value.length);
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}

// In-tab event bus so settings page + key indicators stay in sync.
const EVENT = "vibeedit:api-keys-changed";

function notify(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(EVENT));
}

export function onKeysChanged(handler: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(EVENT, handler);
  const storageHandler = (event: StorageEvent) => {
    if (event.key && event.key.startsWith(LS_PREFIX)) handler();
  };
  window.addEventListener("storage", storageHandler);
  return () => {
    window.removeEventListener(EVENT, handler);
    window.removeEventListener("storage", storageHandler);
  };
}
