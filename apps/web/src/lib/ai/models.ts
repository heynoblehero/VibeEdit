// Model registry — the single source of truth for every generative model the
// product can route a task to. The UI picker, the per-user preference resolver,
// and (in later waves) the provider adapters and prompt/tools all import from
// here, so these types are a stable contract: change them deliberately.
//
// Conventions:
//   - `official: true`  → first-party API with a real, supported endpoint. Its
//     credential lives in the standard <PROVIDER>_API_KEY-style env var.
//   - `official: false` → unofficial cookie/relay/archived provider. These need
//     a self-hosted proxy (endpointEnv) AND an account token/cookie
//     (credentialEnv). They carry ToS risk and are only "configured" when both
//     env vars are present.
//   - Exactly ONE entry per task has `default: true` — that's the Auto pick.
//   - `enabled: true` for ALL entries (product decision: surface everything in
//     the picker; configuration/availability is a separate, runtime concern).

export type ModelTask = "brain" | "image" | "video" | "music" | "voice" | "motion";

export interface ModelEntry {
  /** Stable slug, e.g. "flux-schnell", "midjourney", "grok-2", "suno". */
  id: string;
  /** Human-readable UI label. */
  label: string;
  /** Which kind of generation this model performs. */
  task: ModelTask;
  /** Provider key, e.g. "anthropic" | "replicate" | "elevenlabs" | "xai" | "midjourney-proxy" | "grok2api" | "suno" | "udio" | "viggle" | "luma" | "runway" | "pika" | "kling". */
  provider: string;
  /** false for cookie/relay/archived providers. */
  official: boolean;
  /** Appears in the picker. true for all entries per the product decision. */
  enabled: boolean;
  /** The Auto/default pick for its task. Exactly one default per task. */
  default?: boolean;
  /** Drives credit cost later. 1 = cheap, 3 = premium. */
  costTier: 1 | 2 | 3;
  /** Env var name holding the base URL for self-hosted/proxy providers. */
  endpointEnv?: string;
  /** Env var name (or BYOK key id) holding the token/cookie/api-key. */
  credentialEnv?: string;
  /** Caveat shown in the UI, e.g. ToS risk / self-hosting requirements. */
  note?: string;
}

export const MODELS: ModelEntry[] = [
  // ── brain (LLM / agent reasoning) ──────────────────────────────────────────
  {
    id: "claude-opus-4-8",
    label: "Claude Opus 4.8",
    task: "brain",
    provider: "anthropic",
    official: true,
    enabled: true,
    costTier: 3,
    credentialEnv: "ANTHROPIC_API_KEY",
  },
  {
    id: "claude-sonnet-4-6",
    label: "Claude Sonnet 4.6",
    task: "brain",
    provider: "anthropic",
    official: true,
    enabled: true,
    // Vibe (Sonnet) is the default brain — Vibe Max (Opus) is an opt-in upgrade.
    default: true,
    costTier: 2,
    credentialEnv: "ANTHROPIC_API_KEY",
  },
  {
    id: "grok-2",
    label: "Grok 2",
    task: "brain",
    provider: "xai",
    official: true,
    enabled: true,
    costTier: 2,
    credentialEnv: "XAI_API_KEY",
  },
  {
    id: "grok-via-grok2api",
    label: "Grok (grok2api relay)",
    task: "brain",
    provider: "grok2api",
    official: false,
    enabled: true,
    costTier: 1,
    endpointEnv: "GROK2API_URL",
    credentialEnv: "GROK2API_KEY",
    note: "Unofficial — archived grok2api project; needs a self-hosted relay + account cookie/token. ToS risk.",
  },

  // ── image ───────────────────────────────────────────────────────────────────
  {
    id: "flux-schnell",
    label: "FLUX Schnell",
    task: "image",
    provider: "replicate",
    official: true,
    enabled: true,
    default: true,
    costTier: 1,
    credentialEnv: "REPLICATE_API_TOKEN",
  },
  {
    id: "flux-pro",
    label: "FLUX Pro",
    task: "image",
    provider: "replicate",
    official: true,
    enabled: true,
    costTier: 2,
    credentialEnv: "REPLICATE_API_TOKEN",
  },
  {
    id: "ideogram",
    label: "Ideogram",
    task: "image",
    provider: "replicate",
    official: true,
    enabled: true,
    costTier: 2,
    credentialEnv: "REPLICATE_API_TOKEN",
  },
  {
    id: "midjourney",
    label: "Midjourney",
    task: "image",
    provider: "midjourney-proxy",
    official: false,
    enabled: true,
    costTier: 2,
    endpointEnv: "MIDJOURNEY_PROXY_URL",
    credentialEnv: "MIDJOURNEY_PROXY_KEY",
    note: "Unofficial — needs a self-hosted Midjourney proxy + a Discord account token. ToS risk.",
  },

  // ── video ─────────────────────────────────────────────────────────────────
  {
    id: "luma",
    label: "Luma Dream Machine",
    task: "video",
    provider: "luma",
    official: true,
    enabled: true,
    default: true,
    costTier: 3,
    credentialEnv: "LUMA_API_KEY",
    note: "Official API — requires a Luma API key.",
  },
  {
    id: "runway",
    label: "Runway Gen-3",
    task: "video",
    provider: "runway",
    official: true,
    enabled: true,
    costTier: 3,
    credentialEnv: "RUNWAY_API_KEY",
    note: "Official API — requires a Runway API key.",
  },
  {
    id: "pika",
    label: "Pika",
    task: "video",
    provider: "pika",
    official: true,
    enabled: true,
    costTier: 3,
    credentialEnv: "PIKA_API_KEY",
    note: "Official API — requires a Pika API key.",
  },
  {
    id: "kling",
    label: "Kling",
    task: "video",
    provider: "kling",
    official: true,
    enabled: true,
    costTier: 3,
    credentialEnv: "KLING_API_KEY",
    note: "Official API — requires a Kling API key.",
  },

  // ── music ─────────────────────────────────────────────────────────────────
  {
    id: "suno",
    label: "Suno",
    task: "music",
    provider: "suno",
    official: false,
    enabled: true,
    default: true,
    costTier: 2,
    endpointEnv: "SUNO_PROXY_URL",
    credentialEnv: "SUNO_COOKIE",
    note: "Unofficial — needs a self-hosted Suno proxy + an account cookie. ToS risk.",
  },
  {
    id: "udio",
    label: "Udio",
    task: "music",
    provider: "udio",
    official: false,
    enabled: true,
    costTier: 2,
    endpointEnv: "UDIO_PROXY_URL",
    credentialEnv: "UDIO_COOKIE",
    note: "Unofficial — needs a self-hosted Udio proxy + an account cookie. ToS risk.",
  },
  {
    id: "riffusion",
    label: "Riffusion",
    task: "music",
    provider: "replicate",
    official: true,
    enabled: true,
    costTier: 1,
    credentialEnv: "REPLICATE_API_TOKEN",
  },

  // ── voice (TTS) ─────────────────────────────────────────────────────────────
  {
    id: "elevenlabs",
    label: "ElevenLabs",
    task: "voice",
    provider: "elevenlabs",
    official: true,
    enabled: true,
    default: true,
    costTier: 2,
    credentialEnv: "ELEVENLABS_API_KEY",
  },

  // ── motion (character animation / pose transfer) ──────────────────────────────
  {
    id: "viggle",
    label: "Viggle",
    task: "motion",
    provider: "viggle",
    official: false,
    enabled: true,
    default: true,
    costTier: 2,
    endpointEnv: "VIGGLE_PROXY_URL",
    credentialEnv: "VIGGLE_TOKEN",
    note: "Unofficial — needs a self-hosted Viggle proxy + an account token. ToS risk.",
  },
];

