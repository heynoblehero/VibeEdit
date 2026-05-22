import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { renderJobs } from "@/lib/db/schema";
import { authenticateWorker } from "@/lib/worker/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
	req: Request,
	context: { params: Promise<{ id: string }> },
) {
	const auth = authenticateWorker(req);
	if (!auth) return new NextResponse("unauthorized", { status: 401 });
	const { id } = await context.params;
	const body = (await req.json()) as { progress: number };
	const progress = Math.max(0.01, Math.min(0.99, Number(body.progress) || 0));
	db.update(renderJobs)
		.set({ progress })
		.where(
			and(eq(renderJobs.id, id), eq(renderJobs.userId, auth.userId)),
		)
		.run();
	return NextResponse.json({ ok: true });
}
