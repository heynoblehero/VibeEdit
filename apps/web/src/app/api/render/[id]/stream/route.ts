import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { renderJobs } from "@/lib/db/schema";
import { requireServerSession } from "@/lib/server-session";
import { onJobUpdate } from "@/lib/render/queue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await requireServerSession().catch((r) => r);
  if (session instanceof Response) return session;
  const userId = session.user.id;
  const { id } = await context.params;
  const row = db
    .select()
    .from(renderJobs)
    .where(and(eq(renderJobs.id, id), eq(renderJobs.userId, userId)))
    .get();
  if (!row) return new Response("not found", { status: 404 });

  let cleanup: (() => void) | undefined;
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      const send = (data: unknown) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          /* closed */
        }
      };
      // Initial state
      send({
        status: row.status,
        progress: row.progress,
        outputPath: row.outputPath,
        error: row.error,
      });
      if (row.status === "done" || row.status === "failed") {
        controller.close();
        return;
      }
      const keepalive = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": keepalive\n\n"));
        } catch {
          clearInterval(keepalive);
        }
      }, 25_000);
      const unsubscribe = onJobUpdate(id, (data) => {
        send(data);
        const d = data as { status?: string };
        if (d.status === "done" || d.status === "failed") {
          clearInterval(keepalive);
          try {
            controller.close();
          } catch {
            /* */
          }
        }
      });
      cleanup = () => {
        clearInterval(keepalive);
        unsubscribe();
      };
    },
    cancel() {
      cleanup?.();
    },
  });
  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-store, no-transform",
      "x-accel-buffering": "no",
    },
  });
}
