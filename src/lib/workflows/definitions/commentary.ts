import { createId, type Scene } from "@/lib/scene-schema";
import type { WorkflowDefinition } from "../types";
import { splitLines, writeScript } from "../shared";

interface ClipItem {
  url: string;
  name: string;
  trimStart?: number; // sec
  trimEnd?: number; // sec
  durationSec?: number;
  silenceGaps?: Array<{ startSec: number; endSec: number }>;
}

export const commentaryWorkflow: WorkflowDefinition = {
  id: "commentary",
  name: "Commentary over clips",
  tagline: "Upload footage, narrate over it. Each clip becomes a scene with your commentary overlay.",
  icon: "Mic2",
  accentColor: "#fb923c",
  defaultOrientation: "landscape",
  enabled: true,
  paid: true,
  reviewCriteria:
    "Focus on: clip-to-narration fit, pacing (don't let a clip run long without narration), line length (keep text readable at a glance), missing voiceover, repetition.",
  sceneEditorTargets: ["text", "effects", "background", "broll"],

  slots: [
    {
      id: "topic",
      label: "Topic",
      description: "What is this video about? Helps AI draft the commentary.",
      type: "topic",
      aiGenerator: {
        label: "Write script",
        produces: "script",
        requires: ["topic", "clips"],
        kind: "commentary-script",
      },
    },
    {
      id: "clips",
      label: "Source clips",
      description: "Drag in clips or paste a YouTube URL. One clip per scene, in order.",
      type: "file-folder",
      accepts: ["video/*"],
      required: true,
      supportsUrlImport: "video",
    },
    {
      id: "script",
      label: "Commentary script",
      description: "One line per clip. Each line becomes the narration for the clip at that index.",
      type: "text",
      required: true,
    },
  ],

  async generate(values, ctx) {
    const clips = (values.clips as ClipItem[] | undefined) ?? [];
    if (clips.length === 0) throw new Error("Upload at least one clip");
    const lines = splitLines(String(values.script ?? ""));
    if (lines.length === 0) throw new Error("Script required");

    // Each clip → 1+ sub-scenes. Silence gaps split a clip into contiguous
    // speech segments. Script lines are consumed in order across all segments.
    const portrait = ctx.orientation === "portrait";
    const scenes: Scene[] = [];
    let lineIdx = 0;

    clips.forEach((clip, clipIdx) => {
      const trimStart = clip.trimStart ?? 0;
      const fallbackDur =
        (lines[lineIdx]?.split(/\s+/).length ?? 8) / 2.7 + 1;
      const trimEnd =
        clip.trimEnd ?? clip.durationSec ?? trimStart + Math.max(3, fallbackDur);
      const rangeEnd = Math.max(trimStart + 0.5, trimEnd);

      const gaps = (clip.silenceGaps ?? [])
        .filter((g) => g.endSec > trimStart && g.startSec < rangeEnd)
        .map((g) => ({
          startSec: Math.max(trimStart, g.startSec),
          endSec: Math.min(rangeEnd, g.endSec),
        }))
        .sort((a, b) => a.startSec - b.startSec);

      const segments: Array<{ startSec: number; endSec: number }> = [];
      let cursor = trimStart;
      for (const gap of gaps) {
        if (gap.startSec - cursor >= 0.8) {
          segments.push({ startSec: cursor, endSec: gap.startSec });
        }
        cursor = Math.max(cursor, gap.endSec);
      }
      if (rangeEnd - cursor >= 0.8) {
        segments.push({ startSec: cursor, endSec: rangeEnd });
      }
      if (segments.length === 0) {
        segments.push({ startSec: trimStart, endSec: rangeEnd });
      }

      segments.forEach((seg, segIdx) => {
        const line = lines[lineIdx] ?? lines[lines.length - 1] ?? "";
        lineIdx++;
        const dur = Math.max(1.5, Math.min(20, seg.endSec - seg.startSec));
        scenes.push({
          id: createId(),
          type: "text_only",
          duration: dur,
          emphasisText: line,
          emphasisSize: portrait ? 64 : 52,
          emphasisColor: "#ffffff",
          emphasisGlow: "rgba(0,0,0,0.8)",
          textY: portrait ? 180 : 120,
          transition: clipIdx === 0 && segIdx === 0 ? "beat_flash" : "none",
          background: {
            color: "#000000",
            videoUrl: clip.url,
            videoStartSec: seg.startSec,
            videoMuted: true,
            vignette: 0.6,
          },
        });
      });
    });
    return { scenes };
  },

  async runAiGenerator(generator, values, ctx) {
    if (generator.kind === "commentary-script") {
      const topic = String(values.topic ?? "").trim();
      const clips = (values.clips as ClipItem[] | undefined) ?? [];
      if (!topic) throw new Error("Topic required");
      const clipCount = Math.max(3, clips.length || 8);
      const prompt = `Write a commentary script for a video about: ${topic}. Generate exactly ${clipCount} lines — one per clip. Punchy, opinionated, conversational. One line per scene.`;
      return await writeScript(prompt, clipCount, ctx.orientation);
    }
    throw new Error(`Unsupported generator: ${generator.kind}`);
  },

  autoPipeline: {
    topicLabel: "Commentary topic",
    topicSlotId: "topic",
    steps: [
      {
        label: "Write commentary",
        async run(values, setValues, ctx) {
          const topic = String(values.topic ?? "").trim();
          if (!topic) throw new Error("Topic required");
          const clips = (values.clips as ClipItem[] | undefined) ?? [];
          const count = Math.max(4, clips.length || 8);
          const script = await writeScript(
            `Write a ${count}-line commentary on: ${topic}`,
            count,
            ctx.orientation,
          );
          setValues({ script });
        },
      },
    ],
  },
};
