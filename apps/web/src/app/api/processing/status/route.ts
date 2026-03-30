import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/processing/status?jobId=xxx
 *
 * Returns the status of a processing job.
 *
 * For client-side jobs: the job queue lives in the browser,
 * so this endpoint is only used for server-side jobs that were
 * submitted to remote endpoints.
 *
 * This route acts as a proxy/aggregator. When a remote job is submitted
 * via the processing router, it stores a (jobId -> statusUrl) mapping
 * in the in-memory registry below. This route forwards the status check
 * to the actual remote endpoint.
 */

//  In-memory job registry 
// Maps jobId -> { statusUrl, lastStatus, createdAt }

interface RemoteJobRecord {
  statusUrl: string;
  lastStatus: string;
  lastProgress: number;
  lastResult?: unknown;
  lastError?: string;
  createdAt: number;
}

const remoteJobs = new Map<string, RemoteJobRecord>();

// Cleanup old records after 1 hour
const MAX_AGE_MS = 60 * 60 * 1000;

function cleanupOldRecords(): void {
  const now = Date.now();
  for (const [id, record] of remoteJobs) {
    if (now - record.createdAt > MAX_AGE_MS) {
      remoteJobs.delete(id);
    }
  }
}

//  Register a remote job (called from server-side code) 

export function registerRemoteJob(jobId: string, statusUrl: string): void {
  remoteJobs.set(jobId, {
    statusUrl,
    lastStatus: "queued",
    lastProgress: 0,
    createdAt: Date.now(),
  });
  cleanupOldRecords();
}

export function getRemoteJobRecord(jobId: string): RemoteJobRecord | undefined {
  return remoteJobs.get(jobId);
}

//  GET handler 

export async function GET(request: NextRequest) {
  const jobId = request.nextUrl.searchParams.get("jobId");

  if (!jobId) {
    return NextResponse.json(
      { error: "jobId query parameter is required" },
      { status: 400 },
    );
  }

  const record = remoteJobs.get(jobId);

  if (!record) {
    return NextResponse.json(
      { error: "Job not found. It may have expired or was never registered." },
      { status: 404 },
    );
  }

  // If the job already reached a terminal state, return cached result
  if (
    record.lastStatus === "completed" ||
    record.lastStatus === "done" ||
    record.lastStatus === "failed" ||
    record.lastStatus === "error"
  ) {
    return NextResponse.json({
      jobId,
      status: record.lastStatus,
      progress: record.lastProgress,
      result: record.lastResult,
      error: record.lastError,
    });
  }

  // Poll the remote status URL
  try {
    const response = await fetch(record.statusUrl, {
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      return NextResponse.json({
        jobId,
        status: "unknown",
        progress: record.lastProgress,
        error: `Remote status check failed: ${response.status}`,
      });
    }

    const body = await response.json();

    // Update cached state
    record.lastStatus = body.status || "running";
    if (body.progress !== undefined) {
      record.lastProgress = body.progress;
    }
    if (body.result !== undefined) {
      record.lastResult = body.result;
    }
    if (body.error !== undefined) {
      record.lastError = body.error;
    }

    return NextResponse.json({
      jobId,
      status: record.lastStatus,
      progress: record.lastProgress,
      result: record.lastResult,
      error: record.lastError,
    });
  } catch (error) {
    return NextResponse.json({
      jobId,
      status: "unknown",
      progress: record.lastProgress,
      error: `Failed to check remote status: ${error instanceof Error ? error.message : "Unknown error"}`,
    });
  }
}

//  POST handler: register a new remote job 

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { jobId, statusUrl } = body;

    if (!jobId || !statusUrl) {
      return NextResponse.json(
        { error: "jobId and statusUrl are required" },
        { status: 400 },
      );
    }

    // Basic URL validation
    try {
      new URL(statusUrl);
    } catch {
      return NextResponse.json(
        { error: "statusUrl is not a valid URL" },
        { status: 400 },
      );
    }

    registerRemoteJob(jobId, statusUrl);

    return NextResponse.json({ registered: true, jobId });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Registration failed" },
      { status: 500 },
    );
  }
}
