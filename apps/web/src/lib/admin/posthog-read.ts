/*
 * PostHog Query API (HogQL) read helper (admin observability tile).
 *
 * Reading aggregates requires a PERSONAL API key (distinct from the public
 * project ingestion key used by lib/observability/posthog.ts to *send* events).
 * When the personal key is missing we no-op gracefully so the admin tile can
 * still render its deep-link button.
 *
 * Numbers returned cover the last 7 days, derived from the canonical funnel
 * event names. We avoid importing lib/observability/posthog.ts (send-side) and
 * inline the event-name constants the read query needs.
 */

const PERSONAL_KEY = process.env.POSTHOG_PERSONAL_API_KEY;
const HOST = (process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com").replace(
  /\/+$/,
  "",
);
const PROJECT_ID = process.env.POSTHOG_PROJECT_ID || "88526";

// Funnel events we count for the tile (must match lib/observability/posthog.ts FUNNEL).
const EVENTS = {
  signup: "signup",
  projectCreated: "project_created",
  renderStarted: "render_started",
  renderSucceeded: "render_succeeded",
  renderFailed: "render_failed",
} as const;

export type PosthogMetrics = {
  signups: number;
  projectsCreated: number;
  rendersStarted: number;
  rendersSucceeded: number;
  rendersFailed: number;
  activeUsers: number;
};

export type PosthogReadResult =
  | { configured: false; missing: string[] }
  | { configured: true; metrics: PosthogMetrics };

async function runHogQL(query: string): Promise<Array<[string, number]>> {
  const res = await fetch(`${HOST}/api/projects/${encodeURIComponent(PROJECT_ID)}/query/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${PERSONAL_KEY}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ query: { kind: "HogQLQuery", query } }),
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`PostHog API ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = (await res.json()) as { results?: unknown[] };
  const rows = Array.isArray(data.results) ? data.results : [];
  return rows.map((r) => {
    const tuple = r as unknown[];
    return [String(tuple[0]), Number(tuple[1] ?? 0)] as [string, number];
  });
}

/**
 * Fetch the funnel counts + active-user count over the last 7 days. Returns
 * `{ configured: false }` when the personal key is missing, and throws only on
 * an actual upstream/transport failure (caller maps to 502).
 */
export async function fetchMetrics(): Promise<PosthogReadResult> {
  if (!PERSONAL_KEY) return { configured: false, missing: ["POSTHOG_PERSONAL_API_KEY"] };

  const eventList = Object.values(EVENTS)
    .map((e) => `'${e}'`)
    .join(", ");

  // One grouped count per event over the window.
  const countsRows = await runHogQL(
    `select event, count() from events ` +
      `where timestamp > now() - interval 7 day and event in (${eventList}) ` +
      `group by event`,
  );
  const byEvent = new Map<string, number>(countsRows);

  // Distinct active users over the same window (any event).
  const activeRows = await runHogQL(
    `select 'active' as k, count(distinct person_id) from events ` +
      `where timestamp > now() - interval 7 day`,
  );
  const activeUsers = activeRows.length > 0 ? activeRows[0][1] : 0;

  return {
    configured: true,
    metrics: {
      signups: byEvent.get(EVENTS.signup) ?? 0,
      projectsCreated: byEvent.get(EVENTS.projectCreated) ?? 0,
      rendersStarted: byEvent.get(EVENTS.renderStarted) ?? 0,
      rendersSucceeded: byEvent.get(EVENTS.renderSucceeded) ?? 0,
      rendersFailed: byEvent.get(EVENTS.renderFailed) ?? 0,
      activeUsers,
    },
  };
}

/** Deep link to the PostHog project dashboard (used by the tile). */
export function posthogDashboardUrl(): string {
  // Ingestion host (e.g. us.i.posthog.com) → app host (us.posthog.com).
  const appHost = HOST.replace(/(^https:\/\/[^.]+)\.i\.posthog\.com/, "$1.posthog.com");
  return `${appHost}/project/${PROJECT_ID}`;
}
