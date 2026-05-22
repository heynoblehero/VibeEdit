import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { cpSync, existsSync } from "node:fs";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { requireServerSession } from "@/lib/server-session";
import { ensureProjectDir, projectDir } from "@/lib/storage/fs";

export async function POST(
	_req: Request,
	context: { params: Promise<{ id: string }> },
) {
	const session = await requireServerSession().catch((r) => r);
	if (session instanceof Response) return session;
	const userId = session.user.id;
	const { id } = await context.params;
	const source = db
		.select()
		.from(projects)
		.where(and(eq(projects.id, id), eq(projects.userId, userId)))
		.get();
	if (!source) return new NextResponse("not found", { status: 404 });

	const newId = nanoid(10);
	const now = new Date();
	db.insert(projects)
		.values({
			id: newId,
			userId,
			name: `${source.name} (copy)`,
			createdAt: now,
			updatedAt: now,
		})
		.run();
	ensureProjectDir(userId, newId);
	const sourceDir = projectDir(userId, id);
	const destDir = projectDir(userId, newId);
	if (existsSync(sourceDir)) {
		cpSync(sourceDir, destDir, {
			recursive: true,
			filter: (path) =>
				!path.includes("node_modules") && !path.includes(".next"),
		});
	}
	return NextResponse.json({ id: newId });
}
