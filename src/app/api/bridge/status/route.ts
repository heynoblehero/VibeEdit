import { promises as fs } from "node:fs";
import path from "node:path";
import { isBridgeMode } from "@/lib/server/claude-bridge";

export const runtime = "nodejs";

async function countFiles(dir: string): Promise<number> {
  try {
    const entries = await fs.readdir(dir);
    return entries.filter((e) => e.endsWith(".json")).length;
  } catch {
    return 0;
  }
}

export async function GET() {
  const bridge = isBridgeMode();
  const root = path.join(process.cwd(), ".ai-bridge");
  const [pending, done, errors] = await Promise.all([
    countFiles(path.join(root, "pending")),
    countFiles(path.join(root, "done")),
    countFiles(path.join(root, "error")),
  ]);
  const baseUrl = process.env.ANTHROPIC_BASE_URL;
  // "via Claude Max" when the upstream isn't api.anthropic.com — lets the UI
  // show the user the proxy is being used.
  const isProxied = !!baseUrl && !/api\.anthropic\.com/i.test(baseUrl);

  // When proxied, probe the upstream so the UI can show "proxy unreachable"
  // instead of silently failing on the next agent call. Quick 1.5s timeout.
  let upstreamReachable: boolean | null = null;
  if (isProxied && baseUrl) {
    try {
      const ctrl = new AbortController();
      const to = setTimeout(() => ctrl.abort(), 1500);
      const res = await fetch(`${baseUrl.replace(/\/$/, "")}/v1/models`, {
        method: "GET",
        signal: ctrl.signal,
      });
      clearTimeout(to);
      upstreamReachable = res.ok || res.status === 401;
    } catch {
      upstreamReachable = false;
    }
  }

  return Response.json({
    bridge,
    hasAnthropicKey: !!process.env.ANTHROPIC_API_KEY,
    baseUrl: baseUrl ?? null,
    isProxied,
    upstreamReachable,
    pending,
    done,
    errors,
  });
}
