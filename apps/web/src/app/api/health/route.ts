import { NextResponse } from "next/server";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { db } from "@/lib/db";
import { user } from "@/lib/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const checks: Record<string, { ok: boolean; detail?: string }> = {};

  try {
    const count = db.select({ id: user.id }).from(user).limit(1).all().length;
    checks.database = { ok: true, detail: `${count >= 0 ? "reachable" : ""}` };
  } catch (error) {
    checks.database = { ok: false, detail: (error as Error).message };
  }

  checks.anthropic = process.env.ANTHROPIC_API_KEY
    ? { ok: true, detail: "api-key configured" }
    : { ok: true, detail: "using Claude Code OAuth (Agent SDK)" };

  // Snapshot + lint now run in-process; the CLI binary is only a fallback, so
  // its absence is informational (not a failure).
  const cliPath = resolve(process.cwd(), "node_modules", ".bin", "hyperframes");
  checks.cli = {
    ok: true,
    detail: existsSync(cliPath) ? "hyperframes binary present" : "binary absent (using in-process)",
  };

  // Chrome powers in-process snapshots — its absence is a real degradation.
  try {
    const { isChromeAvailable } = await import("@/lib/ai/snapshot/browser-pool");
    const chromeOk = await isChromeAvailable();
    checks.snapshotBrowser = chromeOk
      ? { ok: true, detail: "chrome resolved" }
      : {
          ok: false,
          detail: "no chrome (set HYPERFRAMES_BROWSER_PATH or run `hyperframes doctor`)",
        };
  } catch (error) {
    checks.snapshotBrowser = { ok: false, detail: (error as Error).message };
  }

  const allOk = Object.values(checks).every((c) => c.ok);
  const status = allOk ? "ok" : "degraded";

  return NextResponse.json(
    { status, checks, timestamp: new Date().toISOString() },
    { status: allOk ? 200 : 503 },
  );
}
