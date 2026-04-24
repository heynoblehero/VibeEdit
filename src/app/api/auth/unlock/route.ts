import type { NextRequest } from "next/server";
import { sessionFor, unlockWorkflow } from "@/lib/server/auth";

export const runtime = "nodejs";

// Stub: in production, this endpoint would validate a Stripe checkout session.
// For now, respecting env var DEMO_UNLOCK=true lets you unlock any workflow
// without actually paying. Swap the gate for `validateStripeSession(...)`.
export async function POST(request: NextRequest) {
  const cookie = request.cookies.get("vibeedit_session")?.value;
  const session = sessionFor(cookie);
  if (!session) return Response.json({ error: "not signed in" }, { status: 401 });
  const { workflowId } = (await request.json()) as { workflowId: string };
  if (!workflowId) return Response.json({ error: "workflowId required" }, { status: 400 });

  // TODO(stripe): validate checkout session id here instead of a flag.
  if (process.env.DEMO_UNLOCK !== "true") {
    return Response.json(
      { error: "payment required — set DEMO_UNLOCK=true in .env.local to unlock without Stripe" },
      { status: 402 },
    );
  }

  const user = unlockWorkflow(session.userId, workflowId);
  if (!user) return Response.json({ error: "user not found" }, { status: 404 });
  return Response.json({
    ok: true,
    unlockedWorkflows: user.unlockedWorkflows,
  });
}
