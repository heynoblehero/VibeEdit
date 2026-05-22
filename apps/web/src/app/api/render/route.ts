import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { projects, renderJobs } from "@/lib/db/schema";
import { requireServerSession } from "@/lib/server-session";
import { enqueue } from "@/lib/render/queue";
import { canRender, canUseCloudRender, recordUsage } from "@/lib/billing/usage";

export async function POST(req: Request) {
	const session = await requireServerSession().catch((r) => r);
	if (session instanceof Response) return session;
	const userId = session.user.id;
	// Email-verified gate: unverified accounts can build/preview in the editor
	// but cannot kick off a render. Resending a verification link is one click
	// away in /app/settings/account.
	if (!session.user.emailVerified) {
		return NextResponse.json(
			{
				error: "email_not_verified",
				message:
					"Verify your email before rendering. We sent a link to your inbox at signup — request a new one at /app/settings/account.",
			},
			{ status: 403 },
		);
	}
	const body = (await req.json()) as {
		projectId: string;
		fps?: number;
		quality?: "draft" | "standard" | "high";
	};
	const owned = db
		.select()
		.from(projects)
		.where(and(eq(projects.id, body.projectId), eq(projects.userId, userId)))
		.get();
	if (!owned) return new NextResponse("not found", { status: 404 });
	const gate = canRender(userId);
	if (!gate.ok) {
		return NextResponse.json(
			{
				error: "render_limit_reached",
				message: `Render limit reached for your plan (${gate.used}/${gate.limit}). Upgrade at /app/billing.`,
			},
			{ status: 402 },
		);
	}
	const cloudGate = canUseCloudRender(userId);
	if (!cloudGate.ok) {
		return NextResponse.json(
			{
				error: "cloud_render_exhausted",
				message: `You've used your free cloud render time (${cloudGate.used}/${cloudGate.limit}s). Install the local worker at /app/settings/worker to keep rendering — or upgrade your plan.`,
				used: cloudGate.used,
				limit: cloudGate.limit,
			},
			{ status: 402 },
		);
	}
	const id = await enqueue({
		userId,
		projectId: body.projectId,
		fps: body.fps,
		quality: body.quality,
	});
	recordUsage(userId, "render", 1, { jobId: id });
	return NextResponse.json({ id });
}

export async function GET(req: Request) {
	const session = await requireServerSession().catch((r) => r);
	if (session instanceof Response) return session;
	const userId = session.user.id;
	const url = new URL(req.url);
	const projectId = url.searchParams.get("projectId");
	const whereClause = projectId
		? and(eq(renderJobs.userId, userId), eq(renderJobs.projectId, projectId))
		: eq(renderJobs.userId, userId);
	const rows = db
		.select({
			id: renderJobs.id,
			projectId: renderJobs.projectId,
			status: renderJobs.status,
			progress: renderJobs.progress,
			outputPath: renderJobs.outputPath,
			error: renderJobs.error,
			fps: renderJobs.fps,
			quality: renderJobs.quality,
			createdAt: renderJobs.createdAt,
			startedAt: renderJobs.startedAt,
			finishedAt: renderJobs.finishedAt,
			publicShareSlug: renderJobs.publicShareSlug,
			projectName: projects.name,
		})
		.from(renderJobs)
		.leftJoin(projects, eq(renderJobs.projectId, projects.id))
		.where(whereClause)
		.orderBy(desc(renderJobs.createdAt))
		.limit(50)
		.all();
	return NextResponse.json({ jobs: rows });
}
