import { handleToolUpload, toolQuotaGet, type ToolConfig } from "@/lib/tools/tool-route";
import { denoiseVideo } from "@/lib/tools/free-tools";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const config: ToolConfig = {
  key: "denoise",
  accept: /\.(mp4|mov|mkv|webm|avi|m4v)$/i,
  maxDurationS: 300,
  outContentType: "video/mp4",
  outName: "cleaned-audio.mp4",
  outExt: "mp4",
  process: async ({ inputPath, outputPath }) => denoiseVideo({ inputPath, outputPath }),
};

export async function GET(req: Request) {
  return toolQuotaGet(req, config);
}
export async function POST(req: Request) {
  return handleToolUpload(req, config);
}
