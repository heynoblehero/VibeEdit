import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { waitlistSignups } from "@/lib/db/schema";

export async function POST(req: Request) {
	const body = (await req.json().catch(() => ({}))) as {
		email?: string;
		referrer?: string;
	};
	const email = (body.email || "").trim().toLowerCase();
	if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
		return new NextResponse("invalid email", { status: 400 });
	const existing = db
		.select()
		.from(waitlistSignups)
		.where(eq(waitlistSignups.email, email))
		.get();
	if (existing) return NextResponse.json({ ok: true, already: true });
	db.insert(waitlistSignups)
		.values({
			id: nanoid(12),
			email,
			referrer: body.referrer?.slice(0, 200) || null,
			createdAt: new Date(),
		})
		.run();
	return NextResponse.json({ ok: true });
}

export async function GET() {
	// Aggregate count only — no PII exposed publicly
	const count = db.select().from(waitlistSignups).all().length;
	return NextResponse.json({ count });
}
