import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { headers } from "next/headers";
import { db, schema } from "@/lib/db";
import { eq, desc } from "drizzle-orm";

// GET: List user's projects
export async function GET() {
	const session = await auth.api.getSession({ headers: await headers() });
	if (!session?.user?.id) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const projects = db
		.select()
		.from(schema.projects)
		.where(eq(schema.projects.userId, session.user.id))
		.orderBy(desc(schema.projects.updatedAt))
		.all();

	return NextResponse.json({ projects });
}

// POST: Create or update a project
export async function POST(request: NextRequest) {
	const session = await auth.api.getSession({ headers: await headers() });
	if (!session?.user?.id) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const body = await request.json();
	const { id, name, settings } = body;

	if (id) {
		// Check if project exists and belongs to user
		const existing = db
			.select()
			.from(schema.projects)
			.where(eq(schema.projects.id, id))
			.get();

		if (existing && existing.userId === session.user.id) {
			// Update
			db.update(schema.projects)
				.set({
					name: name || existing.name,
					settings: settings ? JSON.stringify(settings) : existing.settings,
					updatedAt: new Date(),
				})
				.where(eq(schema.projects.id, id))
				.run();

			return NextResponse.json({ id, updated: true });
		}
	}

	// Create new
	const projectId = id || crypto.randomUUID();
	db.insert(schema.projects)
		.values({
			id: projectId,
			userId: session.user.id,
			name: name || "Untitled Project",
			settings: settings ? JSON.stringify(settings) : null,
		})
		.run();

	return NextResponse.json({ id: projectId, created: true });
}
