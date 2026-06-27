"use client";

import { useEffect, useState } from "react";

/*
 * Self-contained "Monitoring" section for the admin console. Fetches its own
 * data from /api/admin/analytics (PostHog funnel) and /api/admin/errors
 * (Sentry issues). Always renders deep-link buttons to the external dashboards
 * so it's useful even before the read keys are configured; when a route reports
 * configured:false it shows a tidy "connect" hint instead of data.
 *
 * Default export so the integrator can drop it into a "Monitoring" tab.
 */

type AnalyticsMetrics = {
  signups: number;
  projectsCreated: number;
  rendersStarted: number;
  rendersSucceeded: number;
  rendersFailed: number;
  activeUsers: number;
};
type AnalyticsResponse = {
  configured?: boolean;
  missing?: string[];
  metrics?: AnalyticsMetrics;
  error?: string;
  dashboardUrl?: string;
};

type SentryIssue = {
  id: string;
  title: string;
  culprit: string | null;
  count: number;
  userCount: number;
  lastSeen: string | null;
  permalink: string | null;
  level: string | null;
};
type ErrorsResponse = {
  configured?: boolean;
  missing?: string[];
  issues?: SentryIssue[];
  error?: string;
  dashboardUrl?: string;
};

const POSTHOG_FALLBACK = "https://us.posthog.com/project/88526";
const SENTRY_FALLBACK = "https://sentry.io/";

export default function ObservabilityTiles() {
  const [analytics, setAnalytics] = useState<AnalyticsResponse | null>(null);
  const [errors, setErrors] = useState<ErrorsResponse | null>(null);
  const [analyticsFetchError, setAnalyticsFetchError] = useState(false);
  const [errorsFetchError, setErrorsFetchError] = useState(false);

  useEffect(() => {
    fetch("/api/admin/analytics")
      .then((r) => r.json())
      .then((v: AnalyticsResponse) => setAnalytics(v))
      .catch(() => setAnalyticsFetchError(true));

    fetch("/api/admin/errors")
      .then((r) => r.json())
      .then((v: ErrorsResponse) => setErrors(v))
      .catch(() => setErrorsFetchError(true));
  }, []);

  const posthogUrl = analytics?.dashboardUrl || POSTHOG_FALLBACK;
  const sentryUrl = errors?.dashboardUrl || SENTRY_FALLBACK;

  return (
    <div className="space-y-6">
      {/* PostHog funnel */}
      <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-[var(--color-fg-muted)]">
            <ChartIcon /> Product funnel · 7 days
          </h2>
          <DeepLink href={posthogUrl} label="Open PostHog" />
        </div>
        <AnalyticsBody data={analytics} fetchError={analyticsFetchError} />
      </section>

      {/* Sentry issues */}
      <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-[var(--color-fg-muted)]">
            <AlertIcon /> Recent errors · Sentry · 24h
          </h2>
          <DeepLink href={sentryUrl} label="Open Sentry" />
        </div>
        <ErrorsBody data={errors} fetchError={errorsFetchError} />
      </section>
    </div>
  );
}

// ── PostHog body ──────────────────────────────────────────────────────────

function AnalyticsBody({
  data,
  fetchError,
}: {
  data: AnalyticsResponse | null;
  fetchError: boolean;
}) {
  if (fetchError) return <Hint>Couldn’t reach the analytics endpoint. Try reloading.</Hint>;
  if (!data) return <Loading />;
  if (data.configured === false) {
    return (
      <ConnectHint
        what="PostHog"
        envVars={data.missing?.length ? data.missing : ["POSTHOG_PERSONAL_API_KEY"]}
      />
    );
  }
  if (data.error) return <Hint danger>PostHog read failed: {data.error}</Hint>;
  if (!data.metrics) return <Hint>No metrics returned.</Hint>;

  const m = data.metrics;
  return (
    <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
      <Metric label="Signups" value={m.signups} />
      <Metric label="Projects" value={m.projectsCreated} />
      <Metric label="Renders started" value={m.rendersStarted} />
      <Metric label="Succeeded" value={m.rendersSucceeded} tone="success" />
      <Metric
        label="Failed"
        value={m.rendersFailed}
        tone={m.rendersFailed > 0 ? "danger" : undefined}
      />
      <Metric label="Active users" value={m.activeUsers} />
    </div>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "success" | "danger";
}) {
  const color =
    tone === "success"
      ? "text-[var(--color-success)]"
      : tone === "danger"
        ? "text-[var(--color-danger)]"
        : "text-[var(--color-fg)]";
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-2)] p-3">
      <div className="text-[10px] uppercase tracking-wider text-[var(--color-fg-muted)]">
        {label}
      </div>
      <div className={`mt-1 text-2xl font-bold ${color}`}>{value.toLocaleString()}</div>
    </div>
  );
}

