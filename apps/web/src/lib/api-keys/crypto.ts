import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/*
 * AES-256-GCM encryption for BYOK provider keys stored at rest.
 *
 * Mirrors the proven pattern in lib/publish (which protects OAuth tokens with
 * PUBLISH_TOKEN_SECRET). Provider API keys are long-lived credentials with real
 * billing blast radius, so when we DO persist them server-side they must never
 * touch the database in plaintext.
 *
 * Key material comes from API_KEYS_SECRET (a dedicated secret, separate from the
 * publish/auth secrets so rotating one never invalidates the others). It must be
 * at least 32 chars; we take the first 32 bytes as the AES-256 key.
 *
 * Ciphertext layout (base64): [12-byte IV][16-byte GCM tag][ciphertext].
 */

const ENC_PREFIX = "enc:v1:";

function getKey(): Buffer {
  const secret = process.env.API_KEYS_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("API_KEYS_SECRET must be set to at least 32 chars to store BYOK keys at rest");
  }
  return Buffer.from(secret.slice(0, 32), "utf8");
}

export function isApiKeysSecretConfigured(): boolean {
  const secret = process.env.API_KEYS_SECRET;
  return !!secret && secret.length >= 32;
}

// Encrypt a plaintext API key for storage. The returned string is tagged with a
// version prefix so reads can distinguish ciphertext from any legacy plaintext.
export function encryptApiKey(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ENC_PREFIX + Buffer.concat([iv, tag, encrypted]).toString("base64");
}

// Decrypt a stored value. Decrypt-or-passthrough: values WITHOUT the enc prefix
// are assumed to be legacy plaintext (written before encryption-at-rest landed)
// and returned as-is, so existing rows keep working and get re-encrypted on the
// next write. Tampered/undecryptable ciphertext throws.
export function decryptApiKey(stored: string): string {
  if (!stored.startsWith(ENC_PREFIX)) return stored; // legacy plaintext
  const buf = Buffer.from(stored.slice(ENC_PREFIX.length), "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const encrypted = buf.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", getKey(), iv);
  decipher.setAuthTag(tag);
  return decipher.update(encrypted) + decipher.final("utf8");
}

// True if a stored value is already encrypted (has the version prefix).
export function isEncrypted(stored: string): boolean {
  return stored.startsWith(ENC_PREFIX);
}

// Server-side masking — never return a full key to the client. Shows the last 4
// characters only (e.g. "····················cdef"). Mirrors the client maskKey
// in store.ts but operates on the decrypted value at the point of response.
export function maskApiKey(plaintext: string | null | undefined): string {
  if (!plaintext) return "";
  const trimmed = plaintext.trim();
  if (trimmed.length <= 4) return "•".repeat(trimmed.length);
  return `${"•".repeat(Math.max(4, trimmed.length - 4))}${trimmed.slice(-4)}`;
}
