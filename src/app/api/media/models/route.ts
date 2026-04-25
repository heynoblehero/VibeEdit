import { listMediaModels } from "@/lib/server/media-providers/models";

export const runtime = "nodejs";

export async function GET() {
  return Response.json({ models: listMediaModels() });
}
