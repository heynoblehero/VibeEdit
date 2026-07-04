import type { Metadata } from "next";
import { ToolPageShell } from "@/components/tools/ToolPageShell";
import { FileTool, type FileToolConfig } from "@/components/tools/FileTool";

export const metadata: Metadata = {
  title: "Free Background Noise Remover — Clean Up Video Audio Online | VibeEdit",
  description:
    "Remove background noise, hum, and hiss from a video's audio online for free — keep the voice, lose the mess. No signup, no watermark.",
  alternates: { canonical: "/tools/background-noise-remover" },
  openGraph: {
    title: "Free Background Noise Remover — VibeEdit",
    description: "Kill background noise and keep the voice in any clip. Free, online, no signup.",
    type: "website",
    url: "/tools/background-noise-remover",
    siteName: "VibeEdit",
  },
};

const config: FileToolConfig = {
  endpoint: "/api/tools/background-noise-remover",
  accept: "video/*,.mp4,.mov,.mkv,.webm,.avi,.m4v",
  hint: "mp4 / mov / mkv / webm · up to 100 MB · 5 min",
  submitLabel: "Remove noise",
  busyLabel: "Cleaning audio…",
  outputKind: "video",
  downloadName: "cleaned-audio.mp4",
  downloadLabel: "Download cleaned video",
};

export default function BackgroundNoiseRemoverPage() {
  return (
    <ToolPageShell
      title="Background Noise Remover"
      subtitle="Strip out hum, hiss, and background noise from your clip's audio — the voice stays clean."
    >
      <FileTool config={config} />
    </ToolPageShell>
  );
}
