import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { subscriptions } from "@/lib/db/schema";
import { requireServerSession } from "@/lib/server-session";
import { getPolar, isPolarConfigured } from "@/lib/billing/polar";
import { logError } from "@/lib/observability/logger";

export const runtime = "nodejs";

export async function POST(_req: Request) {
  const session = await requireServerSession().catch((r) => r);
  if (session instanceof Response) return session;
  const userId = session.user.id;
  const sub = db.select().from(subscriptions).where(eq(subscriptions.userId, userId)).get();
  if (!sub?.polarCustomerId || !isPolarConfigured()) {
    return new NextResponse("no polar customer — subscribe first", {
      status: 400,
    });
  }
  try {
    const polar = getPolar();
    // Polar's customer portal is generated via a customer session token.
    // The URL handles plan changes, billing history, and cancellation.
    const portalSession = await polar.customerSessions.create({
      customerId: sub.polarCustomerId,
    });
    return NextResponse.json({ url: portalSession.customerPortalUrl });
  } catch (error) {
    logError("billing.portal", error, { userId });
    return new NextResponse("portal session failed", { status: 500 });
  }
}
