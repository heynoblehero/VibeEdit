// /api/health — one-stop status check. Combines storage canaries, env
// keys, bridge reachability. Used by the UI and by any external uptime
// monitor. Returns 200 with structured detail; non-fatal warnings don't
// flip the overall ok flag, but bad storage / unreachable proxy do.

import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import { applyStoredKeys } from "@/lib/server/runtime-keys";

export const runtime = "nodejs";

interface CheckResult {
  name: string;
  ok: boolean;
  detail: string;
  fatal: boolean;
}

function dataDir(): string {
  return process.env.VIBEEDIT_DATA_DIR || path.join(process.cwd(), "public");
}

function checkStorage(subdir: string): CheckResult {
  const dir = path.join(dataDir(), subdir);
  try {
    fs.mkdirSync(dir, { recursive: true });
    const canary = path.join(dir, `.h-${crypto.randomBytes(3).toString("hex")}`);
    fs.writeFileSync(canary, "ok");
    const back = fs.readFileSync(canary, "utf8");
    fs.unlinkSync(canary);
    if (back !== "ok") throw new Error("canary mismatch");
    return {
      name: `storage:${subdir}`,
      ok: true,
      detail: `${dir} writable+readable`,
      fatal: true,
    };
  } catch (e) {
    return {
      name: `storage:${subdir}`,
      ok: false,
      detail: `${dir}: ${e instanceof Error ? e.message : String(e)}`,
      fatal: true,
    };
  }
}

async function checkBridge(): Promise<CheckResult> {
  const base = process.env.ANTHROPIC_BASE_URL;
  const isProxied = !!base && !/api\.anthropic\.com/i.test(base);
  if (!isProxied) {
    return {
      name: "bridge",
      ok: true,
      detail: "direct Anthropic API (no proxy configured)",
      fatal: false,
    };
  }
  try {
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 1500);
    const res = await fetch(`${base.replace(/\/$/, "")}/v1/models`, {
      method: "GET",
      signal: ctrl.signal,
    });
    clearTimeout(to);
    const ok = res.ok || res.status === 401;
    return {
      name: "bridge",
      ok,
      detail: `proxy ${base}: HTTP ${res.status}`,
      fatal: true,
    };
  } catch (e) {
    return {
      name: "bridge",
      ok: false,
      detail: `proxy unreachable: ${e instanceof Error ? e.message : String(e)}`,
      fatal: true,
    };
  }
}

export async function GET() {
  applyStoredKeys();
  const checks: CheckResult[] = [];
  for (const sub of ["uploads", "voiceovers"]) {
    checks.push(checkStorage(sub));
  }
  checks.push(await checkBridge());

  // Provider key inventory — non-fatal informational rows.
  const keysSet: string[] = [];
  for (const k of [
    "ANTHROPIC_API_KEY",
    "OPENAI_API_KEY",
    "REPLICATE_API_TOKEN",
    "ELEVENLABS_API_KEY",
    "TAVILY_API_KEY",
    "FAL_API_KEY",
  ]) {
    if (process.env[k]) keysSet.push(k);
  }
  checks.push({
    name: "provider-keys",
    ok: keysSet.length > 0,
    detail: keysSet.length > 0
      ? `set: ${keysSet.join(", ")}`
      : "no provider keys set — agent tools will 501",
    fatal: false,
  });

  const overall = checks.every((c) => c.ok || !c.fatal);
  return Response.json(
    {
      ok: overall,
      ts: new Date().toISOString(),
      checks,
    },
    { status: overall ? 200 : 503 },
  );
}
