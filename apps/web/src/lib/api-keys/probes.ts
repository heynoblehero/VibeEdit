/*
 * BYOK provider key probes.
 *
 * Each probe makes one cheap, authenticated call against the provider's
 * account / models endpoint and returns a normalized result. Used by the
 * /api/byok/test endpoint so users can verify a key without going through
 * the full agent loop.
 */

import type { ProviderId } from "./store";

export type ProbeResult = {
  ok: boolean;
  detail?: string;
  error?: string;
};

const TIMEOUT_MS = 10_000;

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function probeReplicate(apiKey: string): Promise<ProbeResult> {
  try {
    const response = await fetchWithTimeout("https://api.replicate.com/v1/account", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (response.status === 401 || response.status === 403)
      return { ok: false, error: "invalid token" };
    if (!response.ok) return { ok: false, error: `replicate ${response.status}` };
    const data = (await response.json().catch(() => ({}))) as {
      username?: string;
      type?: string;
    };
    const detail = data.username
      ? `${data.type === "organization" ? "org" : "user"} @${data.username}`
      : "ok";
    return { ok: true, detail };
  } catch (caught) {
    return { ok: false, error: (caught as Error).message };
  }
}

async function probeElevenLabs(apiKey: string): Promise<ProbeResult> {
  try {
    const response = await fetchWithTimeout("https://api.elevenlabs.io/v1/user", {
      headers: { "xi-api-key": apiKey },
    });
    if (response.status === 401 || response.status === 403)
      return { ok: false, error: "invalid key" };
    if (!response.ok) return { ok: false, error: `elevenlabs ${response.status}` };
    const data = (await response.json().catch(() => ({}))) as {
      subscription?: {
        tier?: string;
        character_count?: number;
        character_limit?: number;
      };
    };
    const sub = data.subscription;
    const detail = sub
      ? `${sub.tier ?? "free"} · ${sub.character_count ?? 0}/${sub.character_limit ?? "?"} chars`
      : "ok";
    return { ok: true, detail };
  } catch (caught) {
    return { ok: false, error: (caught as Error).message };
  }
}

async function probeOpenAi(apiKey: string): Promise<ProbeResult> {
  try {
    const response = await fetchWithTimeout("https://api.openai.com/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (response.status === 401 || response.status === 403)
      return { ok: false, error: "invalid key" };
    if (!response.ok) return { ok: false, error: `openai ${response.status}` };
    const data = (await response.json().catch(() => ({}))) as {
      data?: Array<{ id: string }>;
    };
    const detail = data.data?.length ? `${data.data.length} models accessible` : "ok";
    return { ok: true, detail };
  } catch (caught) {
    return { ok: false, error: (caught as Error).message };
  }
}

async function probeAnthropic(apiKey: string): Promise<ProbeResult> {
  try {
    const response = await fetchWithTimeout("https://api.anthropic.com/v1/models", {
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
    });
    if (response.status === 401 || response.status === 403)
      return { ok: false, error: "invalid key" };
    if (!response.ok) return { ok: false, error: `anthropic ${response.status}` };
    const data = (await response.json().catch(() => ({}))) as {
      data?: Array<{ id: string }>;
    };
    const detail = data.data?.length ? `${data.data.length} models accessible` : "ok";
    return { ok: true, detail };
  } catch (caught) {
    return { ok: false, error: (caught as Error).message };
  }
}

async function probeFal(apiKey: string): Promise<ProbeResult> {
  // FAL doesn't expose a public account endpoint. The cheapest "is this key
  // valid" check is hitting the rest-api root with auth — a missing/bad key
  // returns 401, a valid one returns a 404 (because there's no root handler)
  // rather than 401. Crude but reliable enough for a sanity check.
  try {
    const response = await fetchWithTimeout("https://rest.alpha.fal.ai/", {
      headers: { Authorization: `Key ${apiKey}` },
    });
    if (response.status === 401 || response.status === 403)
      return { ok: false, error: "invalid key" };
    return { ok: true, detail: "key accepted" };
  } catch (caught) {
    return { ok: false, error: (caught as Error).message };
  }
}

async function probeKling(_apiKey: string): Promise<ProbeResult> {
  // Kling's API uses signed JWTs derived from accessKey + secret, so a single
  // "key" probe isn't meaningful. Surface this honestly so users don't think
  // the button is broken.
  return {
    ok: true,
    detail: "saved — Kling uses signed requests; can't pre-verify",
  };
}

export async function probeKey(provider: ProviderId, apiKey: string): Promise<ProbeResult> {
  if (!apiKey || apiKey.trim().length < 4) return { ok: false, error: "key too short" };
  switch (provider) {
    case "replicate":
      return probeReplicate(apiKey);
    case "elevenlabs":
      return probeElevenLabs(apiKey);
    case "openai":
      return probeOpenAi(apiKey);
    case "anthropic":
      return probeAnthropic(apiKey);
    case "fal":
      return probeFal(apiKey);
    case "kling":
      return probeKling(apiKey);
    default:
      return { ok: false, error: "unknown provider" };
  }
}
