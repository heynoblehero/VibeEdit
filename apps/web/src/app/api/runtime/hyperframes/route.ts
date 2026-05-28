import { NextResponse } from "next/server";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Serves the compiled Hyperframes runtime so compositions can load it
// as a same-origin synchronous script, without a CDN round-trip.
// process.cwd() = /app/apps/web in production.
const RUNTIME_PATH = resolve(process.cwd(), "../../packages/core/dist/hyperframe.runtime.iife.js");

let cached: Buffer | null = null;

export async function GET() {
  try {
    if (!cached) cached = readFileSync(RUNTIME_PATH);
    return new NextResponse(new Uint8Array(cached), {
      headers: {
        "content-type": "application/javascript; charset=utf-8",
        "cache-control": "public, max-age=3600",
        "x-content-type-options": "nosniff",
      },
    });
  } catch {
    return new NextResponse("// runtime not found", {
      status: 404,
      headers: { "content-type": "application/javascript" },
    });
  }
}
