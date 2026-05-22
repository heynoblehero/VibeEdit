import { NextResponse } from "next/server";
import { and, desc, eq, like, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { messages, projects } from "@/lib/db/schema";
import { requireServerSession } from "@/lib/server-session";

type Hit =
	| {
			kind: "project";
			projectId: string;
			projectName: string;
			updatedAt: number;
	  }
	| {
			kind: "message";
			projectId: string;
			projectName: string;
			snippet: string;
			role: string;
			createdAt: number;
	  };

const MAX_RESULTS = 20;
const SNIPPET_RADIUS = 60;

export async function GET(req: Request) {
	const session = await requireServerSession().catch((r) => r);
	if (session instanceof Response) return session;
	const userId = session.user.id;
	const q = new URL(req.url).searchParams.get("q")?.trim() || "";
	if (!q) return NextResponse.json({ hits: [] });

	const pattern = `%${q}%`;

	const projectRows = db
		.select()
		.from(projects)
		.where(and(eq(projects.userId, userId), like(projects.name, pattern)))
		.orderBy(desc(projects.updatedAt))
		.limit(MAX_RESULTS)
		.all();

	const messageRows = db
		.select({
			messageId: messages.id,
			projectId: messages.projectId,
			projectName: projects.name,
			role: messages.role,
			content: messages.content,
			createdAt: messages.createdAt,
		})
		.from(messages)
		.innerJoin(projects, eq(messages.projectId, projects.id))
		.where(
			and(
				eq(projects.userId, userId),
				or(like(messages.content, pattern), like(projects.name, pattern)),
			),
		)
		.orderBy(desc(messages.createdAt))
		.limit(MAX_RESULTS * 2)
		.all();

	const hits: Hit[] = [];
	for (const row of projectRows) {
		hits.push({
			kind: "project",
			projectId: row.id,
			projectName: row.name,
			updatedAt: row.updatedAt.getTime(),
		});
	}

	const seenProjectIds = new Set<string>();
	for (const row of messageRows) {
		const text = extractText(row.content);
		if (!text) continue;
		const idx = text.toLowerCase().indexOf(q.toLowerCase());
		if (idx === -1) continue;
		const start = Math.max(0, idx - SNIPPET_RADIUS);
		const end = Math.min(text.length, idx + q.length + SNIPPET_RADIUS);
		const snippet =
			(start > 0 ? "…" : "") +
			text.slice(start, end).replace(/\s+/g, " ").trim() +
			(end < text.length ? "…" : "");
		hits.push({
			kind: "message",
			projectId: row.projectId,
			projectName: row.projectName,
			snippet,
			role: row.role,
			createdAt: row.createdAt.getTime(),
		});
		seenProjectIds.add(row.projectId);
		if (hits.length >= MAX_RESULTS) break;
	}

	return NextResponse.json({ hits: hits.slice(0, MAX_RESULTS) });
}

function extractText(rawContent: string): string {
	try {
		const parsed = JSON.parse(rawContent) as unknown;
		if (typeof parsed === "string") return parsed;
		if (Array.isArray(parsed)) {
			return (parsed as Array<{ type?: string; text?: string }>)
				.filter((block) => block.type === "text" && block.text)
				.map((block) => block.text as string)
				.join(" ");
		}
		return "";
	} catch {
		return rawContent;
	}
}
