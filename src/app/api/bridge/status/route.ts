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
  return Response.json({
    bridge,
    hasAnthropicKey: !!process.env.ANTHROPIC_API_KEY,
    pending,
    done,
    errors,
  });
}
