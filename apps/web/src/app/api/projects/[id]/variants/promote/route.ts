import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { requireServerSession } from "@/lib/server-session";
import { readProjectFile, writeProjectFile } from "@/lib/storage/fs";

export const runtime = "nodejs";

// Promote a chosen variant to its target path so the composition can
// reference it stably. The agent generated assets/variants/<slug>-<id>/<n>.png;
// the user picked one in the chat picker; we copy it to the target path
// (typically assets/<slug>.png) and the original variants remain on disk as
// alternates the user can swap back to later.
export async function POST(
	req: Request,
	context: { params: Promise<{ id: string }> },
) {
	const session = await requireServerSession().catch((r) => r);
	if (session instanceof Response) return session;
	const userId = session.user.id;
	const { id } = await context.params;

	const owned = db
		.select()
		.from(projects)
		.where(and(eq(projects.id, id), eq(projects.userId, userId)))
		.get();
	if (!owned) return new NextResponse("not found", { status: 404 });

	const body = (await req.json().catch(() => ({}))) as {
		variantPath?: string;
		targetPath?: string;
	};
	const variantPath = body.variantPath;
	const targetPath = body.targetPath;
	if (!variantPath || !targetPath) {
		return new NextResponse("variantPath and targetPath required", {
			status: 400,
		});
	}
	// Lock both paths to the project's assets/ directory so a malicious client
	// can't promote arbitrary files into the composition root.
	if (
		!variantPath.startsWith("assets/") ||
		!targetPath.startsWith("assets/")
	) {
		return new NextResponse("paths must be under assets/", { status: 400 });
	}
	if (variantPath.includes("..") || targetPath.includes("..")) {
		return new NextResponse("invalid path", { status: 400 });
	}

	try {
		const source = readProjectFile(userId, id, variantPath);
		writeProjectFile(userId, id, targetPath, source.content);
		return NextResponse.json({ ok: true, promoted: targetPath });
	} catch (error) {
		return new NextResponse((error as Error).message, { status: 400 });
	}
}
