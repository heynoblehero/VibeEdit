import type { NextRequest } from "next/server";
import { sessionFor, userById } from "@/lib/server/auth";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const cookie = request.cookies.get("vibeedit_session")?.value;
  const session = sessionFor(cookie);
  if (!session) return Response.json({ authenticated: false });
  const user = userById(session.userId);
  if (!user) return Response.json({ authenticated: false });
  return Response.json({
    authenticated: true,
    email: user.email,
    unlockedWorkflows: user.unlockedWorkflows,
  });
}

export async function DELETE(request: NextRequest) {
  const res = Response.json({ ok: true });
  res.headers.append(
    "Set-Cookie",
    `vibeedit_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`,
  );
  return res;
}
