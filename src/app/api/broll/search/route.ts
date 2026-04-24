import type { NextRequest } from "next/server";
import { searchAllSources } from "@/lib/broll-search";

export async function POST(request: NextRequest) {
  const { query } = (await request.json()) as { query?: string };
  if (!query || typeof query !== "string") {
    return Response.json({ error: "query required" }, { status: 400 });
  }
  const bundle = await searchAllSources(query.slice(0, 200));
  return Response.json(bundle);
}