// ── Sentry body ─────────────────────────────────────────────────────────────

function ErrorsBody({ data, fetchError }: { data: ErrorsResponse | null; fetchError: boolean }) {
  if (fetchError) return <Hint>Couldn’t reach the errors endpoint. Try reloading.</Hint>;
  if (!data) return <Loading />;
  if (data.configured === false) {
    return (
      <ConnectHint
        what="Sentry"
        envVars={
          data.missing?.length
            ? data.missing
            : ["SENTRY_AUTH_TOKEN", "SENTRY_ORG", "SENTRY_PROJECT"]
        }
      />
    );
  }
  if (data.error) return <Hint danger>Sentry read failed: {data.error}</Hint>;

  const issues = data.issues ?? [];
  if (issues.length === 0) {
    return <p className="text-sm text-[var(--color-success)]">Clean — no unresolved issues.</p>;
  }

  return (
    <ul className="space-y-2">
      {issues.map((issue) => (
        <li
          key={issue.id}
          className="flex items-start justify-between gap-3 border-b border-[var(--color-border)] pb-2 last:border-0"
        >
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-[var(--color-fg)]">{issue.title}</div>
            {issue.culprit && (
              <div className="truncate font-mono text-[11px] text-[var(--color-fg-muted)]">
                {issue.culprit}
              </div>
            )}
            <div className="mt-0.5 text-[10px] text-[var(--color-fg-muted)]">
              {issue.count.toLocaleString()} events · {issue.userCount.toLocaleString()} users
              {issue.lastSeen ? ` · ${new Date(issue.lastSeen).toLocaleString()}` : ""}
            </div>
          </div>
          {issue.permalink && (
            <a
              href={issue.permalink}
              target="_blank"
              rel="noreferrer"
              className="shrink-0 self-center rounded-lg border border-[var(--color-border)] px-2.5 py-1 text-xs hover:bg-[var(--color-bg-2)]"
            >
              View
            </a>
          )}
        </li>
      ))}
    </ul>
  );
}

// ── Shared bits ─────────────────────────────────────────────────────────────

function ConnectHint({ what, envVars }: { what: string; envVars: string[] }) {
  return (
    <div className="rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-bg-2)] p-4 text-sm">
      <p className="text-[var(--color-fg)]">
        Connect {what} to show live data here. Set{" "}
        {envVars.map((v, i) => (
          <span key={v}>
            <code className="rounded bg-[var(--color-surface)] px-1 text-xs">{v}</code>
            {i < envVars.length - 1 ? ", " : ""}
          </span>
        ))}{" "}
        in your env.
      </p>
      <p className="mt-1 text-xs text-[var(--color-fg-muted)]">
        The deep-link button above works regardless.
      </p>
    </div>
  );
}

function Hint({ children, danger }: { children: React.ReactNode; danger?: boolean }) {
  return (
    <p
      className={`text-sm ${danger ? "text-[var(--color-danger)]" : "text-[var(--color-fg-muted)]"}`}
    >
      {children}
    </p>
  );
}

function Loading() {
  return <p className="text-sm text-[var(--color-fg-muted)]">Loading…</p>;
}

function DeepLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[var(--color-accent)] px-2.5 py-1 text-xs font-medium text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10"
    >
      {label}
      <ExternalIcon />
    </a>
  );
}

// ── Icons (SVG, no emoji) ────────────────────────────────────────────────────

function ChartIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 3v18h18" />
      <path d="M7 14l3-4 3 3 4-6" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  );
}

function ExternalIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M15 3h6v6" />
      <path d="M10 14 21 3" />
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    </svg>
  );
}
