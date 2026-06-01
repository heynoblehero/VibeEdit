import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import { bugReports } from "@/lib/db/schema";
import { requireServerSession } from "@/lib/server-session";

const MAX_DESCRIPTION = 4000;
const MAX_URL = 500;

export async function POST(req: Request) {
  const session = await requireServerSession().catch(() => null);
  const userId = session && !(session instanceof Response) ? session.user.id : null;
  const body = (await req.json().catch(() => ({}))) as {
    url?: string;
    description?: string;
    userAgent?: string;
  };
  const description = (body.description || "").trim();
  if (description.length < 5) {
    return NextResponse.json({ error: "description too short" }, { status: 400 });
  }
  const id = nanoid(12);
  db.insert(bugReports)
    .values({
      id,
      userId,
      url: (body.url || "").slice(0, MAX_URL),
      description: description.slice(0, MAX_DESCRIPTION),
      userAgent: body.userAgent?.slice(0, 500) || null,
      createdAt: new Date(),
    })
    .run();
  return NextResponse.json({ id });
}
