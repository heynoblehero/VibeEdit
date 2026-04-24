import { createId, type Scene } from "@/lib/scene-schema";
import type { WorkflowDefinition } from "../types";
import { splitLines, writeScript } from "../shared";

interface ImageUpload {
  url: string;
  prompt?: string;
}

export const trueCrimeWorkflow: WorkflowDefinition = {
  id: "true-crime",
  name: "True crime narration",
  tagline: "Timeline + photos → chronological narrated scenes with Ken Burns.",
  icon: "Search",
  accentColor: "#64748b",
  defaultOrientation: "landscape",
  enabled: true,
  reviewCriteria:
    "Focus on: chronological order, somber pacing (avoid fast cuts), narration coverage, dates/names spelled consistently.",
  sceneEditorTargets: ["text", "background"],

  slots: [
    {
      id: "caseTitle",
      label: "Case title",
      description: "The name of the case.",
      type: "topic",
      aiGenerator: {
        label: "Write narration",
        produces: "script",
        requires: ["caseTitle"],
        kind: "true-crime-script",
      },
    },
    {
      id: "photos",
      label: "Photos (in chronological order)",
      description: "Scene / suspect / victim / map photos, ordered by timeline.",
      type: "file-folder",
      accepts: ["image/*"],
      required: true,
    },
    {
      id: "script",
      label: "Narration script",
      description: "One line per photo. Start with the inciting event, end with the verdict.",
      type: "text",
      required: true,
    },
  ],

  async generate(values, ctx) {
    const photos = (values.photos as ImageUpload[] | undefined) ?? [];
    if (photos.length === 0) throw new Error("Upload at least one photo");
    const lines = splitLines(String(values.script ?? ""));
    if (lines.length === 0) throw new Error("Script required");
    const portrait = ctx.orientation === "portrait";

    const scenes: Scene[] = lines.map((line, i) => {
      const photo = photos[i % photos.length];
      return {
        id: createId(),
        type: "text_only",
        duration: Math.max(4, Math.min(8, line.split(/\s+/).length / 2.2 + 1.5)),
        emphasisText: line,
        emphasisSize: portrait ? 58 : 42,
        emphasisColor: "#e5e5e5",
        emphasisGlow: "rgba(0,0,0,0.9)",
        textY: portrait ? 1500 : 800,
        transition: "none",
        background: {
          color: "#0a0a0a",
          imageUrl: photo?.url,
          kenBurns: true,
          imageOpacity: 0.85,
          vignette: 0.75,
        },
      };
    });
    return { scenes };
  },

  async runAiGenerator(generator, values, ctx) {
    if (generator.kind === "true-crime-script") {
      const title = String(values.caseTitle ?? "").trim();
      if (!title) throw new Error("Case title required");
      const prompt = `Write a somber true-crime narration script for the case of ${title}. 10-14 lines. Chronological. Factual. No speculation. Last line ends with the verdict or current status.`;
      return await writeScript(prompt, 12, ctx.orientation);
    }
    throw new Error(`Unsupported generator: ${generator.kind}`);
  },

  autoPipeline: {
    topicLabel: "Case name",
    topicSlotId: "caseTitle",
    steps: [
      {
        label: "Write narration",
        async run(values, setValues, ctx) {
          const title = String(values.caseTitle ?? "").trim();
          if (!title) throw new Error("Case title required");
          const script = await writeScript(
            `Write a 12-line somber true-crime narration about ${title}`,
            12,
            ctx.orientation,
          );
          setValues({ script });
        },
      },
    ],
  },
};
