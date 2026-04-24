import { subscribe } from "@/lib/server/render-jobs";

export const runtime = "nodejs";
export const maxDuration = 600;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await params;
  const encoder = new TextEncoder();

  let unsubscribe: (() => void) | null = null;
  let closed = false;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const closeStream = () => {
        if (closed) return;
        closed = true;
        try {
          controller.close();
        } catch {
          // already closed
        }
      };

      const send = (evt: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(evt));
        } catch {
          closed = true;
          return;
        }
        if (evt.includes(`"type":"done"`) || evt.includes(`"type":"failed"`)) {
          setTimeout(closeStream, 50);
        }
      };

      unsubscribe = subscribe(jobId, send);
    },
    cancel() {
      closed = true;
      if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
