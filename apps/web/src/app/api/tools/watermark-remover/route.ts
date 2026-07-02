import { mkdirSync, readFileSync, writeFileSync, existsSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { getServerSession } from "@/lib/server-session";
import {
  clientIpFrom,
  checkToolQuota,
  peekToolQuota,
  probeVideo,
  removeWatermark,
  type WatermarkCorner,
} from "@/lib/tools/free-tools";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Guardrails for an anonymous public endpoint.
const MAX_BYTES = 100 * 1024 * 1024; // 100 MB
const MAX_DURATION_S = 60;
const ANON_DAILY = 2;
const USER_DAILY = 20;
const CORNERS: WatermarkCorner[] = [
  "bottom-right",
  "bottom-left",
  "bottom-center",
  "top-right",
  "top-left",
];

// GET → how many free runs the caller has left today (for the UI).
export async function GET(req: Request) {
  const session = await getServerSession().catch(() => null);
  const key = session ? `wm:user:${session.user.id}` : `wm:ip:${clientIpFrom(req)}`;
  const limit = session ? USER_DAILY : ANON_DAILY;
  const { remaining } = peekToolQuota(key, limit);
  return Response.json({ remaining, limit, authed: !!session });
}

export async function POST(req: Request) {
  const session = await getServerSession().catch(() => null);
  const authed = !!session;
  const key = authed ? `wm:user:${session!.user.id}` : `wm:ip:${clientIpFrom(req)}`;
  const limit = authed ? USER_DAILY : ANON_DAILY;

  // Quota (reserve). Anonymous outputs get our badge; signed-in don't.
  const quota = checkToolQuota(key, limit);
  if (!quota.ok) {
    return Response.json(
      {
        error: authed
          ? `Daily limit reached (${limit}/day). Try again tomorrow.`
          : `Free limit reached (${limit}/day). Sign up free for ${USER_DAILY}/day with no badge.`,
        needsSignup: !authed,
      },
      { status: 429 },
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json({ error: "expected multipart form data" }, { status: 400 });
  }
  const file = form.get("file");
  const corner = (form.get("corner") as string) || "bottom-right";
  if (!(file instanceof File)) return Response.json({ error: "no file" }, { status: 400 });
  if (file.size > MAX_BYTES) {
    return Response.json({ error: "file too large (max 100 MB)" }, { status: 400 });
  }
  if (!/\.(mp4|mov|mkv|webm)$/i.test(file.name)) {
    return Response.json({ error: "unsupported format (mp4/mov/mkv/webm)" }, { status: 400 });
  }
  const chosenCorner = (
    CORNERS.includes(corner as WatermarkCorner) ? corner : "bottom-right"
  ) as WatermarkCorner;

  const dir = join(tmpdir(), `vibe_wm_${randomBytes(6).toString("hex")}`);
  mkdirSync(dir, { recursive: true });
  const inPath = join(dir, "in.mp4");
  const outPath = join(dir, "out.mp4");
  const cleanup = () => {
    for (const p of [inPath, outPath]) {
      try {
        if (existsSync(p)) unlinkSync(p);
      } catch {
        /* ignore */
      }
    }
  };

  try {
    writeFileSync(inPath, Buffer.from(await file.arrayBuffer()));
    const info = await probeVideo(inPath);
    if (!info.ok || info.width === 0) {
      cleanup();
      return Response.json({ error: "could not read that video" }, { status: 400 });
    }
    if (info.duration > MAX_DURATION_S + 1) {
      cleanup();
      return Response.json(
        { error: `video too long (max ${MAX_DURATION_S}s). Trim it first.` },
        { status: 400 },
      );
    }

    const result = await removeWatermark({
      inputPath: inPath,
      outputPath: outPath,
      corner: chosenCorner,
      width: info.width,
      height: info.height,
      badge: !authed, // free/anonymous tier carries the badge
    });
    if (!result.ok || !existsSync(outPath)) {
      cleanup();
      return Response.json({ error: "processing failed — try a different clip" }, { status: 500 });
    }

    const bytes = readFileSync(outPath);
    cleanup();
    return new Response(new Uint8Array(bytes), {
      headers: {
        "content-type": "video/mp4",
        "content-disposition": 'attachment; filename="cleaned.mp4"',
        "x-quota-remaining": String(quota.remaining),
      },
    });
  } catch (e) {
    cleanup();
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
