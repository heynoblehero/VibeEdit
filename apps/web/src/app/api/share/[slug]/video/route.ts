import { NextResponse } from "next/server";
import { existsSync, statSync, createReadStream } from "node:fs";
import { resolve } from "node:path";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { renderJobs } from "@/lib/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STORAGE_ROOT = process.env.STORAGE_ROOT || resolve(process.cwd(), "storage");
const RENDERS_ROOT = resolve(STORAGE_ROOT, "renders");

// Public MP4 fetch for share links. Looks up the render by its share slug
// (no auth required) and streams the output file if status === "done".
export async function GET(_req: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  if (!slug || slug.length < 8) {
    return new NextResponse("not found", { status: 404 });
  }
  const row = db
    .select({
      status: renderJobs.status,
      outputPath: renderJobs.outputPath,
    })
    .from(renderJobs)
    .where(eq(renderJobs.publicShareSlug, slug))
    .get();
  if (!row || row.status !== "done" || !row.outputPath) {
    return new NextResponse("not found", { status: 404 });
  }
  // Defense-in-depth: refuse to serve any file outside the renders dir, even
  // if a bad migration / DB write ever stored an absolute path elsewhere.
  const resolved = resolve(row.outputPath);
  if (!resolved.startsWith(RENDERS_ROOT)) {
    return new NextResponse("not found", { status: 404 });
  }
  if (!existsSync(resolved)) {
    return new NextResponse("file missing", { status: 410 });
  }
  const size = statSync(resolved).size;
  const nodeStream = createReadStream(resolved);
  const webStream = new ReadableStream({
    start(controller) {
      nodeStream.on("data", (chunk: Buffer | string) => {
        const buf = typeof chunk === "string" ? Buffer.from(chunk) : chunk;
        controller.enqueue(new Uint8Array(buf));
      });
      nodeStream.on("end", () => controller.close());
      nodeStream.on("error", (error) => controller.error(error));
    },
    cancel() {
      nodeStream.destroy();
    },
  });
  return new NextResponse(webStream, {
    headers: {
      "content-type": "video/mp4",
      "cache-control": "public, max-age=300",
      "content-length": String(size),
    },
  });
}
