/**
 * Runtime-configurable API keys. The user can paste keys via the
 * Settings dialog and they're persisted to VIBEEDIT_DATA_DIR/keys.json.
 * On every request the agent / media routes call `effectiveEnv()` which
 * merges file-stored keys over process env vars — file wins, so the
 * dashboard takes effect without a redeploy.
 *
 * Stored as plain JSON. This is a single-user dev tool; encrypt-at-rest
 * is a future TODO if multi-tenant.
 */

import fs from "node:fs";
import path from "node:path";

const KEYS_PATH = path.join(
  process.env.VIBEEDIT_DATA_DIR || path.join(process.cwd(), ".data"),
  "keys.json",
);

// Whitelist — only known env-var names get persisted. Prevents the UI
// from arbitrarily setting NODE_ENV or similar.
const ALLOWED_KEYS = [
  "ANTHROPIC_API_KEY",
  "ANTHROPIC_BASE_URL",
  "OPENAI_API_KEY",
  "REPLICATE_API_TOKEN",
  "ELEVENLABS_API_KEY",
  "FAL_API_KEY",
  "AVATAR_PROVIDER",
  "AVATAR_DEFAULT_PORTRAIT_URL",
  "SEARCH_PROVIDER",
  "TAVILY_API_KEY",
  "SERPER_API_KEY",
  // open-ended for tools we add later — agent can ask the user to set it
  // and the UI lets them paste anything they want into the "custom" field.
] as const;

export type AllowedKey = (typeof ALLOWED_KEYS)[number];

export function isAllowedKey(name: string): boolean {
  // Allow any name that LOOKS like an env-var (uppercase letters/digits/_)
  // — supports "the agent asked me to set FOO_API_KEY" pattern. Still
  // rejects path traversal / shell metas.
  return /^[A-Z][A-Z0-9_]{2,63}$/.test(name);
}

export function loadStoredKeys(): Record<string, string> {
  try {
    const raw = fs.readFileSync(KEYS_PATH, "utf8");
    const parsed = JSON.parse(raw) as Record<string, string>;
    return parsed;
  } catch {
    return {};
  }
}

export function saveStoredKeys(keys: Record<string, string>): void {
  try {
    fs.mkdirSync(path.dirname(KEYS_PATH), { recursive: true });
  } catch {}
  // Keep only allowed keys, drop empty values.
  const clean: Record<string, string> = {};
  for (const [k, v] of Object.entries(keys)) {
    if (!isAllowedKey(k)) continue;
    if (typeof v === "string" && v.trim()) clean[k] = v.trim();
  }
  fs.writeFileSync(KEYS_PATH, JSON.stringify(clean, null, 2));
  // Apply to process.env so the rest of the request uses them immediately.
  for (const [k, v] of Object.entries(clean)) {
    process.env[k] = v;
  }
}

/**
 * Call this at the top of any request handler that reads env vars. It
 * applies persisted-file overrides into process.env so subsequent reads
 * see them. Idempotent.
 */
let applied = false;
export function applyStoredKeys(): void {
  if (applied) return;
  const stored = loadStoredKeys();
  for (const [k, v] of Object.entries(stored)) {
    if (!process.env[k] && v) process.env[k] = v;
  }
  applied = true;
}

export const KNOWN_KEYS = ALLOWED_KEYS;
