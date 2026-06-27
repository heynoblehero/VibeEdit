import { NextResponse } from "next/server";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { db } from "@/lib/db";
import { user } from "@/lib/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Structured per-dependency health. This backs the admin "system health" tile,
// so the shape is intentionally stable:
//   { status, timestamp, checks: { <name>: Check } }
// where Check = { ok, status, detail?, latencyMs? } and
//   status ∈ "ok" | "degraded" | "down".
//   - "ok"       → dependency healthy
//   - "degraded" → reachable but impaired, or a non-critical dep is missing
//   - "down"     → a critical dependency is unavailable (overall 503)
type CheckStatus = "ok" | "degraded" | "down";
type Check = { ok: boolean; status: CheckStatus; detail?: string; latencyMs?: number };

const STORAGE_ROOT = process.env.STORAGE_ROOT || resolve(process.cwd(), "storage");

async function timed<T>(
  fn: () => Promise<T> | T,
): Promise<{ value?: T; error?: unknown; ms: number }> {
  const start = Date.now();
  try {
    const value = await fn();
    return { value, ms: Date.now() - start };
  } catch (error) {
    return { error, ms: Date.now() - start };
  }
}

// Probe a binary's presence/runnability by invoking it with a version flag.
function probeBinary(bin: string, args: string[]): Promise<{ ok: boolean; detail: string }> {
  return new Promise((resolvePromise) => {
    import("node:child_process")
      .then(({ spawn }) => {
        const child = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"] });
        let out = "";
        const collect = (chunk: Buffer) => {
          if (out.length < 200) out += chunk.toString();
        };
        child.stdout?.on("data", collect);
        child.stderr?.on("data", collect);
        child.on("error", (error) =>
          resolvePromise({ ok: false, detail: (error as Error).message }),
        );
        child.on("exit", (code) => {
          const firstLine = out.split("\n")[0]?.trim() || "";
          resolvePromise(
            code === 0
              ? { ok: true, detail: firstLine || "present" }
              : { ok: false, detail: `exited ${code}` },
          );
        });
      })
      .catch((error) => resolvePromise({ ok: false, detail: (error as Error).message }));
  });
}

export async function GET() {
  const checks: Record<string, Check> = {};

  // ── Database read ─────────────────────────────────────────────────────────
  const dbRead = await timed(() => db.select({ id: user.id }).from(user).limit(1).all().length);
  checks.databaseRead = dbRead.error
    ? { ok: false, status: "down", detail: (dbRead.error as Error).message, latencyMs: dbRead.ms }
    : { ok: true, status: "ok", detail: "select ok", latencyMs: dbRead.ms };

  // ── Database write ────────────────────────────────────────────────────────
  // Exercise the write path without touching real rows: a scratch temp table
  // proves the DB file is writable (not read-only / out of disk / WAL-locked).
  const dbWrite = await timed(() => {
    const sqlite = (db as unknown as { $client: { exec: (sql: string) => void } }).$client;
    sqlite.exec(
      "CREATE TEMP TABLE IF NOT EXISTS __health_probe (n INTEGER); " +
        "INSERT INTO __health_probe (n) VALUES (1); " +
        "DELETE FROM __health_probe;",
    );
  });
  checks.databaseWrite = dbWrite.error
    ? { ok: false, status: "down", detail: (dbWrite.error as Error).message, latencyMs: dbWrite.ms }
    : { ok: true, status: "ok", detail: "write ok", latencyMs: dbWrite.ms };

  // ── Storage writability ───────────────────────────────────────────────────
  const storage = await timed(() => {
    mkdirSync(STORAGE_ROOT, { recursive: true });
    const probe = resolve(STORAGE_ROOT, `.health-probe-${process.pid}`);
    writeFileSync(probe, "ok");
    rmSync(probe, { force: true });
    return STORAGE_ROOT;
  });
  checks.storage = storage.error
    ? { ok: false, status: "down", detail: (storage.error as Error).message, latencyMs: storage.ms }
    : { ok: true, status: "ok", detail: "writable", latencyMs: storage.ms };

  // ── ffmpeg / ffprobe (required for renders + thumbnails) ───────────────────
  const ffmpegBin = process.env.FFMPEG_PATH || "ffmpeg";
  const ffprobeBin = process.env.FFPROBE_PATH || "ffprobe";
  const [ffmpeg, ffprobe] = await Promise.all([
    probeBinary(ffmpegBin, ["-version"]),
    probeBinary(ffprobeBin, ["-version"]),
  ]);
  checks.ffmpeg = ffmpeg.ok
    ? { ok: true, status: "ok", detail: ffmpeg.detail }
    : { ok: false, status: "down", detail: ffmpeg.detail };
  checks.ffprobe = ffprobe.ok
    ? { ok: true, status: "ok", detail: ffprobe.detail }
    : { ok: false, status: "down", detail: ffprobe.detail };

  // ── Snapshot browser (Chrome) — powers in-process snapshots ────────────────
  const browser = await timed(async () => {
    const { isChromeAvailable } = await import("@/lib/ai/snapshot/browser-pool");
    return isChromeAvailable();
  });
  checks.snapshotBrowser = browser.error
    ? {
        ok: false,
        status: "degraded",
        detail: (browser.error as Error).message,
        latencyMs: browser.ms,
      }
    : browser.value
      ? { ok: true, status: "ok", detail: "chrome resolved", latencyMs: browser.ms }
      : {
          ok: false,
          status: "degraded",
          detail: "no chrome (set HYPERFRAMES_BROWSER_PATH or run `hyperframes doctor`)",
          latencyMs: browser.ms,
        };

  // ── AI provider reachability (Anthropic) ───────────────────────────────────
  const baseURL = (process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com").replace(
    /\/$/,
    "",
  );
  const provider = await timed(async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    try {
      // Cheap reachability probe: no auth, no tokens. A 401/404 still proves the
      // endpoint is up; only a network error or timeout means it's unreachable.
      const res = await fetch(`${baseURL}/v1/models`, {
        method: "GET",
        headers: { "anthropic-version": "2023-06-01" },
        signal: controller.signal,
      });
      return res.status;
    } finally {
      clearTimeout(timer);
    }
  });
  if (provider.error) {
    const message =
      (provider.error as Error).name === "AbortError"
        ? "timeout after 5000ms"
        : (provider.error as Error).message;
    checks.aiProvider = { ok: false, status: "degraded", detail: message, latencyMs: provider.ms };
  } else {
    checks.aiProvider = {
      ok: true,
      status: "ok",
      detail: `reachable (http ${provider.value})`,
      latencyMs: provider.ms,
    };
  }

  // ── CLI binary (informational — in-process is the default path) ────────────
  const cliPath = resolve(process.cwd(), "node_modules", ".bin", "hyperframes");
  const cliPresent = existsSync(cliPath);
  checks.cli = {
    ok: true,
    status: cliPresent ? "ok" : "degraded",
    detail: cliPresent ? "hyperframes binary present" : "binary absent (using in-process)",
  };

  // ── Roll up ────────────────────────────────────────────────────────────────
  const statuses = Object.values(checks).map((c) => c.status);
  const overall: CheckStatus = statuses.includes("down")
    ? "down"
    : statuses.includes("degraded")
      ? "degraded"
      : "ok";
  // Only a hard "down" returns 503 — degraded dependencies still serve traffic.
  const httpStatus = overall === "down" ? 503 : 200;

  return NextResponse.json(
    { status: overall, checks, timestamp: new Date().toISOString() },
    { status: httpStatus },
  );
}
