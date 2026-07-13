import { NextResponse } from "next/server";
import { and, desc, eq, isNull } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import { extensionTokens } from "@/lib/db/schema";
import { requireServerSession } from "@/lib/server-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET — list the user's active extension tokens (masked).
export async function GET() {
  const session = await requireServerSession().catch((r) => r);
  if (session instanceof Response) return session;
  const rows = db
    .select({
      token: extensionTokens.token,
      name: extensionTokens.name,
      lastSeenAt: extensionTokens.lastSeenAt,
      createdAt: extensionTokens.createdAt,
    })
    .from(extensionTokens)
    .where(and(eq(extensionTokens.userId, session.user.id), isNull(extensionTokens.revokedAt)))
    .orderBy(desc(extensionTokens.createdAt))
    .all();
  return NextResponse.json({
    tokens: rows.map((row) => ({
      ...row,
      token: `${row.token.slice(0, 10)}…${row.token.slice(-4)}`,
    })),
  });
}

// POST — mint a new token. The raw token is returned ONCE here.
export async function POST(req: Request) {
  const session = await requireServerSession().catch((r) => r);
  if (session instanceof Response) return session;
  const body = (await req.json().catch(() => ({}))) as { name?: string };
  const token = `vext_${nanoid(28)}`;
  db.insert(extensionTokens)
    .values({
      token,
      userId: session.user.id,
      name: body.name?.slice(0, 50) || "browser extension",
      lastSeenAt: null,
      createdAt: new Date(),
      revokedAt: null,
    })
    .run();
  return NextResponse.json({ token, name: body.name || "browser extension" });
}

// DELETE ?prefix=... — revoke a token by unique prefix.
export async function DELETE(req: Request) {
  const session = await requireServerSession().catch((r) => r);
  if (session instanceof Response) return session;
  const prefix = new URL(req.url).searchParams.get("prefix");
  if (!prefix || prefix.length < 8) return new NextResponse("prefix too short", { status: 400 });
  const candidates = db
    .select()
    .from(extensionTokens)
    .where(eq(extensionTokens.userId, session.user.id))
    .all()
    .filter((row) => row.token.startsWith(prefix));
  if (candidates.length === 0) return new NextResponse("not found", { status: 404 });
  if (candidates.length > 1) return new NextResponse("ambiguous prefix", { status: 409 });
  db.update(extensionTokens)
    .set({ revokedAt: new Date() })
    .where(eq(extensionTokens.token, candidates[0].token))
    .run();
  return NextResponse.json({ ok: true });
}
