import { VOICES } from "@/lib/server/voice-providers/models";

export const runtime = "nodejs";

export async function GET() {
  return Response.json({ voices: VOICES });
}
