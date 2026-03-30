/**
 * Infrastructure Configuration
 *
 * Central config for deciding where heavy processing runs.
 * Zero-config default: everything runs client-side in the browser.
 * With env vars set: offloads GPU/CPU work to external serverless endpoints.
 */

//  Types 

export type ProcessingBackend = "client" | "server" | "hybrid";
export type StorageProvider = "local" | "s3" | "do-spaces" | "cloudflare-r2";

export type ProcessingTask =
  | "transcription"
  | "segmentation"
  | "render"
  | "clip-generation";

export interface InfraEndpoints {
  /** Whisper transcription endpoint (e.g., Replicate, Modal, self-hosted) */
  transcription?: string;
  /** Background removal / segmentation endpoint */
  segmentation?: string;
  /** Video rendering endpoint (CPU-intensive frame-by-frame export) */
  videoRender?: string;
  /** Batch clip generation endpoint */
  clipGeneration?: string;
}

export interface StorageConfig {
  /** Which storage backend to use */
  provider: StorageProvider;
  /** Bucket name (for S3-compatible providers) */
  bucket?: string;
  /** Region (e.g., "nyc3" for DO Spaces, "us-east-1" for AWS) */
  region?: string;
  /** Custom endpoint URL (required for DO Spaces / R2) */
  endpoint?: string;
  /** Environment variable name containing the access key */
  accessKeyEnvVar?: string;
  /** Environment variable name containing the secret key */
  secretKeyEnvVar?: string;
}

export interface ProcessingLimits {
  /** Maximum upload size in megabytes */
  maxUploadSizeMb: number;
  /** Maximum video duration in minutes */
  maxVideoDurationMinutes: number;
  /** Maximum concurrent processing jobs */
  maxConcurrentJobs: number;
  /** Videos longer than this (seconds) get offloaded to server in hybrid mode */
  clientSideMaxDurationSeconds: number;
  /** Batch clip count above which we always offload */
  batchOffloadThreshold: number;
}

export interface InfraConfig {
  /** Where heavy processing runs */
  processingBackend: ProcessingBackend;
  /** External service endpoints (when using server/hybrid) */
  endpoints: InfraEndpoints;
  /** File storage configuration */
  storage: StorageConfig;
  /** Processing limits */
  limits: ProcessingLimits;
}

//  Defaults 

export const DEFAULT_LIMITS: ProcessingLimits = {
  maxUploadSizeMb: 500,
  maxVideoDurationMinutes: 120,
  maxConcurrentJobs: 3,
  clientSideMaxDurationSeconds: 300, // 5 minutes
  batchOffloadThreshold: 10,
};

export const DEFAULT_CONFIG: InfraConfig = {
  processingBackend: "client",
  endpoints: {},
  storage: { provider: "local" },
  limits: { ...DEFAULT_LIMITS },
};

//  Load config from environment variables 

/**
 * Build an InfraConfig from environment variables.
 * Falls back to DEFAULT_CONFIG for anything not set.
 * Safe to call on both server and client (client gets defaults).
 */
export function loadInfraConfig(): InfraConfig {
  // On the client side, env vars are not available -- return defaults
  if (typeof process === "undefined" || typeof process.env === "undefined") {
    return { ...DEFAULT_CONFIG };
  }

  const env = process.env;

  const backend = parseBackend(env.PROCESSING_BACKEND);
  const storageProvider = parseStorageProvider(env.STORAGE_PROVIDER);

  return {
    processingBackend: backend,

    endpoints: {
      transcription: env.TRANSCRIPTION_ENDPOINT || undefined,
      segmentation: env.SEGMENTATION_ENDPOINT || undefined,
      videoRender: env.VIDEO_RENDER_ENDPOINT || undefined,
      clipGeneration: env.CLIP_GENERATION_ENDPOINT || undefined,
    },

    storage: {
      provider: storageProvider,
      bucket: env.STORAGE_BUCKET || undefined,
      region: env.STORAGE_REGION || undefined,
      endpoint: env.STORAGE_ENDPOINT || undefined,
      accessKeyEnvVar: env.STORAGE_ACCESS_KEY ? "STORAGE_ACCESS_KEY" : undefined,
      secretKeyEnvVar: env.STORAGE_SECRET_KEY ? "STORAGE_SECRET_KEY" : undefined,
    },

    limits: {
      maxUploadSizeMb: parseIntSafe(env.MAX_UPLOAD_SIZE_MB, DEFAULT_LIMITS.maxUploadSizeMb),
      maxVideoDurationMinutes: parseIntSafe(
        env.MAX_VIDEO_DURATION_MINUTES,
        DEFAULT_LIMITS.maxVideoDurationMinutes,
      ),
      maxConcurrentJobs: parseIntSafe(
        env.MAX_CONCURRENT_JOBS,
        DEFAULT_LIMITS.maxConcurrentJobs,
      ),
      clientSideMaxDurationSeconds: parseIntSafe(
        env.CLIENT_SIDE_MAX_DURATION_SECONDS,
        DEFAULT_LIMITS.clientSideMaxDurationSeconds,
      ),
      batchOffloadThreshold: parseIntSafe(
        env.BATCH_OFFLOAD_THRESHOLD,
        DEFAULT_LIMITS.batchOffloadThreshold,
      ),
    },
  };
}

//  Singleton accessor (cached) 

let _cachedConfig: InfraConfig | null = null;

/**
 * Get the infrastructure config (cached after first call).
 * Call `resetInfraConfig()` to reload from env.
 */
export function getInfraConfig(): InfraConfig {
  if (!_cachedConfig) {
    _cachedConfig = loadInfraConfig();
  }
  return _cachedConfig;
}

/** Force re-read from environment (useful after dynamic config changes). */
export function resetInfraConfig(): void {
  _cachedConfig = null;
}

//  Helpers 

function parseBackend(value: string | undefined): ProcessingBackend {
  if (value === "server" || value === "hybrid" || value === "client") {
    return value;
  }
  return DEFAULT_CONFIG.processingBackend;
}

function parseStorageProvider(value: string | undefined): StorageProvider {
  const valid: StorageProvider[] = ["local", "s3", "do-spaces", "cloudflare-r2"];
  if (value && valid.includes(value as StorageProvider)) {
    return value as StorageProvider;
  }
  return DEFAULT_CONFIG.storage.provider;
}

function parseIntSafe(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) || parsed <= 0 ? fallback : parsed;
}

/**
 * Check whether a given task has a server endpoint configured.
 */
export function hasEndpoint(config: InfraConfig, task: ProcessingTask): boolean {
  const map: Record<ProcessingTask, string | undefined> = {
    transcription: config.endpoints.transcription,
    segmentation: config.endpoints.segmentation,
    render: config.endpoints.videoRender,
    "clip-generation": config.endpoints.clipGeneration,
  };
  const url = map[task];
  return !!url && url.length > 0;
}

/**
 * Get the endpoint URL for a task, or null if not configured.
 */
export function getEndpoint(
  config: InfraConfig,
  task: ProcessingTask,
): string | null {
  const map: Record<ProcessingTask, string | undefined> = {
    transcription: config.endpoints.transcription,
    segmentation: config.endpoints.segmentation,
    render: config.endpoints.videoRender,
    "clip-generation": config.endpoints.clipGeneration,
  };
  return map[task] ?? null;
}
