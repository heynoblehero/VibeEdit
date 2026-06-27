import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { fetchMetrics, posthogDashboardUrl } from "@/lib/admin/posthog-read";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/*
 * Auth: requireAdmin(). PostHog funnel metrics (last 7 days) for the admin tile.
 *
 * No-ops gracefully: when POSTHOG_PERSONAL_API_KEY is unset, returns
 * { configured: false, missing: [...] } with 200 so the tile shows a
 * "connect PostHog" hint instead of erroring. Upstream/transport failures map
 * to 502 with { configured: true, error }.
 */
export async function GET() {
  const admin = await requireAdmin();
  if (admin instanceof Response) return admin;

  const dashboardUrl = posthogDashboardUrl();

  try {
    const result = await fetchMetrics();
    if (!result.configured) {
      return NextResponse.json({ configured: false, missing: result.missing, dashboardUrl });
    }
    return NextResponse.json({ configured: true, metrics: result.metrics, dashboardUrl });
  } catch (error) {
    return NextResponse.json(
      {
        configured: true,
        error: error instanceof Error ? error.message : "PostHog read failed",
        dashboardUrl,
      },
      { status: 502 },
    );
  }
}
