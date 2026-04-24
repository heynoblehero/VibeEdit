import type { Scene } from "@/lib/scene-schema";
import {
  generateScenesFromScript,
  streamScenesFromAI,
} from "@/lib/generate-scenes";
import { STYLE_PRESETS } from "@/lib/style-presets";
import type { WorkflowDefinition } from "../types";

export const facelessWorkflow: WorkflowDefinition = {
  id: "faceless",
  name: "Faceless animation",
  tagline: "Isaac / Odd1sOut-style animated storytelling with characters, punch text, SFX.",
  icon: "Film",
  accentColor: "#34d399",
  defaultOrientation: "landscape",
  enabled: true,
  reviewCriteria:
    "Focus on: character pose variety, pacing (1.5-3.5s per scene), ALL CAPS emphasis beats, color variety across consecutive scenes, SFX coverage, transition distribution. Flag repeated character positions or colors back-to-back.",
  sceneEditorTargets: ["character", "text", "effects", "background", "counter", "broll"],

  slots: [
    {
      id: "topic",
      label: "Topic",
      description: "One-liner. Click Write to have AI draft the full script.",
      type: "topic",
      aiGenerator: {
        label: "Write script",
        produces: "script",
        requires: ["topic"],
        kind: "script-from-topic",
      },
    },
    {
      id: "script",
      label: "Script",
      description:
        "One line per scene. ALL CAPS = emphasis beat. Numbers like 10K = animated counter. Cmd/Ctrl+Enter to generate.",
      type: "text",
      required: true,
    },
    {
      id: "extendedThinking",
      label: "Deep plan",
      description: "Slower but better scene choices. Uses Claude extended thinking.",
      type: "selection",
      defaultValue: "off",
      options: [
        { value: "off", label: "Off" },
        { value: "on", label: "On — deeper plan" },
      ],
    },
    {
      id: "stylePreset",
      label: "Style preset",
      description: "Applies a visual palette + pacing preset after generation.",
      type: "selection",
      defaultValue: "",
      options: [
        { value: "", label: "None" },
        ...STYLE_PRESETS.map((p) => ({
          value: p.id,
          label: p.name,
          description: p.description,
        })),
      ],
    },
  ],

  templates: [
    {
      id: "youtube-story",
      name: "YouTube growth story",
      description: "How I got my first 1000 subs — template with 3 lines to edit.",
      values: {
        topic: "how i got my first 1000 subscribers",
        script: "i was stuck at zero\nTRIED EVERYTHING\nthen i found the secret\n1000\nsubscribers in 3 months",
      },
    },
    {
      id: "productivity-rant",
      name: "Productivity rant",
      description: "Short-form punchy advice format.",
      values: {
        topic: "stop wasting mornings",
        script: "your morning is broken\nSTOP SNOOZING\nwrite three things\ndo the hardest first\n87%\nof top performers do this",
      },
    },
  ],

  async generate(values, ctx) {
    const script = String(values.script ?? "").trim();
    if (!script) throw new Error("Script required");

    const scenes: Scene[] = [];
    try {
      await streamScenesFromAI(
        script,
        ctx.characters,
        ctx.sfx,
        ctx.orientation,
        {
          onScene: (s) => scenes.push(s),
          onDone: () => {},
          onError: (msg) => {
            throw new Error(msg);
          },
        },
        { extendedThinking: values.extendedThinking === "on" },
      );
    } catch (e) {
      if (scenes.length === 0) {
        const fallback = generateScenesFromScript(script, ctx.characters, ctx.sfx);
        return { scenes: fallback };
      }
      throw e;
    }
    if (scenes.length === 0) {
      const fallback = generateScenesFromScript(script, ctx.characters, ctx.sfx);
      return { scenes: fallback };
    }
    return { scenes };
  },

  async generateStream(values, ctx, handlers) {
    const script = String(values.script ?? "").trim();
    if (!script) throw new Error("Script required");
    try {
      await streamScenesFromAI(
        script,
        ctx.characters,
        ctx.sfx,
        ctx.orientation,
        handlers,
        { extendedThinking: values.extendedThinking === "on" },
      );
    } catch (e) {
      // Fallback — emit heuristic scenes synchronously.
      const fallback = generateScenesFromScript(script, ctx.characters, ctx.sfx);
      if (fallback.length > 0) {
        for (const s of fallback) handlers.onScene(s);
        handlers.onDone(fallback.length);
        return;
      }
      throw e;
    }
  },

  async runAiGenerator(generator, values, ctx) {
    if (generator.kind === "script-from-topic") {
      const topic = String(values.topic ?? "").trim();
      if (!topic) throw new Error("Topic required");
      const res = await fetch("/api/script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, orientation: ctx.orientation }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `script failed (${res.status})`);
      return data.script as string;
    }
    throw new Error(`Unsupported generator: ${generator.kind}`);
  },

  autoPipeline: {
    topicLabel: "Video topic",
    topicSlotId: "topic",
    steps: [
      {
        label: "Write script",
        async run(values, setValues, ctx) {
          const topic = String(values.topic ?? "").trim();
          if (!topic) throw new Error("Topic required");
          const res = await fetch("/api/script", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ topic, orientation: ctx.orientation }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error ?? `script failed (${res.status})`);
          setValues({ script: data.script });
        },
      },
    ],
  },
};
