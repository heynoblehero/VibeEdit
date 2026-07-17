import { existsSync, readFileSync, statSync } from "node:fs";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { requireServerSession } from "@/lib/server-session";
import { projectThumbPath } from "@/lib/storage/fs";
import { captureProjectThumb } from "@/lib/projects/thumb";

// Capturing drives a headless browser — give it room.
export const maxDuration = 60;

export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await requireServerSession().catch((r) => r);
  if (session instanceof Response) return session;
  const userId = session.user.id;
  const { id } = await context.params;

  // Verify ownership before serving the image.
  const owned = db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.userId, userId)))
    .get();
  if (!owned) return new Response("not found", { status: 404 });

  const thumbPath = projectThumbPath(userId, id);
  if (!existsSync(thumbPath)) return new Response("not found", { status: 404 });

  const buf = readFileSync(thumbPath);
  return new Response(buf, {
    headers: {
      "content-type": "image/jpeg",
      // Revalidate every 60s — thumbnail changes each render but we don't
      // want to block page load on a cache miss for every card.
      "cache-control": "private, max-age=60, stale-while-revalidate=300",
      "content-length": String(buf.byteLength),
    },
  });
}

// Capture (or refresh) the card thumbnail from the current composition preview.
// The editor calls this when the agent finishes an edit, and once on open to
// backfill projects that have never been exported. `?ifMissing=1` skips the
// (expensive) capture when a recent thumbnail already exists.
export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await requireServerSession().catch((r) => r);
  if (session instanceof Response) return session;
  const userId = session.user.id;
  const { id } = await context.params;

  const owned = db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.userId, userId)))
    .get();
  if (!owned) return new NextResponse("not found", { status: 404 });

  if (new URL(req.url).searchParams.get("ifMissing") === "1") {
    const thumbPath = projectThumbPath(userId, id);
    // Consider a thumbnail captured within the last day "fresh enough" for a
    // backfill request, so opening a project doesn't re-shoot every time.
    if (existsSync(thumbPath)) {
      const ageMs = Date.now() - statSync(thumbPath).mtimeMs;
      if (ageMs < 24 * 60 * 60 * 1000) return NextResponse.json({ skipped: true });
    }
  }

  const ok = await captureProjectThumb(userId, id);
  return NextResponse.json({ ok });
}
