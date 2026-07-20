import { statSync } from "node:fs";
import { join } from "node:path";
import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { assetKind, isNoiseAsset } from "@/lib/asset-actions";
import { db } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { requireServerSession } from "@/lib/server-session";
import { assetSource, listAssets, projectDir, readAssetMeta } from "@/lib/storage/fs";
import { getStorageStatus } from "@/lib/storage/quota";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/storage/files — a per-file breakdown of every stored asset the
// signed-in user owns, grouped by project, so the /app/storage page can let them
// browse and delete individual files to reclaim space. /api/storage gives the
// per-project totals; this drills one level deeper to the files themselves.
export async function GET() {
  const session = await requireServerSession().catch(() => null);
  if (!session || session instanceof Response) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const rows = db
    .select({
      id: projects.id,
      name: projects.name,
      updatedAt: projects.updatedAt,
    })
    .from(projects)
    .where(eq(projects.userId, userId))
    .orderBy(desc(projects.updatedAt))
    .all();

  const projectsOut = rows
    .map((row) => {
      const root = projectDir(userId, row.id);
      const meta = readAssetMeta(userId, row.id);
      const files = listAssets(userId, row.id)
        .filter((path) => !isNoiseAsset(path))
        .map((path) => {
          let bytes = 0;
          let mtimeMs = 0;
          try {
            const stat = statSync(join(root, path));
            bytes = stat.size;
            mtimeMs = stat.mtimeMs;
          } catch {
            // Skip an entry that vanished/raced between listing and stat.
            return null;
          }
          return {
            path,
            name: path.split("/").pop() ?? path,
            bytes,
            mtimeMs,
            source: assetSource(meta, path),
            kind: assetKind(path),
          };
        })
        .filter((file): file is NonNullable<typeof file> => file !== null)
        .sort((a, b) => b.bytes - a.bytes);

      const bytes = files.reduce((sum, file) => sum + file.bytes, 0);
      return {
        id: row.id,
        name: row.name,
        updatedAt: row.updatedAt,
        bytes,
        files,
      };
    })
    .filter((project) => project.files.length > 0)
    .sort((a, b) => b.bytes - a.bytes);

  const status = getStorageStatus(userId);

  return NextResponse.json({
    projects: projectsOut,
    usedBytes: status.usedBytes,
    limitBytes: status.limitBytes,
    fraction: status.fraction,
  });
}
