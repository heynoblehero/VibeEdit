import { warmRemotionBundle } from "@/lib/server/remotion-bundle";

export const runtime = "nodejs";

export async function POST() {
  warmRemotionBundle();
  return Response.json({ ok: true });
}
