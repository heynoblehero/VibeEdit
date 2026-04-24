import { createId, type Scene } from "@/lib/scene-schema";
import type { WorkflowDefinition } from "../types";

interface AudioUpload {
  url: string;
  name: string;
}

interface Timestamp {
  title: string;
  description?: string; // used as the "seconds" marker, e.g. "00:45-01:30"
}

function parseRange(text: string): { startSec: number; endSec: number } | null {
  const m = text.match(/(\d+):(\d+)\s*[-–]\s*(\d+):(\d+)/);
  if (!m) return null;
  const start = Number(m[1]) * 60 + Number(m[2]);
  const end = Number(m[3]) * 60 + Number(m[4]);
  if (end <= start) return null;
  return { startSec: start, endSec: end };
}

export const podcastClipsWorkflow: WorkflowDefinition = {
  id: "podcast-clips",
  name: "Podcast clip extractor",
  tagline: "Upload a podcast. Pick viral moments by timestamp. Get captioned Shorts.",
  icon: "Headphones",
  accentColor: "#f472b6",
  defaultOrientation: "portrait",
  enabled: true,
  reviewCriteria: "Focus on: clip length (15-60s ideal), hook at the start, readability of captions on vertical screens.",
  sceneEditorTargets: ["text", "background"],

  slots: [
    {
      id: "audio",
      label: "Podcast episode",
      description: "Upload audio (MP3/M4A) or paste a YouTube/podcast URL.",
      type: "file-single",
      accepts: ["audio/*"],
      required: true,
      supportsUrlImport: "audio",
      aiGenerator: {
        label: "Find viral moments",
        produces: "timestamps",
        requires: ["audio"],
        kind: "podcast-detect",
      },
    },
    {
      id: "timestamps",
      label: "Clip timestamps",
      description: "Add each viral moment as Title + 'MM:SS-MM:SS' in description.",
      type: "structured-list",
      required: true,
    },
  ],

  async runAiGenerator(generator, values) {
    if (generator.kind === "podcast-detect") {
      const audio = values.audio as { url: string } | undefined;
      if (!audio?.url) throw new Error("Upload the podcast first");
      const res = await fetch("/api/podcast/detect-moments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audioUrl: audio.url, count: 5 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `detect failed (${res.status})`);
      const moments = data.moments as Array<{
        startSec: number;
        endSec: number;
        title: string;
        reason?: string;
      }>;
      const format = (sec: number) => {
        const m = Math.floor(sec / 60);
        const s = Math.floor(sec % 60);
        return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
      };
      return moments.map((m) => ({
        title: m.title,
        description: `${format(m.startSec)}-${format(m.endSec)}${m.reason ? ` · ${m.reason}` : ""}`,
      }));
    }
    throw new Error(`Unsupported generator: ${generator.kind}`);
  },

  async generate(values) {
    const audio = (values.audio as AudioUpload | AudioUpload[] | undefined);
    const firstAudio = Array.isArray(audio) ? audio[0] : audio;
    if (!firstAudio?.url) throw new Error("Upload the podcast audio");
    const stamps = (values.timestamps as Timestamp[] | undefined) ?? [];
    if (stamps.length === 0) throw new Error("Add at least one clip timestamp");

    const scenes: Scene[] = stamps.map((stamp, i) => {
      const range = parseRange(stamp.description ?? "");
      const startSec = range?.startSec ?? i * 30;
      const endSec = range?.endSec ?? startSec + 30;
      const dur = Math.max(10, Math.min(90, endSec - startSec));
      return {
        id: createId(),
        type: "text_only",
        duration: dur,
        emphasisText: stamp.title,
        emphasisSize: 82,
        emphasisColor: "#ffffff",
        emphasisGlow: "rgba(0,0,0,0.9)",
        textY: 260,
        transition: "beat_flash",
        background: {
          color: "#1a1a1a",
          // Waveform-less MVP: use the podcast cover (if any) + a vivid vignette.
          graphic: "gradient5",
          graphicOpacity: 0.35,
          graphicY: 0,
          vignette: 0.6,
        },
        voiceover: {
          audioUrl: firstAudio.url,
          audioDurationSec: dur,
          provider: "openai",
          voice: "podcast-source",
          text: stamp.title,
        },
      };
    });
    return { scenes };
  },
};
