import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { rmSync } from "node:fs";
import { resolve, join } from "node:path";
import { db } from "@/lib/db";
import { user } from "@/lib/db/schema";
import { requireServerSession } from "@/lib/server-session";

const STORAGE_ROOT = process.env.STORAGE_ROOT || resolve(process.cwd(), "storage");

export async function DELETE() {
  const session = await requireServerSession().catch((r) => r);
  if (session instanceof Response) return session;
  const userId = session.user.id;
  // Drizzle cascade handles projects/messages/renderJobs/subscriptions/etc.
  db.delete(user).where(eq(user.id, userId)).run();
  // Wipe filesystem
  for (const sub of ["projects", "brand-kits"]) {
    try {
      rmSync(join(STORAGE_ROOT, sub, userId), {
        recursive: true,
        force: true,
      });
    } catch {
      /* */
    }
  }
  return NextResponse.json({ ok: true });
}
