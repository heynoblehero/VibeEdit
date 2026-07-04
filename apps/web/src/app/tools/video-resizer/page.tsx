import type { Metadata } from "next";
import { ToolPageShell } from "@/components/tools/ToolPageShell";
import { FileTool, type FileToolConfig } from "@/components/tools/FileTool";

export const metadata: Metadata = {
  title: "Free Video Resizer — Reframe 16:9 to 9:16 / 1:1 Online | VibeEdit",
  description:
    "Reframe any video for TikTok, Reels, Shorts, or a square feed — 16:9 ↔ 9:16 ↔ 1:1 with a blurred fill, no cropping. Free, online, no signup.",
  alternates: { canonical: "/tools/video-resizer" },
  openGraph: {
    title: "Free Video Resizer / Reframer — VibeEdit",
    description: "Reframe 16:9 ↔ 9:16 ↔ 1:1 for any platform, with a blurred fill. Free, online.",
    type: "website",
    url: "/tools/video-resizer",
    siteName: "VibeEdit",
  },
};

const config: FileToolConfig = {
  endpoint: "/api/tools/video-resizer",
  accept: "video/*,.mp4,.mov,.mkv,.webm,.avi,.m4v",
  hint: "mp4 / mov / mkv / webm · up to 100 MB · 2 min",
  options: [
    {
      name: "aspect",
      label: "Reframe to",
      default: "9:16",
      choices: [
        { value: "9:16", label: "9:16 (TikTok / Reels / Shorts)" },
        { value: "1:1", label: "1:1 (Square feed)" },
        { value: "16:9", label: "16:9 (YouTube / landscape)" },
      ],
    },
  ],
  submitLabel: "Reframe video",
  busyLabel: "Reframing…",
  outputKind: "video",
  downloadName: "reframed.mp4",
  downloadLabel: "Download reframed video",
};

export default function VideoResizerPage() {
  return (
    <ToolPageShell
      title="Video Resizer / Reframer"
      subtitle="Reframe any video for TikTok, Reels, Shorts, or a square feed — with a blurred fill, no ugly cropping."
    >
      <FileTool config={config} />
    </ToolPageShell>
  );
}
