import { NextResponse } from "next/server";
import { spawn } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { projectDir } from "@/lib/storage/fs";
import { requireServerSession } from "@/lib/server-session";

// Cache thumbnails on disk next to the source asset so we generate each one
// only once. Invalidated whenever the source mtime changes.
const VIDEO_EXT = /\.(mp4|webm|mov|m4v)$/i;
const AUDIO_EXT = /\.(mp3|wav|ogg|aac|m4a)$/i;

export async function GET(
	req: Request,
	context: { params: Promise<{ id: string }> },
) {
	const session = await requireServerSession().catch((r) => r);
	if (session instanceof Response) return session;
	const userId = session.user.id;
	const { id } = await context.params;
	const path = new URL(req.url).searchParams.get("path") || "";

	if (!path || !path.startsWith("assets/")) {
		return new NextResponse("bad path", { status: 400 });
	}
	const owned = db
		.select()
		.from(projects)
		.where(and(eq(projects.id, id), eq(projects.userId, userId)))
		.get();
	if (!owned) return new NextResponse("not found", { status: 404 });

	const projectRoot = projectDir(userId, id);
	const source = join(projectRoot, path);
	if (!existsSync(source)) return new NextResponse("source missing", { status: 404 });

	const cacheDir = join(projectRoot, ".thumbs");
	const cacheFile = join(cacheDir, path.replace(/[/\\]/g, "_") + ".png");
	const sourceMtime = statSync(source).mtimeMs;
	const cacheFresh =
		existsSync(cacheFile) && statSync(cacheFile).mtimeMs >= sourceMtime;
	if (cacheFresh) {
		return new NextResponse(readFileSync(cacheFile), {
			headers: { "content-type": "image/png", "cache-control": "private, max-age=60" },
		});
	}

	mkdirSync(dirname(cacheFile), { recursive: true });

	const isVideo = VIDEO_EXT.test(path);
	const isAudio = AUDIO_EXT.test(path);
	if (!isVideo && !isAudio) {
		return new NextResponse("unsupported", { status: 415 });
	}

	const args = isVideo
		? [
				"-y",
				"-ss",
				"0",
				"-i",
				source,
				"-frames:v",
				"1",
				"-vf",
				"scale=320:-1",
				cacheFile,
			]
		: [
				"-y",
				"-i",
				source,
				"-filter_complex",
				"showwavespic=s=320x180:colors=#7d7d7d",
				"-frames:v",
				"1",
				cacheFile,
			];

	const ok = await new Promise<boolean>((resolveP) => {
		const child = spawn("ffmpeg", args, { stdio: ["ignore", "ignore", "ignore"] });
		child.on("error", () => resolveP(false));
		child.on("exit", (code) => resolveP(code === 0));
	});
	if (!ok || !existsSync(cacheFile)) {
		return new NextResponse("ffmpeg failed", { status: 500 });
	}

	return new NextResponse(readFileSync(cacheFile), {
		headers: { "content-type": "image/png", "cache-control": "private, max-age=60" },
	});
}
