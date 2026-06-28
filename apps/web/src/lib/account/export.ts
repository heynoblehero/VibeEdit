import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  brandKits,
  creatorInsights,
  messages,
  projects,
  projectSnapshots,
  renderJobs,
  subscriptions,
  supportMessages,
  supportThreads,
  usageEvents,
  user,
  userPreferences,
} from "@/lib/db/schema";
import { listFiles, readProjectText } from "@/lib/storage/fs";

/*
 * GDPR/CCPA data export — packages everything we hold for ONE user into a single
 * JSON bundle. Scoped strictly to the requesting user (every query filters on
 * userId / projectId-owned-by-user); it never reaches into another user's rows.
 *
 * Secrets are deliberately excluded: BYOK provider keys, encrypted OAuth publish
 * tokens, auth password hashes, and session tokens are NOT in the bundle.
 *
 * Project composition HTML is read off disk per project (the *.html files in the
 * project tree) so the export is self-contained and a user can take their work.
 */

// Cap embedded composition HTML so a huge project tree can't blow up the bundle.
const MAX_HTML_FILES_PER_PROJECT = 50;

export type AccountExport = {
  exportedAt: string;
  format: "vibeedit-account-export@1";
  profile: Record<string, unknown> | null;
  preferences: Record<string, unknown> | null;
  brandKit: Record<string, unknown> | null;
  subscription: Record<string, unknown> | null;
  usageSummary: { kind: string; total: number; events: number }[];
  projects: Array<Record<string, unknown> & { compositions: { path: string; html: string }[] }>;
  renderHistory: Record<string, unknown>[];
  supportThreads: Array<Record<string, unknown> & { messages: Record<string, unknown>[] }>;
  creatorInsights: Record<string, unknown>[];
};

function collectCompositions(userId: string, projectId: string): { path: string; html: string }[] {
  const out: { path: string; html: string }[] = [];
  let files: string[] = [];
  try {
    files = listFiles(userId, projectId);
  } catch {
    return out;
  }
  const htmlFiles = files.filter((f) => f.endsWith(".html")).slice(0, MAX_HTML_FILES_PER_PROJECT);
  for (const path of htmlFiles) {
    try {
      out.push({ path, html: readProjectText(userId, projectId, path) });
    } catch {
      // Skip unreadable files rather than fail the whole export.
    }
  }
  return out;
}

// Build the full export bundle for one user. Returns a plain JSON-serializable
// object. Throws only if the user does not exist.
export function buildAccountExport(userId: string): AccountExport {
  const profile = db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
      image: user.image,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    })
    .from(user)
    .where(eq(user.id, userId))
    .get();
  if (!profile) throw new Error("user not found");

  const prefs = db.select().from(userPreferences).where(eq(userPreferences.userId, userId)).get();

  const brand = db.select().from(brandKits).where(eq(brandKits.userId, userId)).get();

  const sub = db.select().from(subscriptions).where(eq(subscriptions.userId, userId)).get();

  // Usage summary — aggregate per kind (raw events can be large; summarize).
  const usageRows = db
    .select({ kind: usageEvents.kind, amount: usageEvents.amount })
    .from(usageEvents)
    .where(eq(usageEvents.userId, userId))
    .all();
  const usageMap = new Map<string, { total: number; events: number }>();
  for (const row of usageRows) {
    const entry = usageMap.get(row.kind) ?? { total: 0, events: 0 };
    entry.total += row.amount;
    entry.events += 1;
    usageMap.set(row.kind, entry);
  }
  const usageSummary = [...usageMap.entries()].map(([kind, v]) => ({
    kind,
    total: v.total,
    events: v.events,
  }));

  const userProjects = db.select().from(projects).where(eq(projects.userId, userId)).all();
  const projectsOut = userProjects.map((p) => {
    const chat = db
      .select({
        id: messages.id,
        role: messages.role,
        content: messages.content,
        createdAt: messages.createdAt,
      })
      .from(messages)
      .where(eq(messages.projectId, p.id))
      .all();
    const snapshots = db
      .select({
        id: projectSnapshots.id,
        label: projectSnapshots.label,
        renderJobId: projectSnapshots.renderJobId,
        messageId: projectSnapshots.messageId,
        html: projectSnapshots.html,
        createdAt: projectSnapshots.createdAt,
      })
      .from(projectSnapshots)
      .where(eq(projectSnapshots.projectId, p.id))
      .all();
    return {
      ...p,
      chat,
      snapshots,
      compositions: collectCompositions(userId, p.id),
    };
  });

  const renderHistory = db
    .select({
      id: renderJobs.id,
      projectId: renderJobs.projectId,
      status: renderJobs.status,
      quality: renderJobs.quality,
      fps: renderJobs.fps,
      error: renderJobs.error,
      lastError: renderJobs.lastError,
      durationSeconds: renderJobs.durationSeconds,
      showcased: renderJobs.showcased,
      publicShareSlug: renderJobs.publicShareSlug,
      createdAt: renderJobs.createdAt,
      startedAt: renderJobs.startedAt,
      finishedAt: renderJobs.finishedAt,
    })
    .from(renderJobs)
    .where(eq(renderJobs.userId, userId))
    .all();

  const threads = db.select().from(supportThreads).where(eq(supportThreads.userId, userId)).all();
  const threadsOut = threads.map((t) => ({
    ...t,
    messages: db
      .select({
        id: supportMessages.id,
        sender: supportMessages.sender,
        body: supportMessages.body,
        createdAt: supportMessages.createdAt,
      })
      .from(supportMessages)
      .where(eq(supportMessages.threadId, t.id))
      .all(),
  }));

  const insights = db
    .select()
    .from(creatorInsights)
    .where(eq(creatorInsights.userId, userId))
    .all();

  return {
    exportedAt: new Date().toISOString(),
    format: "vibeedit-account-export@1",
    profile,
    preferences: prefs ?? null,
    brandKit: brand ?? null,
    subscription: sub
      ? {
          plan: sub.plan,
          status: sub.status,
          trialEndsAt: sub.trialEndsAt,
          currentPeriodEnd: sub.currentPeriodEnd,
          cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
          renderCredits: sub.renderCredits,
          createdAt: sub.createdAt,
          // NB: Stripe/Polar customer & subscription IDs deliberately omitted.
        }
      : null,
    usageSummary,
    projects: projectsOut,
    renderHistory,
    supportThreads: threadsOut,
    creatorInsights: insights,
  };
}
