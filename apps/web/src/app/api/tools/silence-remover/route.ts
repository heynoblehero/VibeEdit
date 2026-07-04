import { handleToolUpload, toolQuotaGet, type ToolConfig } from "@/lib/tools/tool-route";
import { removeSilence } from "@/lib/tools/free-tools";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const config: ToolConfig = {
  key: "silence",
  accept: /\.(mp4|mov|mkv|webm|avi|m4v)$/i,
  maxDurationS: 300,
  outContentType: "video/mp4",
  outName: "trimmed.mp4",
  outExt: "mp4",
  process: async ({ inputPath, outputPath, info }) =>
    removeSilence({ inputPath, outputPath, durationSeconds: info.duration }),
};

export async function GET(req: Request) {
  return toolQuotaGet(req, config);
}
export async function POST(req: Request) {
  return handleToolUpload(req, config);
}
