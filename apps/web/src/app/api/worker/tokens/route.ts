import { NextResponse } from "next/server";
import { and, desc, eq, isNull } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import { workerTokens } from "@/lib/db/schema";
import { requireServerSession } from "@/lib/server-session";

export async function GET() {
	const session = await requireServerSession().catch((r) => r);
	if (session instanceof Response) return session;
	const userId = session.user.id;
	const rows = db
		.select({
			token: workerTokens.token,
			name: workerTokens.name,
			lastSeenAt: workerTokens.lastSeenAt,
			createdAt: workerTokens.createdAt,
		})
		.from(workerTokens)
		.where(
			and(eq(workerTokens.userId, userId), isNull(workerTokens.revokedAt)),
		)
		.orderBy(desc(workerTokens.createdAt))
		.all();
	// Mask token in list responses; raw token is shown only at creation time.
	// The prefix length (10) must satisfy the DELETE endpoint's min-prefix check.
	return NextResponse.json({
		tokens: rows.map((row) => ({
			...row,
			token: `${row.token.slice(0, 10)}…${row.token.slice(-4)}`,
		})),
	});
}

export async function POST(req: Request) {
	const session = await requireServerSession().catch((r) => r);
	if (session instanceof Response) return session;
	const userId = session.user.id;
	const body = (await req.json().catch(() => ({}))) as { name?: string };
	const token = `vewk_${nanoid(28)}`;
	const now = new Date();
	db.insert(workerTokens)
		.values({
			token,
			userId,
			name: body.name?.slice(0, 50) || "default",
			lastSeenAt: null,
			createdAt: now,
			revokedAt: null,
		})
		.run();
	return NextResponse.json({ token, name: body.name || "default" });
}

export async function DELETE(req: Request) {
	const session = await requireServerSession().catch((r) => r);
	if (session instanceof Response) return session;
	const userId = session.user.id;
	const url = new URL(req.url);
	const tokenPrefix = url.searchParams.get("prefix");
	if (!tokenPrefix || tokenPrefix.length < 8)
		return new NextResponse("prefix too short", { status: 400 });
	// Scope to the caller's tokens AND require an exact-prefix match. The
	// previous version returned ANY token starting with the prefix among the
	// user's tokens, but a short or accidental match could revoke the wrong
	// one. We now also require the match to be unique to be defensive.
	const candidates = db
		.select()
		.from(workerTokens)
		.where(eq(workerTokens.userId, userId))
		.all()
		.filter((row) => row.token.startsWith(tokenPrefix));
	if (candidates.length === 0)
		return new NextResponse("not found", { status: 404 });
	if (candidates.length > 1)
		return new NextResponse("ambiguous prefix", { status: 409 });
	db.update(workerTokens)
		.set({ revokedAt: new Date() })
		.where(
			and(
				eq(workerTokens.token, candidates[0].token),
				eq(workerTokens.userId, userId),
			),
		)
		.run();
	return NextResponse.json({ ok: true });
}
