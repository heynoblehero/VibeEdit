import type { Metadata } from "next";
import { ToolPageShell } from "@/components/tools/ToolPageShell";
import { FileTool, type FileToolConfig } from "@/components/tools/FileTool";

export const metadata: Metadata = {
  title: "Free Video Compressor — Shrink Video File Size Online | VibeEdit",
  description:
    "Compress a video online for free — hit a target size for Discord, email, or the web without wrecking quality. No signup to start, no watermark, runs in seconds.",
  alternates: { canonical: "/tools/video-compressor" },
  openGraph: {
    title: "Free Video Compressor — VibeEdit",
    description: "Shrink your video to a target size for Discord, email, or the web. Free, online.",
    type: "website",
    url: "/tools/video-compressor",
    siteName: "VibeEdit",
  },
};

const config: FileToolConfig = {
  endpoint: "/api/tools/video-compressor",
  accept: "video/*,.mp4,.mov,.mkv,.webm,.avi,.m4v",
  hint: "mp4 / mov / mkv / webm · up to 100 MB · 5 min",
  options: [
    {
      name: "target",
      label: "Target size",
      default: "25",
      choices: [
        { value: "10", label: "10 MB (Discord)" },
        { value: "25", label: "25 MB (email)" },
        { value: "50", label: "50 MB" },
        { value: "quality", label: "Best quality" },
      ],
    },
  ],
  submitLabel: "Compress video",
  busyLabel: "Compressing…",
  outputKind: "video",
  downloadName: "compressed.mp4",
  downloadLabel: "Download compressed video",
};

export default function VideoCompressorPage() {
  return (
    <ToolPageShell
      title="Video Compressor"
      subtitle="Shrink a video to fit Discord, email, or the web — target the exact size, keep the quality."
    >
      <FileTool config={config} />
    </ToolPageShell>
  );
}
