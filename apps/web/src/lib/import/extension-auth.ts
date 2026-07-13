/**
 * Resolve a browser-extension capture token → userId. The extension carries this
 * token (minted in Settings) in the `x-vibe-token` header instead of a cookie
 * session, mirroring the RISE_VERIFY_TOKEN pattern in /api/photo-verify but
 * per-user and revocable (see the extensionTokens table).
 */

import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { extensionTokens } from "@/lib/db/schema";

export function resolveExtensionToken(token: string | null | undefined): string | null {
  if (!token) return null;
  const row = db
    .select({ userId: extensionTokens.userId })
    .from(extensionTokens)
    .where(and(eq(extensionTokens.token, token), isNull(extensionTokens.revokedAt)))
    .get();
  if (!row) return null;
  // Best-effort last-seen stamp; never block the request on it.
  try {
    db.update(extensionTokens)
      .set({ lastSeenAt: new Date() })
      .where(eq(extensionTokens.token, token))
      .run();
  } catch {
    // ignore
  }
  return row.userId;
}
