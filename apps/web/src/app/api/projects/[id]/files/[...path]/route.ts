import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { requireServerSession } from "@/lib/server-session";
import { readProjectFile } from "@/lib/storage/fs";

export async function GET(
  req: Request,
  context: { params: Promise<{ id: string; path: string[] }> },
) {
  const session = await requireServerSession().catch((r) => r);
  if (session instanceof Response) return session;
  const userId = session.user.id;
  const { id, path } = await context.params;
  const row = db
    .select()
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.userId, userId)))
    .get();
  if (!row) return new NextResponse("not found", { status: 404 });
  const relPath = path.join("/");
  try {
    const { content, mime } = readProjectFile(userId, id, relPath);
    const total = content.length;
    const rangeHeader = req.headers.get("range");
    if (rangeHeader) {
      const match = rangeHeader.match(/bytes=(\d*)-(\d*)/);
      if (match) {
        const start = match[1] ? parseInt(match[1], 10) : 0;
        const end = match[2] ? parseInt(match[2], 10) : total - 1;
        const chunkEnd = Math.min(end, total - 1);
        const chunk = content.slice(start, chunkEnd + 1);
        return new NextResponse(new Uint8Array(chunk), {
          status: 206,
          headers: {
            "content-type": mime,
            "content-range": `bytes ${start}-${chunkEnd}/${total}`,
            "content-length": String(chunk.length),
            "accept-ranges": "bytes",
            "cache-control": "no-store",
          },
        });
      }
    }
    return new NextResponse(new Uint8Array(content), {
      headers: {
        "content-type": mime,
        "content-length": String(total),
        "accept-ranges": "bytes",
        "cache-control": "no-store",
      },
    });
  } catch {
    return new NextResponse("not found", { status: 404 });
  }
}
