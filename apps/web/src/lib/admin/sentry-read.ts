/*
 * Sentry REST API read helper (admin observability tile).
 *
 * Reading issues requires a Sentry auth token plus the org + project slugs.
 * These are SEPARATE from the runtime DSN (which is all that's needed to *send*
 * errors). When any are missing we no-op gracefully so the admin tile can still
 * render its deep-link buttons without a 500.
 *
 * Region note: the runtime DSN is EU (`...ingest.de.sentry.io`), but the REST
 * API host is the global `https://sentry.io`. We allow a SENTRY_API_URL override
 * (e.g. https://de.sentry.io) for region flexibility.
 */

const AUTH_TOKEN = process.env.SENTRY_AUTH_TOKEN;
const ORG = process.env.SENTRY_ORG;
const PROJECT = process.env.SENTRY_PROJECT;
const API_URL = (process.env.SENTRY_API_URL || "https://sentry.io").replace(/\/+$/, "");

export type SentryIssue = {
  id: string;
  title: string;
  culprit: string | null;
  count: number;
  userCount: number;
  lastSeen: string | null;
  permalink: string | null;
  level: string | null;
};

export type SentryReadResult =
  | { configured: false; missing: string[] }
  | { configured: true; issues: SentryIssue[] };

function missingVars(): string[] {
  const missing: string[] = [];
  if (!AUTH_TOKEN) missing.push("SENTRY_AUTH_TOKEN");
  if (!ORG) missing.push("SENTRY_ORG");
  if (!PROJECT) missing.push("SENTRY_PROJECT");
  return missing;
}

/**
 * Fetch the top N recent unresolved issues for the configured project over the
 * last 24h. Returns `{ configured: false }` when read credentials are missing,
 * and throws only on an actual upstream/transport failure (caller maps to 502).
 */
export async function fetchRecentIssues(limit = 8): Promise<SentryReadResult> {
  const missing = missingVars();
  if (missing.length > 0) return { configured: false, missing };

  const url =
    `${API_URL}/api/0/projects/${encodeURIComponent(ORG as string)}/` +
    `${encodeURIComponent(PROJECT as string)}/issues/` +
    `?query=${encodeURIComponent("is:unresolved")}&statsPeriod=24h&limit=${limit}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${AUTH_TOKEN}`, Accept: "application/json" },
    // Short-lived admin read; never cache.
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Sentry API ${res.status}: ${body.slice(0, 200)}`);
  }

  const raw = (await res.json()) as Array<Record<string, unknown>>;
  const issues: SentryIssue[] = (Array.isArray(raw) ? raw : []).slice(0, limit).map((i) => ({
    id: String(i.id ?? ""),
    title: String(i.title ?? (i.metadata as { value?: string } | undefined)?.value ?? "Unknown"),
    culprit: i.culprit ? String(i.culprit) : null,
    count: Number(i.count ?? 0),
    userCount: Number(i.userCount ?? 0),
    lastSeen: i.lastSeen ? String(i.lastSeen) : null,
    permalink: i.permalink ? String(i.permalink) : null,
    level: i.level ? String(i.level) : null,
  }));

  return { configured: true, issues };
}

/** Best-effort deep link to the project's issue stream (used by the tile). */
export function sentryDashboardUrl(): string {
  if (ORG) {
    return `${API_URL}/organizations/${ORG}/issues/?query=is%3Aunresolved&statsPeriod=24h`;
  }
  return "https://sentry.io/";
}
