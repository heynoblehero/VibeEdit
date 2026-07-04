import { handleToolUpload, toolQuotaGet, type ToolConfig } from "@/lib/tools/tool-route";
import { resizeVideo, type ReframeAspect } from "@/lib/tools/free-tools";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ASPECTS = new Set<ReframeAspect>(["9:16", "1:1", "16:9"]);

const config: ToolConfig = {
  key: "resize",
  accept: /\.(mp4|mov|mkv|webm|avi|m4v)$/i,
  maxDurationS: 120,
  outContentType: "video/mp4",
  outName: "reframed.mp4",
  outExt: "mp4",
  process: async ({ inputPath, outputPath, form }) => {
    const requested = String(form.get("aspect") ?? "9:16") as ReframeAspect;
    const aspect = ASPECTS.has(requested) ? requested : "9:16";
    return resizeVideo({ inputPath, outputPath, aspect });
  },
};

export async function GET(req: Request) {
  return toolQuotaGet(req, config);
}
export async function POST(req: Request) {
  return handleToolUpload(req, config);
}
