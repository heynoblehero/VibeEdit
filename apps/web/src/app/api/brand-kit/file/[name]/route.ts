import { NextResponse } from "next/server";
import { readFileSync, existsSync, statSync } from "node:fs";
import { resolve, join } from "node:path";
import { requireServerSession } from "@/lib/server-session";

const STORAGE_ROOT =
	process.env.STORAGE_ROOT || resolve(process.cwd(), "storage");

const MIMES: Record<string, string> = {
	png: "image/png",
	jpg: "image/jpeg",
	jpeg: "image/jpeg",
	svg: "image/svg+xml",
	webp: "image/webp",
	gif: "image/gif",
};

export async function GET(
	_req: Request,
	context: { params: Promise<{ name: string }> },
) {
	const session = await requireServerSession().catch((r) => r);
	if (session instanceof Response) return session;
	const userId = session.user.id;
	const { name } = await context.params;
	const safe = name.replace(/[^A-Za-z0-9._-]/g, "");
	const full = join(STORAGE_ROOT, "brand-kits", userId, safe);
	if (!existsSync(full) || !statSync(full).isFile())
		return new NextResponse("not found", { status: 404 });
	const ext = safe.split(".").pop()?.toLowerCase() || "";
	return new NextResponse(new Uint8Array(readFileSync(full)), {
		headers: {
			"content-type": MIMES[ext] || "application/octet-stream",
			"cache-control": "no-store",
		},
	});
}
