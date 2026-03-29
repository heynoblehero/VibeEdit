/**
 * In-Memory Job Queue
 *
 * Manages async processing tasks with concurrency limits,
 * progress tracking, and subscriber notifications.
 *
 * No external dependencies (Redis, Bull, etc.) -- just an in-memory queue.
 * Jobs are lost on page refresh, which is fine for client-side processing.
 * Server-side jobs are tracked by their remote status URLs.
 */

import { nanoid } from "nanoid";

// ── Types ────────────────────────────────────────────────────────────

export type JobStatus = "queued" | "running" | "completed" | "failed" | "cancelled";

export interface Job<T = unknown> {
  /** Unique job identifier */
  id: string;
  /** Job category (e.g., "transcription", "render", "clip-generation") */
  type: string;
  /** Current status */
  status: JobStatus;
  /** Progress from 0 to 1 */
  progress: number;
  /** Result data (when completed) */
  result?: T;
  /** Error message (when failed) */
  error?: string;
  /** Epoch ms when job was submitted */
  createdAt: number;
  /** Epoch ms when job started running */
  startedAt?: number;
  /** Epoch ms when job finished (completed or failed) */
  completedAt?: number;
}

export type JobExecutor<T> = (
  onProgress: (progress: number) => void,
  signal: AbortSignal,
) => Promise<T>;

type Listener = () => void;

// ── Internal job record (includes executor + abort controller) ───────

interface InternalJob<T = unknown> extends Job<T> {
  executor: JobExecutor<T>;
  abortController: AbortController;
}

// ── JobQueue ─────────────────────────────────────────────────────────

export class JobQueue {
  private jobs = new Map<string, InternalJob>();
  private listeners = new Set<Listener>();
  private maxConcurrent: number;

  constructor(maxConcurrent = 3) {
    this.maxConcurrent = maxConcurrent;
  }

  /**
   * Submit a new job to the queue.
   * Returns a snapshot of the job (read-only).
   * The executor receives an `onProgress` callback and an `AbortSignal`.
   */
  submit<T>(
    type: string,
    executor: JobExecutor<T>,
  ): Job<T> {
    const id = nanoid(12);
    const abortController = new AbortController();

    const job: InternalJob<T> = {
      id,
      type,
      status: "queued",
      progress: 0,
      createdAt: Date.now(),
      executor,
      abortController,
    };

    this.jobs.set(id, job as InternalJob);
    this.notify();
    this.processQueue();

    return this.snapshot(job);
  }

  /**
   * Get a read-only snapshot of a job by ID.
   */
  getJob<T = unknown>(id: string): Job<T> | null {
    const job = this.jobs.get(id);
    if (!job) return null;
    return this.snapshot(job) as Job<T>;
  }

  /**
   * Get all jobs (most recent first).
   */
  getAllJobs(): Job[] {
    return Array.from(this.jobs.values())
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((job) => this.snapshot(job));
  }

  /**
   * Get jobs that are currently running or queued.
   */
  getActiveJobs(): Job[] {
    return Array.from(this.jobs.values())
      .filter((j) => j.status === "running" || j.status === "queued")
      .sort((a, b) => a.createdAt - b.createdAt)
      .map((job) => this.snapshot(job));
  }

  /**
   * Get jobs that have completed (succeeded or failed).
   */
  getCompletedJobs(): Job[] {
    return Array.from(this.jobs.values())
      .filter((j) => j.status === "completed" || j.status === "failed")
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((job) => this.snapshot(job));
  }

  /**
   * Cancel a queued or running job.
   */
  cancel(id: string): boolean {
    const job = this.jobs.get(id);
    if (!job) return false;

    if (job.status === "queued" || job.status === "running") {
      job.abortController.abort();
      job.status = "cancelled";
      job.completedAt = Date.now();
      this.notify();
      this.processQueue(); // start next queued job
      return true;
    }

    return false;
  }

