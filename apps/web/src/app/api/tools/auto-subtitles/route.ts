import { handleToolUpload, toolQuotaGet, type ToolConfig } from "@/lib/tools/tool-route";
import { burnSubtitles } from "@/lib/tools/free-tools";
import { resolveApiKey } from "@/lib/providers/pool";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Auto-subtitles spends a real STT credit per run, so it's gated to signed-in
// users (anonDaily: 0 → anonymous callers get a "sign up free" prompt) with a
// low daily cap.
const config: ToolConfig = {
  key: "subtitles",
  accept: /\.(mp4|mov|mkv|webm|avi|m4v)$/i,
  maxDurationS: 120,
  anonDaily: 0,
  userDaily: 3,
  outContentType: "video/mp4",
  outName: "subtitled.mp4",
  outExt: "mp4",
  process: async ({ inputPath, outputPath }) => {
    const apiKey = resolveApiKey("elevenlabs", "ELEVENLABS_API_KEY");
    if (!apiKey) {
      return {
        ok: false,
        error: "subtitles are temporarily unavailable — please try again later.",
      };
    }
    return burnSubtitles({ inputPath, outputPath, apiKey });
  },
};

export async function GET(req: Request) {
  return toolQuotaGet(req, config);
}
export async function POST(req: Request) {
  return handleToolUpload(req, config);
}
