import type { NextRequest } from "next/server";
import { getSearchProvider } from "@/lib/server/search-providers";

export const runtime = "nodejs";
export const maxDuration = 60;

interface SearchRequest {
  query: string;
  limit?: number;
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as SearchRequest;
  if (!body.query?.trim()) {
    return Response.json({ error: "query required" }, { status: 400 });
  }
  const provider = getSearchProvider();
  try {
    const results = await provider.search(body.query, body.limit);
    return Response.json({ provider: provider.id, results });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const status = /not configured|SEARCH_PROVIDER/.test(message) ? 501 : 502;
    return Response.json(
      { error: message, provider: provider.id },
      { status },
    );
  }
}
