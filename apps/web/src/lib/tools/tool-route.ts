/*
 * Shared request handling for the public free-tool upload endpoints. Every tool
 * route reduces to: a GET that reports the remaining daily quota, and a POST
 * that validates + rate-limits the upload, runs an ffmpeg operation, and streams
 * the result back. The per-tool specifics (accepted formats, the ffmpeg step,
 * the output type) are passed in as config so each route file stays tiny.
 *
 * NOTE: these routes are deliberately NOT behind the Edge rate-limit middleware
 * (that breaks multipart request.formData() in Next 15) — the burst limit is
 * enforced here instead, on top of the per-day quota.
 */

import { mkdirSync, readFileSync, writeFileSync, existsSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { getServerSession } from "@/lib/server-session";
import { slidingWindowCheck } from "@/lib/rate-limit";
import { clientIpFrom, checkToolQuota, peekToolQuota, probeVideo } from "./free-tools";

const MAX_BYTES = 100 * 1024 * 1024; // 100 MB
const DEFAULT_ANON_DAILY = 2;
const DEFAULT_USER_DAILY = 20;

export type ProbeInfo = { ok: boolean; duration: number; width: number; height: number };

export type ToolConfig = {
  // Quota namespace + rate-limit key prefix.
  key: string;
  // Accepted input filename extensions.
  accept: RegExp;
  // Reject inputs longer than this (seconds); omit to skip the check.
  maxDurationS?: number;
  // Response content type + download filename + output file extension.
  outContentType: string;
  outName: string;
  outExt: string;
  // Override the output type per-request (e.g. the converter picks the format
  // from the form). Wins over the static fields above when present.
  resolveOutput?: (form: FormData) => { outExt: string; outContentType: string; outName: string };
  anonDaily?: number;
  userDaily?: number;
  // The ffmpeg step. Runs with validated paths; return { ok:false, error } to
  // surface a friendly message.
  process: (args: {
    inputPath: string;
    outputPath: string;
    info: ProbeInfo;
    authed: boolean;
    form: FormData;
  }) => Promise<{ ok: boolean; error?: string }>;
};

// GET → remaining free runs today (for the UI).
export async function toolQuotaGet(req: Request, config: ToolConfig): Promise<Response> {
  const session = await getServerSession().catch(() => null);
  const anon = config.anonDaily ?? DEFAULT_ANON_DAILY;
  const user = config.userDaily ?? DEFAULT_USER_DAILY;
  const key = session
    ? `${config.key}:user:${session.user.id}`
    : `${config.key}:ip:${clientIpFrom(req)}`;
  const limit = session ? user : anon;
  const { remaining } = peekToolQuota(key, limit);
  return Response.json({ remaining, limit, authed: !!session });
}

// POST → validate, rate-limit, process, stream the result.
export async function handleToolUpload(req: Request, config: ToolConfig): Promise<Response> {
  const ip = clientIpFrom(req);

  // Burst limit (per-minute) — enforced here, not in middleware.
  const burst = slidingWindowCheck(`tools:${ip}`, {
    limit: Number(process.env.RL_TOOLS_PER_MIN || 6),
    windowSec: 60,
  });
  if (!burst.ok) {
    return Response.json(
      { error: `Too many requests. Retry in ${burst.retryAfterSec}s.` },
      { status: 429, headers: { "retry-after": String(burst.retryAfterSec) } },
    );
  }

  const session = await getServerSession().catch(() => null);
  const authed = !!session;
  const anon = config.anonDaily ?? DEFAULT_ANON_DAILY;
  const user = config.userDaily ?? DEFAULT_USER_DAILY;
  const key = authed ? `${config.key}:user:${session!.user.id}` : `${config.key}:ip:${ip}`;
  const limit = authed ? user : anon;

  const quota = checkToolQuota(key, limit);
  if (!quota.ok) {
    return Response.json(
      {
        error: authed
          ? `Daily limit reached (${limit}/day). Try again tomorrow.`
          : `Free limit reached (${limit}/day). Sign up free for ${user}/day.`,
        needsSignup: !authed,
      },
      { status: 429 },
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json({ error: "expected multipart form data" }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File)) return Response.json({ error: "no file" }, { status: 400 });
  if (file.size > MAX_BYTES) {
    return Response.json({ error: "file too large (max 100 MB)" }, { status: 400 });
  }
  if (!config.accept.test(file.name)) {
    return Response.json({ error: "unsupported file format" }, { status: 400 });
  }

  const output = config.resolveOutput
    ? config.resolveOutput(form)
    : { outExt: config.outExt, outContentType: config.outContentType, outName: config.outName };

  const dir = join(tmpdir(), `vibe_tool_${randomBytes(6).toString("hex")}`);
  mkdirSync(dir, { recursive: true });
  const inputPath = join(dir, `in_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`);
  const outputPath = join(dir, `out.${output.outExt}`);
  const cleanup = () => {
    for (const path of [inputPath, outputPath]) {
      try {
        if (existsSync(path)) unlinkSync(path);
      } catch {
        /* ignore */
      }
    }
  };

  try {
    writeFileSync(inputPath, Buffer.from(await file.arrayBuffer()));
    const info = await probeVideo(inputPath);
    if (!info.ok) {
      cleanup();
      return Response.json({ error: "could not read that file" }, { status: 400 });
    }
    if (config.maxDurationS && info.duration > config.maxDurationS + 1) {
      cleanup();
      return Response.json(
        { error: `too long (max ${config.maxDurationS}s). Trim it first.` },
        { status: 400 },
      );
    }

    const result = await config.process({ inputPath, outputPath, info, authed, form });
    if (!result.ok || !existsSync(outputPath)) {
      cleanup();
      return Response.json(
        { error: result.error || "processing failed — try a different file" },
        { status: 500 },
      );
    }

    const bytes = readFileSync(outputPath);
    cleanup();
    return new Response(new Uint8Array(bytes), {
      headers: {
        "content-type": output.outContentType,
        "content-disposition": `attachment; filename="${output.outName}"`,
        "x-quota-remaining": String(quota.remaining),
      },
    });
  } catch (error) {
    cleanup();
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}
