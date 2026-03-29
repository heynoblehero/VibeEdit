/**
 * Processing Router
 *
 * Decides whether a task should run client-side or be offloaded to a
 * remote endpoint, then dispatches accordingly.
 *
 * Decision rules (hybrid mode):
 *   - Short videos (< clientSideMaxDurationSeconds): client
 *   - Long videos: server if endpoint configured, else client + warning
 *   - Batch clip generation (> batchOffloadThreshold): always server if available
 *   - "client" mode: always client
 *   - "server" mode: always server (fails if no endpoint)
 */

import {
  type InfraConfig,
  type ProcessingTask,
  getInfraConfig,
  hasEndpoint,
  getEndpoint,
} from "./config";

// ── Types ────────────────────────────────────────────────────────────

export interface RoutingDecision {
  /** Where the task will run */
  target: "client" | "server";
  /** Why this target was chosen */
  reason: string;
  /** Warning message if falling back unexpectedly */
  warning?: string;
  /** The server endpoint URL (only when target === "server") */
  endpointUrl?: string;
}

export interface ProcessingTaskInput {
  task: ProcessingTask;
  /** Video or audio duration in seconds (0 if not applicable) */
  durationSeconds?: number;
  /** Number of items in a batch (for clip-generation) */
  batchCount?: number;
}

export interface ServerTaskPayload {
  /** The processing task type */
  task: ProcessingTask;
  /** Opaque payload passed to the server endpoint */
  data: Record<string, unknown>;
  /** File to upload (if any) */
  file?: Blob;
}

export type ProgressCallback = (progress: number) => void;

export interface ProcessingResult<T = unknown> {
  /** Where the task actually ran */
  target: "client" | "server";
  /** The result data */
  data: T;
}

// ── Routing Decision ─────────────────────────────────────────────────

/**
 * Determine whether a task should run on the client or server.
 * Does NOT execute the task -- just makes the routing decision.
 */
export function shouldOffloadToServer({
  task,
  durationSeconds = 0,
  batchCount = 1,
  config,
}: ProcessingTaskInput & { config?: InfraConfig }): RoutingDecision {
  const cfg = config ?? getInfraConfig();
  const endpointAvailable = hasEndpoint(cfg, task);
  const endpointUrl = getEndpoint(cfg, task) ?? undefined;

  // "client" mode: always local
  if (cfg.processingBackend === "client") {
    return {
      target: "client",
      reason: "Processing backend is set to client-only.",
    };
  }

  // "server" mode: always remote
  if (cfg.processingBackend === "server") {
    if (!endpointAvailable) {
      return {
        target: "client",
        reason: `Server mode selected but no endpoint configured for "${task}".`,
        warning: `No server endpoint for "${task}" -- falling back to client-side processing. ` +
          "Configure the endpoint in Settings > Infrastructure to use server processing.",
      };
    }
    return {
      target: "server",
      reason: `Server mode: offloading "${task}" to remote endpoint.`,
      endpointUrl,
    };
  }

  // "hybrid" mode: decide based on workload
  // Rule 1: batch clip generation above threshold always offloads
  if (task === "clip-generation" && batchCount > cfg.limits.batchOffloadThreshold) {
    if (endpointAvailable) {
      return {
        target: "server",
        reason: `Batch of ${batchCount} clips exceeds threshold (${cfg.limits.batchOffloadThreshold}). Offloading to server.`,
        endpointUrl,
      };
    }
    return {
      target: "client",
      reason: `Batch of ${batchCount} clips exceeds threshold, but no server endpoint configured.`,
      warning: `Processing ${batchCount} clips client-side may be slow. ` +
        "Configure a clip-generation endpoint for better performance.",
    };
  }

  // Rule 2: long video/audio offloads
  if (durationSeconds > cfg.limits.clientSideMaxDurationSeconds) {
    if (endpointAvailable) {
      return {
        target: "server",
        reason: `Duration ${formatDuration(durationSeconds)} exceeds client threshold ` +
          `(${formatDuration(cfg.limits.clientSideMaxDurationSeconds)}). Offloading to server.`,
        endpointUrl,
      };
    }
    return {
      target: "client",
      reason: `Duration ${formatDuration(durationSeconds)} exceeds client threshold, ` +
        "but no server endpoint configured.",
      warning: `Processing ${formatDuration(durationSeconds)} of media client-side may be slow or fail. ` +
        `Configure a ${task} endpoint for videos longer than ${formatDuration(cfg.limits.clientSideMaxDurationSeconds)}.`,
    };
  }

  // Rule 3: short enough for client
  return {
    target: "client",
    reason: `Duration ${formatDuration(durationSeconds)} is within client-side limit ` +
      `(${formatDuration(cfg.limits.clientSideMaxDurationSeconds)}).`,
  };
}

