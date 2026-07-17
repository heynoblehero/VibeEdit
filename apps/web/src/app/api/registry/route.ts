import { NextResponse } from "next/server";
import { listRegistry } from "@/lib/ai/registry";

export const runtime = "nodejs";

// The code-effects catalog (registry blocks) for the Effects Store — name, title,
// description, tags, dimensions. Public metadata; the HTML is served separately.
export function GET() {
  const blocks = listRegistry().filter((entry) => entry.kind === "block");
  return NextResponse.json({ blocks }, { headers: { "cache-control": "public, max-age=300" } });
}
