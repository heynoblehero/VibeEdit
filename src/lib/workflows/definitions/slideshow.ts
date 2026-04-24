import type { Scene } from "@/lib/scene-schema";
import { createId } from "@/lib/scene-schema";
import type { WorkflowDefinition } from "../types";

interface SlideshowImage {
  url: string;
  prompt: string;
}

function splitStoryLines(story: string): string[] {
  return story
    .split(/\n+/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

export const slideshowWorkflow: WorkflowDefinition = {
  id: "slideshow",
  name: "AI image story",
  tagline: "Narrated story over AI-generated images. TikTok/Shorts-native storytime format.",
  icon: "Images",
  accentColor: "#a78bfa",
  defaultOrientation: "portrait",
  enabled: true,
  sceneEditorTargets: ["text", "background"],
  sceneActions: [
    { id: "reprompt", label: "Re-prompt image", kind: "reprompt-image" },
  ],
  slots: [
    {
      id: "topic",
      label: "Topic (optional)",
      description: "A one-line idea. Click Write to get a full story from AI.",
      type: "topic",
      aiGenerator: {
        label: "Write story",
        produces: "story",
        requires: ["topic"],
        kind: "story-from-topic",
      },
    },
    {
      id: "story",
      label: "Story",
      description: "One line = one slide. Keep lines short — like a storybook.",
      type: "text",
      required: true,
    },
    {
      id: "styleHint",
      label: "Visual style",
      description: "Applied to every image prompt. Try: anime, pixel art, oil painting, noir photo, studio ghibli.",
      type: "topic",
      defaultValue: "cinematic storybook illustration, rich colors, soft lighting",
    },
    {
      id: "images",
      label: "Images (one per story line)",
      description: "Auto-generated from each line, or upload your own.",
      type: "file-folder",
      accepts: ["image/*"],
      aiGenerator: {
        label: "Generate all images",
        produces: "images",
        requires: ["story", "styleHint"],
        kind: "images-from-story",
      },
    },
  ],

  async generate(values, ctx) {
    const story = String(values.story ?? "").trim();
    if (!story) throw new Error("Story required");

    const lines = splitStoryLines(story);
    if (lines.length === 0) throw new Error("Story has no lines");

    const images = (values.images ?? []) as SlideshowImage[];
    const portrait = ctx.orientation === "portrait";

    const scenes: Scene[] = lines.map((line, i) => {
      const img = images[i];
      const isShort = line.split(/\s+/).length <= 6;
      return {
        id: createId(),
        type: "text_only",
        duration: Math.max(2.5, Math.min(5, line.length / 25)),
        emphasisText: line,
        emphasisSize: isShort ? (portrait ? 96 : 72) : portrait ? 68 : 56,
        emphasisColor: "#ffffff",
        emphasisGlow: "rgba(0,0,0,0.65)",
        textY: portrait ? 220 : 180,
        sfxId: undefined,
        transition: "none",
        zoomPunch: 0,
        background: {
          color: "#0a0a0a",
          imageUrl: img?.url,
          kenBurns: Boolean(img?.url),
          imageOpacity: 1,
          vignette: 0.6,
        },
      };
    });

    return { scenes };
  },

  async runAiGenerator(generator, values, ctx) {
    if (generator.kind === "story-from-topic") {
      const topic = String(values.topic ?? "").trim();
      if (!topic) throw new Error("Topic required");
      const res = await fetch("/api/script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: `Write a short visual story (10-14 lines, one line per scene, punchy storybook cadence) about: ${topic}`,
          targetLines: 12,
          orientation: ctx.orientation,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `story failed (${res.status})`);
      return data.script as string;
    }

    if (generator.kind === "images-from-story") {
      const story = String(values.story ?? "").trim();
      if (!story) throw new Error("Story required before generating images");
      const lines = splitStoryLines(story);
      const styleHint = String(values.styleHint ?? "cinematic storybook illustration").trim();
      const size = ctx.orientation === "portrait" ? "1024x1536" : "1536x1024";

      const res = await fetch("/api/generate-images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompts: lines,
          size,
          styleHint,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `images failed (${res.status})`);
      return (data.images as Array<{ url: string; prompt: string }>).map((im) => ({
        url: im.url,
        prompt: im.prompt,
      }));
    }

    throw new Error(`Unsupported generator: ${generator.kind}`);
  },

  autoPipeline: {
    topicLabel: "Story topic",
    topicSlotId: "topic",
    steps: [
      {
        label: "Write story",
        async run(values, setValues, ctx) {
          const topic = String(values.topic ?? "").trim();
          if (!topic) throw new Error("Topic required");
          const res = await fetch("/api/script", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              topic: `Write a short visual story (10-14 lines, one line per scene) about: ${topic}`,
              targetLines: 12,
              orientation: ctx.orientation,
            }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error ?? "story failed");
          setValues({ story: data.script });
        },
      },
      {
        label: "Generate images",
        async run(values, setValues, ctx) {
          const story = String(values.story ?? "").trim();
          if (!story) throw new Error("Story required");
          const lines = splitStoryLines(story);
          const styleHint = String(
            values.styleHint ?? "cinematic storybook illustration",
          ).trim();
          const size = ctx.orientation === "portrait" ? "1024x1536" : "1536x1024";
          const res = await fetch("/api/generate-images", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompts: lines, size, styleHint }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error ?? "images failed");
          setValues({
            images: (data.images as Array<{ url: string; prompt: string }>).map((im) => ({
              url: im.url,
              prompt: im.prompt,
            })),
          });
        },
      },
    ],
  },

  templates: [
    {
      id: "mythology",
      name: "Greek mythology",
      description: "Dramatic retelling of a myth",
      values: {
        topic: "the fall of icarus",
        styleHint: "ancient greek oil painting, dramatic lighting, dark background",
      },
    },
    {
      id: "horror",
      name: "Horror micro-story",
      description: "Unsettling 12-line story",
      values: {
        topic: "the last lighthouse keeper",
        styleHint: "noir horror, heavy shadows, cold blue-green palette",
      },
    },
  ],
};
