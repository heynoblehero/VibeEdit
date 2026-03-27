import { NextRequest, NextResponse } from "next/server";
import { getTransactionHistory } from "@/lib/credits";

export async function GET(request: NextRequest) {
  const userId = request.headers.get("x-user-id") || "anonymous";
  const history = await getTransactionHistory(userId);
  return NextResponse.json({ history });
}
