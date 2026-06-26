import { NextResponse } from "next/server";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { requireServerSession } from "@/lib/server-session";
import { personaDir } from "@/lib/storage/fs";

// Allowed image targets inside the persona dir: the locked base, or a single
// pose file. Anything else (traversal, absolute paths, other extensions) is
// rejected — the persona dir holds nothing else we want to expose.
const BASE = "base.png";
const POSE = /^poses\/[a-z0-9-]+\.png$/;

// GET ?file=base.png | poses/<label>.png — serves the character image bytes so
// the UI can render a thumbnail. Always PNG.
export async function GET(req: Request) {
  const session = await requireServerSession().catch((r) => r);
  if (session instanceof Response) return session;
  const userId = session.user.id;

  const file = new URL(req.url).searchParams.get("file") ?? "";
  if (file !== BASE && !POSE.test(file)) {
    return new NextResponse("invalid file", { status: 400 });
  }

  const full = join(personaDir(userId), file);
  if (!existsSync(full) || !statSync(full).isFile()) {
    return new NextResponse("not found", { status: 404 });
  }

  return new NextResponse(new Uint8Array(readFileSync(full)), {
    headers: {
      "content-type": "image/png",
      "cache-control": "no-store",
    },
  });
}
