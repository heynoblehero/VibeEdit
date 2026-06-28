import { NextResponse } from "next/server";
import { requireServerSession } from "@/lib/server-session";
import { buildAccountExport } from "@/lib/account/export";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/account/export — GDPR/CCPA data export. Returns the requesting user's
// full data bundle as a downloadable JSON file. Scoped to the caller only; never
// includes secrets (BYOK keys, OAuth tokens, password hashes, session tokens).
export async function GET() {
  const session = await requireServerSession().catch((r) => r);
  if (session instanceof Response) return session;

  const bundle = buildAccountExport(session.user.id);
  const body = JSON.stringify(bundle, null, 2);
  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(body, {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="vibeedit-export-${date}.json"`,
      "cache-control": "no-store",
    },
  });
}
