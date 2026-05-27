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
    let { content, mime } = readProjectFile(userId, id, relPath);
    // Inject the Hyperframes runtime into composition HTML so the player uses
    // the runtime adapter (not the direct-GSAP adapter). Without the runtime,
    // audio elements with data-start are never played in the preview.
    if (relPath === "index.html" && mime === "text/html") {
      const html = content.toString("utf-8");
      if (!html.includes("hyperframe.runtime") && !html.includes("__player")) {
        const tag = '<script src="/api/runtime/hyperframes"></script>';
        const injected = html.includes("<head")
          ? html.replace(/<head[^>]*>/, (m) => `${m}\n${tag}`)
          : `${tag}\n${html}`;
        content = Buffer.from(injected, "utf-8");
      }
    }
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
