import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { fetchRecentIssues, sentryDashboardUrl } from "@/lib/admin/sentry-read";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/*
 * Auth: requireAdmin(). Recent unresolved Sentry issues for the admin tile.
 *
 * No-ops gracefully: when SENTRY_AUTH_TOKEN / SENTRY_ORG / SENTRY_PROJECT are
 * not all set, returns { configured: false, missing: [...] } with 200 so the
 * tile shows a "connect Sentry" hint instead of erroring. Upstream/transport
 * failures map to 502 with { configured: true, error }.
 */
export async function GET() {
  const admin = await requireAdmin();
  if (admin instanceof Response) return admin;

  const dashboardUrl = sentryDashboardUrl();

  try {
    const result = await fetchRecentIssues(8);
    if (!result.configured) {
      return NextResponse.json({ configured: false, missing: result.missing, dashboardUrl });
    }
    return NextResponse.json({ configured: true, issues: result.issues, dashboardUrl });
  } catch (error) {
    return NextResponse.json(
      {
        configured: true,
        error: error instanceof Error ? error.message : "Sentry read failed",
        dashboardUrl,
      },
      { status: 502 },
    );
  }
}
