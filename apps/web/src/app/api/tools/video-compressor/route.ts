import { handleToolUpload, toolQuotaGet, type ToolConfig } from "@/lib/tools/tool-route";
import { compressVideo } from "@/lib/tools/free-tools";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TARGET_MB: Record<string, number | undefined> = {
  "10": 10,
  "25": 25,
  "50": 50,
  quality: undefined, // no size target — quality preset
};

const config: ToolConfig = {
  key: "compress",
  accept: /\.(mp4|mov|mkv|webm|avi|m4v)$/i,
  maxDurationS: 300,
  outContentType: "video/mp4",
  outName: "compressed.mp4",
  outExt: "mp4",
  process: async ({ inputPath, outputPath, info, form }) => {
    const mb = TARGET_MB[String(form.get("target") ?? "25")];
    return compressVideo({
      inputPath,
      outputPath,
      durationSeconds: info.duration,
      targetBytes: mb ? mb * 1024 * 1024 : undefined,
    });
  },
};

export async function GET(req: Request) {
  return toolQuotaGet(req, config);
}
export async function POST(req: Request) {
  return handleToolUpload(req, config);
}
