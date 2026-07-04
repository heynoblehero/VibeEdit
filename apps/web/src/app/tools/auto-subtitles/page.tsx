import type { Metadata } from "next";
import { ToolPageShell } from "@/components/tools/ToolPageShell";
import { FileTool, type FileToolConfig } from "@/components/tools/FileTool";

export const metadata: Metadata = {
  title: "Free Auto Subtitle Generator — Burn AI Captions Into Video | VibeEdit",
  description:
    "Auto-generate captions for your video with AI and burn them straight in — accurate, word-timed, bold and readable. Free with a quick sign-up.",
  alternates: { canonical: "/tools/auto-subtitles" },
  openGraph: {
    title: "Free Auto Subtitle Generator — VibeEdit",
    description: "AI-transcribed captions, burned straight into your video. Free with sign-up.",
    type: "website",
    url: "/tools/auto-subtitles",
    siteName: "VibeEdit",
  },
};

const config: FileToolConfig = {
  endpoint: "/api/tools/auto-subtitles",
  accept: "video/*,.mp4,.mov,.mkv,.webm,.avi,.m4v",
  hint: "mp4 / mov / mkv / webm · needs clear speech · up to 100 MB · 2 min · sign-in required",
  submitLabel: "Generate subtitles",
  busyLabel: "Transcribing & burning…",
  outputKind: "video",
  downloadName: "subtitled.mp4",
  downloadLabel: "Download subtitled video",
};

export default function AutoSubtitlesPage() {
  return (
    <ToolPageShell
      title="Auto Subtitle Generator"
      subtitle="AI transcribes your clip and burns in bold, word-timed captions — sign in free to run it."
    >
      <FileTool config={config} />
    </ToolPageShell>
  );
}
