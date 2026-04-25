import { listMediaModels } from "@/lib/server/media-providers/models";

export const runtime = "nodejs";

export async function GET() {
  return Response.json(
    { models: listMediaModels() },
    {
      headers: {
        "Cache-Control": "public, max-age=60, s-maxage=60",
      },
    },
  );
}
