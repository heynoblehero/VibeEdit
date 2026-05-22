import { and, eq } from "drizzle-orm";
import { existsSync, statSync, createReadStream } from "node:fs";
import { resolve } from "node:path";
import { db } from "@/lib/db";
import { renderJobs } from "@/lib/db/schema";
import { requireServerSession } from "@/lib/server-session";

export const runtime = "nodejs";

const STORAGE_ROOT =
	process.env.STORAGE_ROOT || resolve(process.cwd(), "storage");
const RENDERS_ROOT = resolve(STORAGE_ROOT, "renders");

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
	if (!row || !row.outputPath) return new Response("not ready", { status: 404 });
	// Defense-in-depth: even though outputPath is set by our code, refuse to
	// serve any file outside the renders root in case it's ever stored wrong.
	const resolvedOutput = resolve(row.outputPath);
	if (!resolvedOutput.startsWith(RENDERS_ROOT))
		return new Response("not found", { status: 404 });
	if (!existsSync(resolvedOutput))
		return new Response("file missing", { status: 404 });
	const size = statSync(resolvedOutput).size;
	const nodeStream = createReadStream(resolvedOutput);
	const webStream = new ReadableStream({
		start(controller) {
			nodeStream.on("data", (chunk: Buffer | string) => {
				const buf =
					typeof chunk === "string" ? Buffer.from(chunk) : chunk;
				controller.enqueue(new Uint8Array(buf));
			});
			nodeStream.on("end", () => controller.close());
			nodeStream.on("error", (error) => controller.error(error));
		},
		cancel() {
			nodeStream.destroy();
		},
	});
	return new Response(webStream, {
		headers: {
			"content-type": "video/mp4",
			"content-length": String(size),
			"content-disposition": `attachment; filename="hyperframes-${id}.mp4"`,
		},
	});
}
