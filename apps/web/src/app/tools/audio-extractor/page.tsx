import type { Metadata } from "next";
import { ToolPageShell } from "@/components/tools/ToolPageShell";
import { FileTool, type FileToolConfig } from "@/components/tools/FileTool";

export const metadata: Metadata = {
  title: "Free Audio Extractor — Video to MP3 Online | VibeEdit",
  description:
    "Extract the audio from any video as a clean MP3, free and online. Drop a clip, get the sound. No signup, no watermark.",
  alternates: { canonical: "/tools/audio-extractor" },
  openGraph: {
    title: "Free Audio Extractor — VibeEdit",
    description: "Pull a clean MP3 out of any video. Free, online, no signup.",
    type: "website",
    url: "/tools/audio-extractor",
    siteName: "VibeEdit",
  },
};

const config: FileToolConfig = {
  endpoint: "/api/tools/audio-extractor",
  accept: "video/*,.mp4,.mov,.mkv,.webm,.avi,.m4v",
  hint: "mp4 / mov / mkv / webm · up to 100 MB",
  submitLabel: "Extract audio",
  busyLabel: "Extracting…",
  outputKind: "audio",
  downloadName: "audio.mp3",
  downloadLabel: "Download MP3",
};

export default function AudioExtractorPage() {
  return (
    <ToolPageShell
      title="Audio Extractor"
      subtitle="Pull a clean MP3 out of any video — perfect for podcasts, samples, or transcripts."
    >
      <FileTool config={config} />
    </ToolPageShell>
  );
}
