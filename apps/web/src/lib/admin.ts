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
