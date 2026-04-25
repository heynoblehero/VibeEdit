// /api/keys — GET returns which keys are set (boolean only, never the
// value). POST accepts { key: value, ... } and persists to VIBEEDIT_DATA_DIR.
//
// Single-user dev tool — no auth gate. Add one if multi-tenant.

import type { NextRequest } from "next/server";
import {
  KNOWN_KEYS,
  isAllowedKey,
  loadStoredKeys,
  saveStoredKeys,
} from "@/lib/server/runtime-keys";

export const runtime = "nodejs";

export async function GET() {
  const stored = loadStoredKeys();
  const status: Record<string, { source: "env" | "stored" | null; preview: string | null }> = {};
  // Report on every well-known key + any custom ones already stored.
  const all = new Set<string>([...KNOWN_KEYS, ...Object.keys(stored)]);
  for (const k of all) {
    const fromStored = stored[k];
    const fromEnv = process.env[k];
    const value = fromStored ?? fromEnv;
    status[k] = {
      source: fromStored ? "stored" : fromEnv ? "env" : null,
      preview: value
        ? value.length > 12
          ? `${value.slice(0, 6)}…${value.slice(-3)}`
          : "<short>"
        : null,
    };
  }
  return Response.json({ keys: status });
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as Record<string, string>;
  const incoming: Record<string, string> = {};
  for (const [k, v] of Object.entries(body)) {
    if (!isAllowedKey(k)) {
      return Response.json({ error: `disallowed key name: ${k}` }, { status: 400 });
    }
    if (typeof v === "string") incoming[k] = v;
  }
  // Merge with existing — empty string deletes that key.
  const merged = { ...loadStoredKeys() };
  for (const [k, v] of Object.entries(incoming)) {
    if (v.trim()) merged[k] = v.trim();
    else delete merged[k];
  }
  saveStoredKeys(merged);
  return Response.json({ ok: true, count: Object.keys(merged).length });
}
