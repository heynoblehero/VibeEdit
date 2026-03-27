import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { headers } from "next/headers";
import { db, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";

// GET: Get a specific project
export async function GET(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	const session = await auth.api.getSession({ headers: await headers() });
	if (!session?.user?.id) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const { id } = await params;
	const project = db
		.select()
		.from(schema.projects)
		.where(
			and(
				eq(schema.projects.id, id),
				eq(schema.projects.userId, session.user.id)
			)
		)
		.get();

	if (!project) {
		return NextResponse.json({ error: "Not found" }, { status: 404 });
	}

	return NextResponse.json({ project });
}

// DELETE: Delete a project
export async function DELETE(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	const session = await auth.api.getSession({ headers: await headers() });
	if (!session?.user?.id) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const { id } = await params;
	db.delete(schema.projects)
		.where(
			and(
				eq(schema.projects.id, id),
				eq(schema.projects.userId, session.user.id)
			)
		)
		.run();

	return NextResponse.json({ deleted: true });
}
