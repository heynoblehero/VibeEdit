import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/server-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Auth: any logged-in user may ask "am I being impersonated?" — the answer only
// exposes their own session's impersonation overlay, set by an admin. Used by
// the global banner so the impersonated view shows "you are impersonating X".
export async function GET() {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ impersonating: false });

  const impersonatedBy = (session as { impersonatedBy?: { id: string; email: string } })
    .impersonatedBy;
  if (!impersonatedBy) return NextResponse.json({ impersonating: false });

  return NextResponse.json({
    impersonating: true,
    by: impersonatedBy,
    target: { id: session.user.id, email: session.user.email, name: session.user.name },
  });
}
