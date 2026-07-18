/*
 * Platform-managed credential pool.
 *
 * The app no longer relies on per-user BYOK keys — an admin loads a pool of
 * provider credentials (multiple ElevenLabs keys, proxy configs for Midjourney/
 * Suno/etc.) via the admin dashboard, and this module hands one out per request.
 *
 * Selection: among a provider's ENABLED rows, prefer highest `priority`, then
 * least-recently-used (round-robin within a tier) so quota is spread across keys.
 * On an auth/quota failure the caller reports it and we auto-disable that row so
 * the next call rotates to a healthy one.
 *
 * Secrets are stored AES-256-GCM encrypted; we decrypt only at hand-out.
 */

import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { providerCredentials } from "@/lib/db/schema";
import { decryptApiKey } from "@/lib/api-keys/crypto";

export type PooledCredential = {
  id: string;
  provider: string;
  kind: "key" | "proxy";
  secret: string;
  endpoint?: string;
};

// Pick one enabled credential for `provider`, or null if the pool has none.
// Bumps usage bookkeeping so the next call rotates to a different row.
export function getManagedCredential(provider: string): PooledCredential | null {
  const row = db
    .select()
    .from(providerCredentials)
    .where(and(eq(providerCredentials.provider, provider), eq(providerCredentials.enabled, true)))
    // Highest priority first, then the one used longest ago (nulls = never used
    // → sorted first by asc), giving round-robin within a priority tier.
    .orderBy(desc(providerCredentials.priority), asc(providerCredentials.lastUsedAt))
    .get();
  if (!row) return null;

  let secret: string;
  try {
    secret = decryptApiKey(row.secretEnc);
  } catch {
    // Undecryptable (e.g. rotated secret) — disable it and let the caller fall
    // back rather than handing out a broken credential.
    markCredentialFailed(row.id, "decrypt failed");
    return null;
  }

  db.update(providerCredentials)
    .set({ lastUsedAt: new Date(), usageCount: row.usageCount + 1 })
    .where(eq(providerCredentials.id, row.id))
    .run();

  return {
    id: row.id,
    provider: row.provider,
    kind: (row.kind as "key" | "proxy") ?? "key",
    secret,
    endpoint: row.endpoint ?? undefined,
  };
}

// Auto-disable a credential after an auth/quota failure so it stops being
// selected. Admins can re-enable it (clearing disabledReason) from the panel.
export function markCredentialFailed(id: string, reason: string): void {
  db.update(providerCredentials)
    .set({ enabled: false, disabledReason: reason.slice(0, 200), updatedAt: new Date() })
    .where(eq(providerCredentials.id, id))
    .run();
}

// Resolve a plain API key for a provider: managed pool → BYOK → env var.
// Returns undefined if none is available anywhere.
// Providers the PLATFORM pays for and always resolves from the pool/env: the
// agent brain + vision (anthropic) and free stock search (pexels). Everything
// else is a paid GENERATION provider the user must bring their own key for
// (BYOK) — no pool/env fallback, so generation is gated on a user-supplied key.
const PLATFORM_PROVIDERS = new Set(["anthropic", "pexels"]);

export function resolveApiKey(
  provider: string,
  envVar?: string,
  byok?: string,
): string | undefined {
  if (PLATFORM_PROVIDERS.has(provider)) {
    const managed = getManagedCredential(provider);
    if (managed?.secret) return managed.secret;
    if (byok) return byok;
    return envVar ? process.env[envVar] : undefined;
  }
  // Generation providers are BYOK-required — only the user's own key counts.
  return byok || undefined;
}

// True if the pool has at least one enabled credential for the provider.
export function hasManagedCredential(provider: string): boolean {
  const row = db
    .select({ id: providerCredentials.id })
    .from(providerCredentials)
    .where(and(eq(providerCredentials.provider, provider), eq(providerCredentials.enabled, true)))
    .get();
  return !!row;
}
