import { VOICES } from "@/lib/server/voice-providers/models";

export const runtime = "nodejs";

export async function GET() {
  return Response.json(
    { voices: VOICES },
    { headers: { "Cache-Control": "public, max-age=60, s-maxage=60" } },
  );
}
