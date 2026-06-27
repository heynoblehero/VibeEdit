/*
 * Admin impersonation ("log in as user").
 *
 * Security model — no schema changes, no forgeable state:
 *   1. Only an admin (isAdminEmail on the *real* better-auth session) can mint
 *      an impersonation token. The minting endpoint re-checks this server-side.
 *   2. The token is an HMAC-SHA256-signed payload {adminId, targetId, iat}
 *      keyed by BETTER_AUTH_SECRET. A non-admin cannot forge it because they
 *      don't have the secret, and tampering invalidates the signature.
 *   3. getServerSession() honours the cookie ONLY when the *real* logged-in
 *      session still belongs to an admin AND the token's adminId matches that
 *      real user. So even a valid stolen token is useless without an admin's
 *      own auth cookie, and revoking the admin's access instantly disables it.
 *   4. Tokens expire after IMPERSONATION_TTL_MS.
 *
 * Because the swap happens inside getServerSession (the single chokepoint used
 * by every API route), impersonation transparently makes all downstream
 * routes operate as the target user — that is the whole point of "log in as".
 */

import { createHmac, timingSafeEqual } from "node:crypto";

export const IMPERSONATION_COOKIE = "vibeedit_impersonate";
// 1 hour — long enough to debug a user's account, short enough to limit blast radius.
export const IMPERSONATION_TTL_MS = 60 * 60 * 1000;

function secret(): string {
  return process.env.BETTER_AUTH_SECRET || "dev-only-secret-replace-me";
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export type ImpersonationPayload = {
  adminId: string;
  targetId: string;
  iat: number;
};

/** Mint a signed impersonation token. Caller MUST have verified admin status. */
export function mintImpersonationToken(adminId: string, targetId: string): string {
  const payload: ImpersonationPayload = { adminId, targetId, iat: Date.now() };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

/**
 * Verify a token's signature + expiry. Returns the payload or null.
 * Does NOT check that adminId is still an admin — the caller (getServerSession)
 * cross-checks against the live real session for defence in depth.
 */
export function verifyImpersonationToken(token: string | undefined): ImpersonationPayload | null {
  if (!token) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = sign(body);
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as
      | ImpersonationPayload
      | undefined;
    if (!payload || typeof payload.targetId !== "string" || typeof payload.adminId !== "string") {
      return null;
    }
    if (Date.now() - payload.iat > IMPERSONATION_TTL_MS) return null;
    return payload;
  } catch {
    return null;
  }
}
