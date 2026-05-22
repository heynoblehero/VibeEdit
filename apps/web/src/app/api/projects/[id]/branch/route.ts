import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { cpSync, existsSync } from "node:fs";
import { and, asc, eq, lte } from "drizzle-orm";
import { db } from "@/lib/db";
import { messages, projects } from "@/lib/db/schema";
import { ensureProjectDir, projectDir } from "@/lib/storage/fs";
import { requireServerSession } from "@/lib/server-session";

export async function POST(
	req: Request,
	context: { params: Promise<{ id: string }> },
) {
	const session = await requireServerSession().catch((r) => r);
	if (session instanceof Response) return session;
	const userId = session.user.id;
	const { id } = await context.params;
	const body = (await req.json().catch(() => ({}))) as { messageId?: string };
	if (!body.messageId) {
		return NextResponse.json({ error: "messageId required" }, { status: 400 });
	}

	const source = db
		.select()
		.from(projects)
		.where(and(eq(projects.id, id), eq(projects.userId, userId)))
		.get();
	if (!source) return new NextResponse("not found", { status: 404 });

	const cutoff = db
		.select()
		.from(messages)
		.where(and(eq(messages.id, body.messageId), eq(messages.projectId, id)))
		.get();
	if (!cutoff) {
		return NextResponse.json(
			{ error: "messageId not in project" },
			{ status: 404 },
		);
	}

	const history = db
		.select()
		.from(messages)
		.where(
			and(
				eq(messages.projectId, id),
				lte(messages.createdAt, cutoff.createdAt),
			),
		)
		.orderBy(asc(messages.createdAt))
		.all();

	const newId = nanoid(10);
	const now = new Date();
	db.insert(projects)
		.values({
			id: newId,
			userId,
			name: `${source.name} (branch)`,
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

	for (const row of history) {
		db.insert(messages)
			.values({
				id: nanoid(12),
				projectId: newId,
				role: row.role,
				content: row.content,
				createdAt: row.createdAt,
			})
			.run();
	}

	return NextResponse.json({ id: newId, copiedMessages: history.length });
}
