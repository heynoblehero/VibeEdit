import type { Metadata } from "next";
import { ToolPageShell } from "@/components/tools/ToolPageShell";
import { FileTool, type FileToolConfig } from "@/components/tools/FileTool";

export const metadata: Metadata = {
  title: "Free Video Converter — MP4, MOV, WebM, GIF Online | VibeEdit",
  description:
    "Convert video between MP4, MOV, WebM, and GIF online for free. Drop a clip, pick a format, download in seconds. No signup, no watermark.",
  alternates: { canonical: "/tools/video-converter" },
  openGraph: {
    title: "Free Video Converter — VibeEdit",
    description: "Convert between MP4, MOV, WebM, and GIF in seconds. Free, online, no signup.",
    type: "website",
    url: "/tools/video-converter",
    siteName: "VibeEdit",
  },
};

const config: FileToolConfig = {
  endpoint: "/api/tools/video-converter",
  accept: "video/*,.mp4,.mov,.mkv,.webm,.avi,.m4v",
  hint: "mp4 / mov / mkv / webm · up to 100 MB · 60s",
  options: [
    {
      name: "format",
      label: "Convert to",
      default: "mp4",
      choices: [
        { value: "mp4", label: "MP4 (H.264)" },
        { value: "mov", label: "MOV" },
        { value: "webm", label: "WebM (VP9)" },
        { value: "gif", label: "GIF" },
      ],
    },
  ],
  submitLabel: "Convert",
  busyLabel: "Converting…",
  outputKind: "video",
  downloadName: "converted",
  downloadLabel: "Download converted file",
};

export default function VideoConverterPage() {
  return (
    <ToolPageShell
      title="Video Converter"
      subtitle="MP4, MOV, WebM, GIF — convert between formats in seconds, right in your browser."
    >
      <FileTool config={config} />
    </ToolPageShell>
  );
}
