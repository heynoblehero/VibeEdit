import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { subscriptions } from "@/lib/db/schema";
import { requireServerSession } from "@/lib/server-session";
import {
  getBillingHealth,
  getOrCreateSubscription,
  getRenderCredits,
  getUsage,
  getUserPlan,
} from "@/lib/billing/usage";
import { PLANS } from "@/lib/billing/plans";

export async function GET() {
  const session = await requireServerSession().catch((r) => r);
  if (session instanceof Response) return session;
  const userId = session.user.id;
  getOrCreateSubscription(userId);
  const sub = db.select().from(subscriptions).where(eq(subscriptions.userId, userId)).get();
  const plan = getUserPlan(userId);
  const renderUsed = getUsage(userId, "render");
  const chatUsed = getUsage(userId, "chat_turn");
  const renderMinutesUsed = getUsage(userId, "render_minutes");
  const health = getBillingHealth(userId);
  return NextResponse.json({
    plan,
    subscription: sub,
    // Billing-health flag for the dunning banner. pastDue === a failed renewal
    // charge; UI shows an "update payment" banner without downgrading access.
    health,
    usage: {
      renders: { used: renderUsed, limit: plan.renderLimit },
      chatTurns: { used: chatUsed, limit: plan.chatTurnLimit },
      renderMinutes: { used: renderMinutesUsed, limit: plan.renderMinuteLimit },
    },
    renderCredits: getRenderCredits(userId),
    availablePlans: Object.values(PLANS),
  });
}
