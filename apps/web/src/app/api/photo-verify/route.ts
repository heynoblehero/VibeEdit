import { NextResponse } from "next/server";
import { verifyPhoto } from "@/lib/ai/providers/vision";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Cap the inbound base64 payload (~8MB base64 ≈ 6MB image). Rise sends small JPEGs;
// this just stops an oversized body from reaching the model call.
const MAX_IMAGE_CHARS = 8_000_000;

/**
 * Photo-verification endpoint for the Rise alarm app.
 *
 * Rise captures a photo for its "prove it" dismiss mission and POSTs the base64
 * image plus a free-form target ("a toothbrush"); we ask the vision model whether
 * the photo shows it and return { match, reason }. The Anthropic credential lives
 * HERE (server-side) — the client only carries a shared RISE_VERIFY_TOKEN, so no
 * model key is ever embedded in the distributed APK. Rate-limited by middleware
 * (group: verify). If RISE_VERIFY_TOKEN is unset the endpoint is disabled (503),
 * and Rise treats any non-200 as indeterminate and accepts the photo so an alarm
 * is never made un-dismissable by a server hiccup.
 */
export async function POST(req: Request) {
  const expected = process.env.RISE_VERIFY_TOKEN;
  if (!expected) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }
  if (req.headers.get("x-rise-token") !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let payload: { image?: unknown; target?: unknown; media_type?: unknown };
  try {
    payload = (await req.json()) as typeof payload;
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }

  const image = typeof payload.image === "string" ? payload.image : "";
  const target = typeof payload.target === "string" ? payload.target.trim() : "";
  const mediaType = typeof payload.media_type === "string" ? payload.media_type : "image/jpeg";
  if (!image || !target) {
    return NextResponse.json({ error: "missing_image_or_target" }, { status: 400 });
  }
  if (image.length > MAX_IMAGE_CHARS) {
    return NextResponse.json({ error: "image_too_large" }, { status: 413 });
  }

  try {
    const result = await verifyPhoto({ image, mediaType, target });
    return NextResponse.json(result);
  } catch (err) {
    // Upstream/model failure → 502. Rise reads any non-200 as indeterminate.
    return NextResponse.json(
      { error: "verify_failed", message: err instanceof Error ? err.message : "unknown" },
      { status: 502 },
    );
  }
}
