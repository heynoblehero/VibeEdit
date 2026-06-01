import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { subscriptions } from "@/lib/db/schema";
import { requireServerSession } from "@/lib/server-session";
import { getOrCreateSubscription, getUsage, getUserPlan } from "@/lib/billing/usage";
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
  return NextResponse.json({
    plan,
    subscription: sub,
    usage: {
      renders: { used: renderUsed, limit: plan.renderLimit },
      chatTurns: { used: chatUsed, limit: plan.chatTurnLimit },
    },
    availablePlans: Object.values(PLANS),
  });
}
