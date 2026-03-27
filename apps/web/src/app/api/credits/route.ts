import { NextRequest, NextResponse } from "next/server";
import { getBalance } from "@/lib/credits";

export async function GET(request: NextRequest) {
  // TODO: get userId from auth session
  // For now, use a header
  const userId = request.headers.get("x-user-id") || "anonymous";
  const balance = await getBalance(userId);
  return NextResponse.json({ balance });
}
