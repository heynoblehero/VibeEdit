import fs from "node:fs";
import { consumeJobOutput, getJob } from "@/lib/server/render-jobs";

export const runtime = "nodejs";
export const maxDuration = 600;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await params;
  const job = getJob(jobId);
  if (!job) {
    return Response.json({ error: "job not found" }, { status: 404 });
  }
  if (job.state === "failed") {
    return Response.json({ error: job.error ?? "render failed" }, { status: 500 });
  }
  if (job.state !== "done") {
    return Response.json({ error: `job not ready (state=${job.state})` }, { status: 409 });
  }

  const output = consumeJobOutput(jobId);
  if (!output) {
    return Response.json({ error: "output not available" }, { status: 410 });
  }

  const buffer = await fs.promises.readFile(output.path);
  fs.promises.unlink(output.path).catch(() => {});

  const contentType =
    output.extension === "webm"
      ? "video/webm"
      : output.extension === "gif"
        ? "image/gif"
        : "video/mp4";

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="vibeedit-${Date.now()}.${output.extension}"`,
      "Content-Length": String(buffer.length),
    },
  });
}
