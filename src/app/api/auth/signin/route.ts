import type { NextRequest } from "next/server";
import { signin } from "@/lib/server/auth";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const { email, password } = (await request.json()) as { email: string; password: string };
    const session = await signin(email, password);
    const res = Response.json({ ok: true, userEmail: email });
    res.headers.append(
      "Set-Cookie",
      `vibeedit_session=${session.token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${30 * 24 * 60 * 60}`,
    );
    return res;
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 401 },
    );
  }
}
