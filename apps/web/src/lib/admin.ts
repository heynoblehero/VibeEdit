/*
 * Admin authorization.
 *
 * Authoritative: ADMIN_EMAILS env var (comma-separated). Falls back to
 * ADMIN_EMAIL (single value) for convenience. If neither is set, the admin
 * dashboard is locked to nobody — safer than auto-granting based on any
 * heuristic. Set ADMIN_EMAILS=you@example.com in your env to gain access.
 */

function adminList(): Set<string> {
  const raw = process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL || "";
  const set = new Set<string>();
  for (const value of raw.split(/[,\s]+/)) {
    const trimmed = value.trim().toLowerCase();
    if (trimmed) set.add(trimmed);
  }
  return set;
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return adminList().has(email.toLowerCase());
}

/*
 * Shared guard for every /api/admin route. Uses the REAL session (ignoring any
 * impersonation cookie) so an admin who is currently impersonating a user can
 * still reach the admin console and exit. Returns the real session on success,
 * or a Response (401/403) the route should return directly.
 */
export async function requireAdmin(): Promise<{ user: { id: string; email: string } } | Response> {
  // Imported lazily to avoid a server-session <-> admin import cycle.
  const { getRealServerSession } = await import("./server-session");
  const session = await getRealServerSession();
  if (!session) return new Response("unauthorized", { status: 401 });
  if (!isAdminEmail(session.user.email)) return new Response("forbidden", { status: 403 });
  return session;
}
