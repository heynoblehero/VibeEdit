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
    // Inject the CDN Hyperframes runtime into composition HTML so the player
    // uses the runtime adapter (not the direct-GSAP adapter). Without this,
    // the player locks onto the GSAP timeline at probe tick 1 (before the
    // 5-tick grace period that would trigger the player's own injection) and
    // audio elements are never driven.
    //
    // Must use the CDN URL — injecting the local workspace build (0.5.7)
    // against a newer CDN player causes a version mismatch where __player.getDuration
    // is never recognised, so the probe falls through to direct-timeline mode
    // and audio is silenced again.
    if (relPath === "index.html" && mime === "text/html") {
      let html = content.toString("utf-8");
      // Rewrite relative asset references (assets/…) to absolute file-API URLs
      // so they resolve correctly regardless of which document context requests
      // them. The live preview runs the composition inside the player's
      // <iframe src=…/files/index.html>; when the browser's autoplay policy
      // forces the player to mirror timed media into parent-frame <audio>
      // proxies, those proxies live in the editor document (/app/projects/<id>/)
      // and resolve a relative "assets/narration.mp3" against THAT base — a 404.
      // Absolute URLs are context-independent and fix preview audio without
      // touching the on-disk HTML (renders read the file directly, and the
      // device renderer's audio mixer passes absolute URLs through unchanged).
      const assetBase = `/api/projects/${id}/files/assets/`;
      html = html
        .replace(/(\b(?:src|href)\s*=\s*["'])(?:\.\/)?assets\//g, `$1${assetBase}`)
        .replace(/(url\(\s*["']?)(?:\.\/)?assets\//g, `$1${assetBase}`);
      if (!html.includes("hyperframe.runtime") && !html.includes("__player")) {
        const tag =
          '<script src="https://cdn.jsdelivr.net/npm/@hyperframes/core/dist/hyperframe.runtime.iife.js" crossorigin="anonymous"></script>';
        html = html.includes("<head")
          ? html.replace(/<head[^>]*>/, (m) => `${m}\n${tag}`)
          : `${tag}\n${html}`;
      }
      content = Buffer.from(html, "utf-8");
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
