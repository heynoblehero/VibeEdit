import { handleToolUpload, toolQuotaGet, type ToolConfig } from "@/lib/tools/tool-route";
import { convertVideo, type ConvertFormat } from "@/lib/tools/free-tools";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OUTPUTS: Record<string, { outExt: string; outContentType: string; outName: string }> = {
  mp4: { outExt: "mp4", outContentType: "video/mp4", outName: "converted.mp4" },
  mov: { outExt: "mov", outContentType: "video/quicktime", outName: "converted.mov" },
  webm: { outExt: "webm", outContentType: "video/webm", outName: "converted.webm" },
  gif: { outExt: "gif", outContentType: "image/gif", outName: "converted.gif" },
};

const config: ToolConfig = {
  key: "convert",
  accept: /\.(mp4|mov|mkv|webm|avi|m4v)$/i,
  maxDurationS: 60, // GIF/WebM of a long clip is heavy
  outContentType: "video/mp4",
  outName: "converted.mp4",
  outExt: "mp4",
  resolveOutput: (form) => OUTPUTS[String(form.get("format") ?? "mp4")] ?? OUTPUTS.mp4,
  process: async ({ inputPath, outputPath, form }) => {
    const format = (String(form.get("format") ?? "mp4") as ConvertFormat) || "mp4";
    return convertVideo({ inputPath, outputPath, format });
  },
};

export async function GET(req: Request) {
  return toolQuotaGet(req, config);
}
export async function POST(req: Request) {
  return handleToolUpload(req, config);
}
