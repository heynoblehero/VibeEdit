import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { headers } from "next/headers";
import { getTransactionHistory } from "@/lib/credits";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const history = getTransactionHistory(session.user.id);
  return NextResponse.json({ history });
}
