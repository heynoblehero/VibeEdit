import { cookies, headers } from "next/headers";
import { eq } from "drizzle-orm";
import { auth } from "./auth";
import { db } from "./db";
import { user } from "./db/schema";
import { isAdminEmail } from "./admin";
import { IMPERSONATION_COOKIE, verifyImpersonationToken } from "./admin-impersonation";

export async function getServerSession() {
  const h = await headers();
  const real = await auth.api.getSession({ headers: h });
  if (!real) return real;

  // Ban enforcement — the single chokepoint. A user an admin has banned is
  // forced out everywhere at once (not merely hidden in the UI): every route
  // funnels through getServerSession, so returning null here makes the banned
  // account behave exactly like a logged-out one. We re-read `banned` straight
  // from the DB rather than trusting the better-auth session payload, so a ban
  // takes effect on the user's very next request even on a live session.
  // Impersonation is checked *after* this: an admin's own (non-banned) real
  // session is what's evaluated, so impersonating a banned user still works for
  // debugging while the banned user themselves remains locked out.
  if (isBanned(real.user.id)) return null;

  // Admin impersonation: if a valid signed impersonation cookie is present AND
  // the real logged-in user is still an admin whose id matches the token, swap
  // the returned session's user to the target user. This makes every route that
  // calls getServerSession operate as the impersonated user transparently.
  try {
    const jar = await cookies();
    const token = jar.get(IMPERSONATION_COOKIE)?.value;
    const payload = verifyImpersonationToken(token);
    if (payload && payload.adminId === real.user.id && isAdminEmail(real.user.email)) {
      const target = db.select().from(user).where(eq(user.id, payload.targetId)).get();
      if (target) {
        return {
          ...real,
          user: { ...real.user, ...target },
          impersonatedBy: { id: real.user.id, email: real.user.email },
        };
      }
    }
  } catch {
    // Cookie parsing is best-effort; fall back to the real session.
  }

  return real;
}

/** True if the user row is flagged banned. Best-effort: any DB error → false. */
function isBanned(userId: string): boolean {
  try {
    const row = db.select({ banned: user.banned }).from(user).where(eq(user.id, userId)).get();
    return !!row?.banned;
  } catch {
    return false;
  }
}

export async function requireServerSession() {
  const s = await getServerSession();
  if (!s) throw new Response("unauthorized", { status: 401 });
  return s;
}

/**
 * The *real* logged-in session, ignoring any impersonation cookie. Admin
 * routes (start/stop impersonation, the admin console) must gate on this so an
 * admin who is currently impersonating a non-admin can still reach them.
 */
export async function getRealServerSession() {
  const h = await headers();
  return auth.api.getSession({ headers: h });
}