// ── Task Dispatcher ──────────────────────────────────────────────────

/**
 * Route a processing task to either client or server.
 *
 * - If server: POSTs the payload to the remote endpoint and polls for result.
 * - If client: returns the routing decision and lets the caller handle execution.
 *
 * For client-side execution, the caller should check `result.target === "client"`
 * and run their existing in-browser logic (Whisper worker, canvas render, etc.).
 */
export async function routeProcessingTask<T = unknown>({
  task,
  payload,
  config,
  onProgress,
}: {
  task: ProcessingTask;
  payload: ServerTaskPayload;
  config?: InfraConfig;
  onProgress?: ProgressCallback;
}): Promise<ProcessingResult<T>> {
  const cfg = config ?? getInfraConfig();
  const decision = shouldOffloadToServer({
    task,
    durationSeconds: (payload.data.durationSeconds as number) ?? 0,
    batchCount: (payload.data.batchCount as number) ?? 1,
    config: cfg,
  });

  if (decision.warning) {
    console.warn(`[ProcessingRouter] ${decision.warning}`);
  }

  if (decision.target === "client") {
    // Return a sentinel result -- caller should check target and run client-side
    return {
      target: "client",
      data: { decision } as T,
    };
  }

  // Server-side execution
  const endpointUrl = decision.endpointUrl!;
  onProgress?.(0);

  try {
    const result = await executeRemoteTask<T>(endpointUrl, payload, onProgress);
    return {
      target: "server",
      data: result,
    };
  } catch (error) {
    // If server fails, we can fall back to client in hybrid mode
    if (cfg.processingBackend === "hybrid") {
      console.warn(
        `[ProcessingRouter] Server processing failed for "${task}", falling back to client:`,
        error instanceof Error ? error.message : error,
      );
      return {
        target: "client",
        data: {
          decision: {
            ...decision,
            target: "client" as const,
            warning: `Server processing failed: ${error instanceof Error ? error.message : "Unknown error"}. Falling back to client.`,
          },
        } as T,
      };
    }
    throw error;
  }
}

// ── Remote Execution ─────────────────────────────────────────────────

const POLL_INTERVAL_MS = 2000;
const MAX_POLL_ATTEMPTS = 900; // 30 minutes max

/**
 * Execute a task on a remote endpoint.
 *
 * Protocol:
 * 1. POST payload to the endpoint. If the payload contains a file, use multipart form.
 * 2. Response can be:
 *    a) Immediate result (200 with JSON body containing `result`)
 *    b) Async job (202 with JSON body containing `jobId` and `statusUrl`)
 * 3. For async jobs, poll statusUrl until completion.
 */
async function executeRemoteTask<T>(
  endpointUrl: string,
  payload: ServerTaskPayload,
  onProgress?: ProgressCallback,
): Promise<T> {
  let response: Response;

  if (payload.file) {
    // Multipart form data with file
    const form = new FormData();
    form.append("task", payload.task);
    form.append("data", JSON.stringify(payload.data));
    form.append("file", payload.file);

    response = await fetch(endpointUrl, {
      method: "POST",
      body: form,
    });
  } else {
    // JSON payload
    response = await fetch(endpointUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        task: payload.task,
        data: payload.data,
      }),
    });
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    throw new Error(
      `Remote processing failed (${response.status}): ${errorText.slice(0, 500)}`,
    );
  }

  const body = await response.json();

  // Immediate result
  if (response.status === 200 && body.result !== undefined) {
    onProgress?.(1);
    return body.result as T;
  }

  // Async job -- poll for completion
  if (response.status === 202 || body.jobId) {
    const statusUrl = body.statusUrl || `${endpointUrl}/status?jobId=${body.jobId}`;
    return pollForResult<T>(statusUrl, onProgress);
  }

  // Unexpected response shape -- treat body as the result
  onProgress?.(1);
  return body as T;
}

/**
 * Poll a status URL until the job completes or fails.
 */
async function pollForResult<T>(
  statusUrl: string,
  onProgress?: ProgressCallback,
): Promise<T> {
  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    await sleep(POLL_INTERVAL_MS);

    const response = await fetch(statusUrl);
    if (!response.ok) {
      throw new Error(`Status check failed (${response.status})`);
    }

    const body = await response.json();

    if (body.progress !== undefined) {
      onProgress?.(body.progress);
    }

    if (body.status === "completed" || body.status === "done") {
      onProgress?.(1);
      return body.result as T;
    }

    if (body.status === "failed" || body.status === "error") {
      throw new Error(body.error || "Remote processing failed");
    }

    // Still running -- continue polling
  }

  throw new Error("Remote processing timed out (exceeded maximum poll attempts)");
}

// ── Utilities ────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  if (minutes < 60) return secs > 0 ? `${minutes}m ${secs}s` : `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}
