import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { affiliateClicks, user } from "@/lib/db/schema";

// Public endpoint: GET /api/affiliate/track?u=<userId> records a click + redirects
// to /early so the visitor lands on the waitlist with attribution captured.
export async function GET(req: Request) {
	const url = new URL(req.url);
	const refUserId = url.searchParams.get("u");
	if (refUserId) {
		const owner = db.select().from(user).where(eq(user.id, refUserId)).get();
		if (owner) {
			db.insert(affiliateClicks)
				.values({
					id: nanoid(12),
					userId: refUserId,
					visitorIp:
						req.headers.get("x-forwarded-for")?.split(",")[0] || null,
					userAgent: req.headers.get("user-agent") || null,
					createdAt: new Date(),
				})
				.run();
		}
	}
	const dest = new URL("/early", url.origin);
	if (refUserId) dest.searchParams.set("via", refUserId.slice(0, 8));
	return NextResponse.redirect(dest);
}
