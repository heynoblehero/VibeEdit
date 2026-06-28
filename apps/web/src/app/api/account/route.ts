import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import { errorLog, renderJobs, subscriptions, user } from "@/lib/db/schema";
import { requireServerSession } from "@/lib/server-session";
import { cancelPolarSubscription } from "@/lib/billing/polar";
import { deleteUserStorage } from "@/lib/storage/fs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// DELETE /api/account — self-service account deletion (GDPR right to erasure).
// Auth: requireServerSession() — the caller can only ever delete themselves.
//
// Confirm gate: the body MUST carry an explicit confirm signal so a stray/CSRF
// request can't nuke an account — either { confirm: true } OR a confirmEmail that
// matches the caller's own email.
//
// Cascade (same approach as the admin hard-delete):
//   1. Cancel any active Polar subscription (best-effort; recorded in audit).
//   2. Delete the user row — FK graph is onDelete:"cascade", so projects,
//      renders, messages, subscriptions, api keys, etc. go with it.
//   3. Remove the user's on-disk storage tree + each render's output dir.
export async function DELETE(req: Request) {
  const session = await requireServerSession().catch((r) => r);
  if (session instanceof Response) return session;
  const userId = session.user.id;
  const email = session.user.email;

  const body = (await req.json().catch(() => null)) as {
    confirm?: boolean;
    confirmEmail?: string;
  } | null;
  const confirmed =
    body?.confirm === true ||
    (typeof body?.confirmEmail === "string" &&
      body.confirmEmail.trim().toLowerCase() === email.toLowerCase());
  if (!confirmed) {
    return new NextResponse("confirmation required", { status: 400 });
  }

  // Gather render job ids before the cascade removes them — render outputs on
  // disk are keyed by job id, so we need the list to clean them up.
  const jobIds = db
    .select({ id: renderJobs.id })
    .from(renderJobs)
    .where(eq(renderJobs.userId, userId))
    .all()
    .map((r) => r.id);

  // 1. Cancel Polar subscription (best-effort).
  const sub = db
    .select({ polarSubscriptionId: subscriptions.polarSubscriptionId })
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .get();
  const cancel = await cancelPolarSubscription(sub?.polarSubscriptionId);

  // 2. Delete the user row — FK cascade removes all dependent rows.
  db.delete(user).where(eq(user.id, userId)).run();

  // 3. Remove on-disk storage.
  deleteUserStorage(userId, jobIds);

  db.insert(errorLog)
    .values({
      id: nanoid(12),
      source: "account.self-delete",
      message: `${email} deleted their own account`,
      stack: null,
      context: JSON.stringify({
        userId,
        renderOutputsRemoved: jobIds.length,
        polarCancel: cancel,
      }),
      createdAt: new Date(),
    })
    .run();

  return NextResponse.json({ ok: true, polarCancel: cancel });
}
