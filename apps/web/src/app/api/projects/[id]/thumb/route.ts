import { existsSync, readFileSync } from "node:fs";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { requireServerSession } from "@/lib/server-session";
import { projectThumbPath } from "@/lib/storage/fs";

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
