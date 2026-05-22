import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { renderJobs } from "@/lib/db/schema";
import { requireServerSession } from "@/lib/server-session";

export async function GET(
	_req: Request,
	context: { params: Promise<{ id: string }> },
) {
	const session = await requireServerSession().catch((r) => r);
	if (session instanceof Response) return session;
	const userId = session.user.id;
	const { id } = await context.params;
	const row = db
		.select()
		.from(renderJobs)
		.where(and(eq(renderJobs.id, id), eq(renderJobs.userId, userId)))
		.get();
	if (!row) return new NextResponse("not found", { status: 404 });
	return NextResponse.json({ job: row });
}