/** All enabled-or-not entries for a given task, in registry order. */
export function modelsForTask(task: ModelTask): ModelEntry[] {
  return MODELS.filter((m) => m.task === task);
}

// ── Brain branding ──────────────────────────────────────────────────────────
// Users never see raw model names. The agent brain is presented as two tiers:
//   Vibe     → the standard brain (Sonnet). Fast, efficient, default.
//   Vibe Max → the smartest brain (Opus). Opt-in, and it costs more credits per
//              edit (it's a pricier model to run).
export const VIBE_MODEL_ID = "claude-sonnet-4-6";
export const VIBE_MAX_MODEL_ID = "claude-opus-4-8";

export type BrainTier = "vibe" | "vibe-max";

const BRAIN_BRAND: Record<string, string> = {
  [VIBE_MODEL_ID]: "Vibe",
  [VIBE_MAX_MODEL_ID]: "Vibe Max",
};

/** UI label for a model — branded name for the brain, real label otherwise. */
export function brandLabel(model: Pick<ModelEntry, "id" | "label">): string {
  return BRAIN_BRAND[model.id] ?? model.label;
}

export function brainTierOf(modelId: string | undefined): BrainTier {
  return modelId === VIBE_MAX_MODEL_ID ? "vibe-max" : "vibe";
}

/** Look up a model by its stable id. */
export function getModel(id: string): ModelEntry | undefined {
  return MODELS.find((m) => m.id === id);
}

/** The Auto/default pick for a task (the single entry flagged `default: true`). */
export function defaultModelForTask(task: ModelTask): ModelEntry | undefined {
  return MODELS.find((m) => m.task === task && m.default === true);
}

/**
 * True when this model could actually run right now:
 *   - official  → its credential env var is set (or it has none, e.g. nothing to gate on)
 *   - unofficial → BOTH its endpointEnv and credentialEnv are present in process.env
 */
export function isModelConfigured(m: ModelEntry): boolean {
  if (m.official) {
    if (!m.credentialEnv) return true;
    return !!process.env[m.credentialEnv];
  }
  if (!m.endpointEnv || !m.credentialEnv) return false;
  return !!process.env[m.endpointEnv] && !!process.env[m.credentialEnv];
}
