import { NextResponse } from "next/server";
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { requireServerSession } from "@/lib/server-session";
import { readBrandKit, writeBrandKit, type BrandKitData } from "@/lib/brand-kit";

const STORAGE_ROOT = process.env.STORAGE_ROOT || resolve(process.cwd(), "storage");

export async function GET() {
  const session = await requireServerSession().catch((r) => r);
  if (session instanceof Response) return session;
  const userId = session.user.id;
  return NextResponse.json(await readBrandKit(userId));
}

export async function PATCH(req: Request) {
  const session = await requireServerSession().catch((r) => r);
  if (session instanceof Response) return session;
  const userId = session.user.id;
  const body = (await req.json()) as Partial<BrandKitData>;
  const patch: Partial<BrandKitData> = {};
  if (typeof body.primaryColor === "string") patch.primaryColor = body.primaryColor || null;
  if (typeof body.accentColor === "string") patch.accentColor = body.accentColor || null;
  if (typeof body.fontFamily === "string") patch.fontFamily = body.fontFamily || null;
  if (typeof body.channelName === "string") patch.channelName = body.channelName || null;
  if (typeof body.hostName === "string") patch.hostName = body.hostName || null;
  if (typeof body.hostDescription === "string")
    patch.hostDescription = body.hostDescription || null;
  writeBrandKit(userId, patch);
  return NextResponse.json(await readBrandKit(userId));
}

export async function POST(req: Request) {
  const session = await requireServerSession().catch((r) => r);
  if (session instanceof Response) return session;
  const userId = session.user.id;
  const form = await req.formData();
  const kind = String(form.get("kind") || ""); // "logo" | "watermark"
  const file = form.get("file");
  if (!(file instanceof File) || !["logo", "watermark"].includes(kind))
    return new NextResponse("invalid", { status: 400 });
  const ext = (file.name.split(".").pop() || "png").toLowerCase().slice(0, 5);
  const dir = join(STORAGE_ROOT, "brand-kits", userId);
  mkdirSync(dir, { recursive: true });
  const fname = `${kind}.${ext}`;
  const full = join(dir, fname);
  writeFileSync(full, Buffer.from(await file.arrayBuffer()));
  const relPath = `/api/brand-kit/file/${kind}.${ext}`;
  if (kind === "logo") writeBrandKit(userId, { logoPath: relPath });
  else writeBrandKit(userId, { watermarkPath: relPath });
  return NextResponse.json(await readBrandKit(userId));
}
