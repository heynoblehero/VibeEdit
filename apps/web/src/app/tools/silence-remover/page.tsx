import type { Metadata } from "next";
import { ToolPageShell } from "@/components/tools/ToolPageShell";
import { FileTool, type FileToolConfig } from "@/components/tools/FileTool";

export const metadata: Metadata = {
  title: "Free Silence Remover — Auto-Cut Dead Air From Video | VibeEdit",
  description:
    "Automatically cut silent gaps and dead air from a talking video online, free. Tighter pacing in one click — no editing. No signup to start, no watermark.",
  alternates: { canonical: "/tools/silence-remover" },
  openGraph: {
    title: "Free Silence Remover — VibeEdit",
    description: "Auto-cut dead air and long pauses to tighten up your video. Free, online.",
    type: "website",
    url: "/tools/silence-remover",
    siteName: "VibeEdit",
  },
};

const config: FileToolConfig = {
  endpoint: "/api/tools/silence-remover",
  accept: "video/*,.mp4,.mov,.mkv,.webm,.avi,.m4v",
  hint: "mp4 / mov / mkv / webm · needs an audio track · up to 100 MB · 5 min",
  submitLabel: "Remove silence",
  busyLabel: "Trimming dead air…",
  outputKind: "video",
  downloadName: "trimmed.mp4",
  downloadLabel: "Download trimmed video",
};

export default function SilenceRemoverPage() {
  return (
    <ToolPageShell
      title="Silence Remover"
      subtitle="Auto-cut dead air and long pauses from a talking clip — tighter pacing, kept in sync, in one click."
    >
      <FileTool config={config} />
    </ToolPageShell>
  );
}
