import { existsSync, readFileSync } from "node:fs";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { renderJobs } from "@/lib/db/schema";
import { projectThumbPath } from "@/lib/storage/fs";

export const dynamic = "force-dynamic";

// Public thumbnail for showcase cards — no auth required.
// Only serves if the render has a publicShareSlug (is already public).
export async function GET(_req: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;

  const row = db
    .select({
      status: renderJobs.status,
      userId: renderJobs.userId,
      projectId: renderJobs.projectId,
    })
    .from(renderJobs)
    .where(eq(renderJobs.publicShareSlug, slug))
    .get();

  if (!row || row.status !== "done") {
    return new Response("not found", { status: 404 });
  }

  const thumbPath = projectThumbPath(row.userId, row.projectId);
  if (!existsSync(thumbPath)) {
    return new Response("not found", { status: 404 });
  }

  const buf = readFileSync(thumbPath);
  return new Response(buf, {
    headers: {
      "content-type": "image/jpeg",
      "cache-control": "public, max-age=300, stale-while-revalidate=600",
      "content-length": String(buf.byteLength),
    },
  });
}