  /**
   * Remove a completed/failed/cancelled job from the queue.
   */
  remove(id: string): boolean {
    const job = this.jobs.get(id);
    if (!job) return false;
    if (job.status === "running" || job.status === "queued") return false;

    this.jobs.delete(id);
    this.notify();
    return true;
  }

  /**
   * Clear all completed/failed/cancelled jobs.
   */
  clearCompleted(): void {
    for (const [id, job] of this.jobs) {
      if (
        job.status === "completed" ||
        job.status === "failed" ||
        job.status === "cancelled"
      ) {
        this.jobs.delete(id);
      }
    }
    this.notify();
  }

  /**
   * Subscribe to queue state changes.
   * Returns an unsubscribe function.
   */
  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Get summary stats.
   */
  getStats(): {
    total: number;
    queued: number;
    running: number;
    completed: number;
    failed: number;
    cancelled: number;
  } {
    let queued = 0;
    let running = 0;
    let completed = 0;
    let failed = 0;
    let cancelled = 0;

    for (const job of this.jobs.values()) {
      switch (job.status) {
        case "queued":
          queued++;
          break;
        case "running":
          running++;
          break;
        case "completed":
          completed++;
          break;
        case "failed":
          failed++;
          break;
        case "cancelled":
          cancelled++;
          break;
      }
    }

    return {
      total: this.jobs.size,
      queued,
      running,
      completed,
      failed,
      cancelled,
    };
  }

  // ── Internal ─────────────────────────────────────────────────────

  private notify(): void {
    for (const listener of this.listeners) {
      try {
        listener();
      } catch {
        // Don't let a bad listener break the queue
      }
    }
  }

  /**
   * Start queued jobs up to the concurrency limit.
   */
  private processQueue(): void {
    const running = Array.from(this.jobs.values()).filter(
      (j) => j.status === "running",
    ).length;

    const available = this.maxConcurrent - running;
    if (available <= 0) return;

    const queued = Array.from(this.jobs.values())
      .filter((j) => j.status === "queued")
      .sort((a, b) => a.createdAt - b.createdAt);

    for (let i = 0; i < Math.min(available, queued.length); i++) {
      this.runJob(queued[i]);
    }
  }

  private async runJob(job: InternalJob): Promise<void> {
    job.status = "running";
    job.startedAt = Date.now();
    this.notify();

    const onProgress = (progress: number) => {
      job.progress = Math.max(0, Math.min(1, progress));
      this.notify();
    };

    try {
      const result = await job.executor(onProgress, job.abortController.signal);

      // Check if cancelled while running (status may be mutated by cancel())
      if ((job.status as string) === "cancelled") return;

      job.status = "completed";
      job.progress = 1;
      job.result = result;
      job.completedAt = Date.now();
    } catch (error) {
      // Check if this was a cancellation
      if (job.abortController.signal.aborted || (job.status as string) === "cancelled") {
        job.status = "cancelled";
        job.completedAt = Date.now();
      } else {
        job.status = "failed";
        job.error = error instanceof Error ? error.message : String(error);
        job.completedAt = Date.now();
      }
    }

    this.notify();
    this.processQueue(); // Start next queued job
  }

  /**
   * Create a read-only snapshot of a job (strips internals).
   */
  private snapshot<T>(job: InternalJob<T>): Job<T> {
    return {
      id: job.id,
      type: job.type,
      status: job.status,
      progress: job.progress,
      result: job.result,
      error: job.error,
      createdAt: job.createdAt,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
    };
  }
}

// ── Global Queue Singleton ───────────────────────────────────────────

let _queueInstance: JobQueue | null = null;

/**
 * Get the global job queue (lazily initialized).
 */
export function getJobQueue(maxConcurrent?: number): JobQueue {
  if (!_queueInstance) {
    _queueInstance = new JobQueue(maxConcurrent ?? 3);
  }
  return _queueInstance;
}

/** Reset the singleton (for testing). */
export function resetJobQueue(): void {
  _queueInstance = null;
}
