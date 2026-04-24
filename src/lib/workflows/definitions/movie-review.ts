import { createId, type Scene } from "@/lib/scene-schema";
import type { WorkflowDefinition } from "../types";
import { splitLines, writeScript } from "../shared";

interface ImageUpload {
  url: string;
  prompt?: string;
}

export const movieReviewWorkflow: WorkflowDefinition = {
  id: "movie-review",
  name: "Movie / TV review",
  tagline: "Poster + trailer clips + rating → scripted review video.",
  icon: "Film",
  accentColor: "#f59e0b",
  defaultOrientation: "landscape",
  enabled: true,
  paid: true,
  reviewCriteria: "Focus on: clear verdict in first 3 scenes, poster visible, pacing (clips not too long), rating card readable.",
  sceneEditorTargets: ["text", "effects", "background"],

  slots: [
    {
      id: "title",
      label: "Movie / show title",
      description: "Name of the title being reviewed.",
      type: "topic",
      aiGenerator: {
        label: "Write review script",
        produces: "script",
        requires: ["title"],
        kind: "movie-script",
      },
    },
    {
      id: "poster",
      label: "Poster image",
      description: "Drop the movie poster.",
      type: "file-folder",
      accepts: ["image/*"],
    },
    {
      id: "clips",
      label: "Trailer / scene clips",
      description: "Drop short clips to show during the review.",
      type: "file-folder",
      accepts: ["video/*"],
    },
    {
      id: "rating",
      label: "Rating",
      description: "Your score (e.g. 8/10, 3.5 stars).",
      type: "topic",
      defaultValue: "8 / 10",
    },
    {
      id: "script",
      label: "Review script",
      description: "One line per scene. First line is the verdict.",
      type: "text",
      required: true,
    },
  ],

  async generate(values, ctx) {
    const lines = splitLines(String(values.script ?? ""));
    if (lines.length === 0) throw new Error("Script required");
    const title = String(values.title ?? "Review");
    const rating = String(values.rating ?? "");
    const poster = (values.poster as ImageUpload[] | undefined)?.[0];
    const clips = (values.clips as ImageUpload[] | undefined) ?? [];

    const scenes: Scene[] = lines.map((line, i) => {
      const portrait = ctx.orientation === "portrait";
      // First scene: poster + title. Last scene: rating card. Middle scenes: clips.
      const isFirst = i === 0;
      const isLast = i === lines.length - 1 && rating;
      const clipIndex = Math.max(0, i - (poster ? 1 : 0));
      const clip = !isFirst && !isLast ? clips[clipIndex % Math.max(1, clips.length)] : undefined;

      return {
        id: createId(),
        type: "text_only",
        duration: Math.max(2.8, Math.min(6, line.split(/\s+/).length / 2.5 + 1.5)),
        emphasisText: isLast ? `${rating}` : line,
        text: isFirst ? title : isLast ? line : undefined,
        emphasisSize: portrait ? 84 : 64,
        emphasisColor: isLast ? "#fbbf24" : "#ffffff",
        emphasisGlow: "rgba(0,0,0,0.8)",
        textSize: isFirst ? (portrait ? 60 : 48) : undefined,
        textColor: "#e5e5e5",
        textY: portrait ? 180 : 120,
        transition: isFirst || isLast ? "beat_flash_colored" : "none",
        transitionColor: isLast ? "#fbbf24" : "#ffffff",
        background: {
          color: "#0a0a0a",
          imageUrl: isFirst ? poster?.url : undefined,
          videoUrl: clip?.url,
          videoMuted: true,
          kenBurns: isFirst,
          vignette: 0.55,
        },
      };
    });
    return { scenes };
  },

  async runAiGenerator(generator, values, ctx) {
    if (generator.kind === "movie-script") {
      const title = String(values.title ?? "").trim();
      const rating = String(values.rating ?? "").trim();
      if (!title) throw new Error("Title required");
      const prompt = `Write a short review script for "${title}"${rating ? ` (rating: ${rating})` : ""}. 8-12 lines total. First line: bold verdict. Last line: one-sentence recommendation.`;
      return await writeScript(prompt, 10, ctx.orientation);
    }
    throw new Error(`Unsupported generator: ${generator.kind}`);
  },

  autoPipeline: {
    topicLabel: "Movie / show title",
    topicSlotId: "title",
    steps: [
      {
        label: "Write review script",
        async run(values, setValues, ctx) {
          const title = String(values.title ?? "").trim();
          if (!title) throw new Error("Title required");
          const script = await writeScript(
            `Write a 10-line review script for "${title}"`,
            10,
            ctx.orientation,
          );
          setValues({ script });
        },
      },
    ],
  },
};
