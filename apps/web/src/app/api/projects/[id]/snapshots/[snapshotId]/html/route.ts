import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { projects, projectSnapshots } from "@/lib/db/schema";
import { requireServerSession } from "@/lib/server-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Serves a single snapshot's index.html so the chat can replay that past
// version inline. Snapshots store only the HTML (not a copy of the assets),
// so we inject a <base> that resolves the composition's relative asset URLs
// against the project's live files dir.
export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string; snapshotId: string }> },
) {
  const session = await requireServerSession().catch((r) => r);
  if (session instanceof Response) return session;
  const userId = session.user.id;
  const { id, snapshotId } = await context.params;

  const owned = db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.userId, userId)))
    .get();
  if (!owned) return new NextResponse("not found", { status: 404 });

  const snap = db
    .select({ html: projectSnapshots.html })
    .from(projectSnapshots)
    .where(and(eq(projectSnapshots.id, snapshotId), eq(projectSnapshots.projectId, id)))
    .get();
  if (!snap) return new NextResponse("not found", { status: 404 });

  const base = `<base href="/api/projects/${id}/files/">`;
  // Same runtime injection as the live files route — without it the player
  // locks onto the GSAP timeline early and audio is never driven.
  const runtimeTag =
    '<script src="https://cdn.jsdelivr.net/npm/@hyperframes/core/dist/hyperframe.runtime.iife.js" crossorigin="anonymous"></script>';
  const needsRuntime = !snap.html.includes("hyperframe.runtime") && !snap.html.includes("__player");
  const head = needsRuntime ? `${base}\n${runtimeTag}` : base;

  const html = snap.html.includes("<head")
    ? snap.html.replace(/<head[^>]*>/, (m) => `${m}\n${head}`)
    : `${head}\n${snap.html}`;

  return new NextResponse(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
