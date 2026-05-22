import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { requireServerSession } from "@/lib/server-session";
import { readProjectFile } from "@/lib/storage/fs";

export async function GET(
	_req: Request,
	context: { params: Promise<{ id: string; path: string[] }> },
) {
	const session = await requireServerSession().catch((r) => r);
	if (session instanceof Response) return session;
	const userId = session.user.id;
	const { id, path } = await context.params;
	const row = db
		.select()
		.from(projects)
		.where(and(eq(projects.id, id), eq(projects.userId, userId)))
		.get();
	if (!row) return new NextResponse("not found", { status: 404 });
	const relPath = path.join("/");
	try {
		const { content, mime } = readProjectFile(userId, id, relPath);
		return new NextResponse(new Uint8Array(content), {
			headers: {
				"content-type": mime,
				"cache-control": "no-store",
			},
		});
	} catch {
		return new NextResponse("not found", { status: 404 });
	}
}
