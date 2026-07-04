import { handleToolUpload, toolQuotaGet, type ToolConfig } from "@/lib/tools/tool-route";
import { extractAudio } from "@/lib/tools/free-tools";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const config: ToolConfig = {
  key: "audio",
  accept: /\.(mp4|mov|mkv|webm|avi|m4v)$/i,
  maxDurationS: 600,
  outContentType: "audio/mpeg",
  outName: "audio.mp3",
  outExt: "mp3",
  process: async ({ inputPath, outputPath }) => extractAudio({ inputPath, outputPath }),
};

export async function GET(req: Request) {
  return toolQuotaGet(req, config);
}
export async function POST(req: Request) {
  return handleToolUpload(req, config);
}
