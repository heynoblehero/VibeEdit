import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { requireServerSession } from "@/lib/server-session";
import { listAssets } from "@/lib/storage/fs";
import { ensureManifest, readManifest, writeManifest } from "@/lib/storage/manifests";

async function ownedProject(userId: string, id: string) {
  return db
    .select()
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.userId, userId)))
    .get();
}

// GET — per-asset manifest summary: the chat handle (name), kind, duration, and
// the one-line understanding. Powers the asset rail so the user sees what the AI
// sees and what to call each asset in chat.
export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await requireServerSession().catch((r) => r);
  if (session instanceof Response) return session;
  const userId = session.user.id;
  const { id } = await context.params;
  if (!(await ownedProject(userId, id))) return new NextResponse("not found", { status: 404 });

  const assets = listAssets(userId, id).filter((p) => !p.includes("/.manifests/"));
  const out = [];
  for (const path of assets) {
    // ensureManifest is idempotent (no re-probe when the file is unchanged).
    const m =
      readManifest(userId, id, path) ?? (await ensureManifest(userId, id, path).catch(() => null));
    out.push({
      path,
      name: m?.name ?? path.split("/").pop(),
      kind: m?.kind ?? "other",
      durationSeconds: m?.facts.durationSeconds ?? 0,
      summary: m?.understanding?.summary ?? m?.understanding?.caption ?? null,
      analyzed: Boolean(m?.understanding?.analyzedAt),
    });
  }
  return NextResponse.json({ assets: out });
}

// PATCH — rename an asset's chat handle, add aliases, or set its summary.
export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await requireServerSession().catch((r) => r);
  if (session instanceof Response) return session;
  const userId = session.user.id;
  const { id } = await context.params;
  if (!(await ownedProject(userId, id))) return new NextResponse("not found", { status: 404 });

  const body = (await req.json().catch(() => ({}))) as {
    path?: string;
    name?: string;
    summary?: string;
    addAliases?: string[];
  };
  if (!body.path) return new NextResponse("path required", { status: 400 });
  const m = await ensureManifest(userId, id, body.path).catch(() => null);
  if (!m) return new NextResponse("asset not found", { status: 404 });
  if (body.name) m.name = body.name.trim();
  if (body.addAliases?.length) m.aliases = [...new Set([...m.aliases, ...body.addAliases])];
  if (body.summary !== undefined) m.understanding = { ...m.understanding, summary: body.summary };
  writeManifest(userId, id, m);
  return NextResponse.json({ ok: true, name: m.name });
}
