import { and, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import { apiKeys } from "@/lib/db/schema";
import type { ProviderId } from "./store";
import { decryptApiKey, encryptApiKey, isEncrypted, maskApiKey } from "./crypto";

/*
 * Server-side BYOK key store — encrypts provider keys at rest with AES-256-GCM
 * (API_KEYS_SECRET). This is the opt-in counterpart to the browser-local
 * localStorage store in store.ts: keys persisted here survive across devices but
 * never leave the server in plaintext and are never logged.
 *
 * Reads use decrypt-or-passthrough (see crypto.decryptApiKey) so any legacy
 * plaintext row keeps working and is transparently re-encrypted on next write.
 */

export type StoredKeyMeta = {
  provider: ProviderId;
  // Masked for display only — last 4 chars, e.g. "••••••••cdef". Never the full key.
  masked: string;
  last4: string | null;
  updatedAt: Date;
};

function last4Of(plaintext: string): string {
  return plaintext.trim().slice(-4);
}

// Upsert (encrypt then store) a user's key for one provider.
export function setStoredApiKey(userId: string, provider: ProviderId, plaintext: string): void {
  const trimmed = plaintext.trim();
  if (!trimmed) {
    clearStoredApiKey(userId, provider);
    return;
  }
  const now = new Date();
  const keyEnc = encryptApiKey(trimmed);
  const last4 = last4Of(trimmed);
  const existing = db
    .select({ id: apiKeys.id })
    .from(apiKeys)
    .where(and(eq(apiKeys.userId, userId), eq(apiKeys.provider, provider)))
    .get();
  if (existing) {
    db.update(apiKeys)
      .set({ keyEnc, last4, updatedAt: now })
      .where(eq(apiKeys.id, existing.id))
      .run();
    return;
  }
  db.insert(apiKeys)
    .values({
      id: nanoid(16),
      userId,
      provider,
      keyEnc,
      last4,
      createdAt: now,
      updatedAt: now,
    })
    .run();
}

export function clearStoredApiKey(userId: string, provider: ProviderId): void {
  db.delete(apiKeys)
    .where(and(eq(apiKeys.userId, userId), eq(apiKeys.provider, provider)))
    .run();
}

// Decrypt a user's stored key for one provider — call only at point of use.
// Returns null if no key is stored. Re-encrypts legacy plaintext rows lazily.
export function getStoredApiKey(userId: string, provider: ProviderId): string | null {
  const row = db
    .select({ id: apiKeys.id, keyEnc: apiKeys.keyEnc })
    .from(apiKeys)
    .where(and(eq(apiKeys.userId, userId), eq(apiKeys.provider, provider)))
    .get();
  if (!row) return null;
  const plaintext = decryptApiKey(row.keyEnc);
  // Migrate legacy plaintext to ciphertext on read.
  if (!isEncrypted(row.keyEnc)) {
    db.update(apiKeys)
      .set({ keyEnc: encryptApiKey(plaintext), last4: last4Of(plaintext), updatedAt: new Date() })
      .where(eq(apiKeys.id, row.id))
      .run();
  }
  return plaintext;
}

// List a user's stored keys as masked metadata — safe to return to the client.
export function listStoredKeyMeta(userId: string): StoredKeyMeta[] {
  const rows = db
    .select({
      provider: apiKeys.provider,
      keyEnc: apiKeys.keyEnc,
      last4: apiKeys.last4,
      updatedAt: apiKeys.updatedAt,
    })
    .from(apiKeys)
    .where(eq(apiKeys.userId, userId))
    .all();
  return rows.map((r) => {
    // Prefer the stored last4; fall back to decrypting for legacy rows.
    const last4 = r.last4 ?? last4Of(decryptApiKey(r.keyEnc));
    return {
      provider: r.provider as ProviderId,
      masked: maskApiKey(`____${last4}`),
      last4,
      updatedAt: r.updatedAt,
    };
  });
}
