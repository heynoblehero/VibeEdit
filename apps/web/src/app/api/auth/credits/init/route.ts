import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { credits, creditTransactions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

export async function POST() {
	const session = await auth.api.getSession({ headers: await headers() });
	if (!session?.user) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const existing = db
		.select()
		.from(credits)
		.where(eq(credits.userId, session.user.id))
		.get();

	if (existing) {
		return NextResponse.json({ ok: true });
	}

	db.insert(credits)
		.values({ userId: session.user.id, balance: 10 })
		.run();

	db.insert(creditTransactions)
		.values({
			userId: session.user.id,
			amount: 10,
			type: "signup",
			description: "Welcome bonus credits",
		})
		.run();

	return NextResponse.json({ ok: true });
}
