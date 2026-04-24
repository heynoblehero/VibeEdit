import { createId, type Scene } from "@/lib/scene-schema";
import type { WorkflowDefinition } from "../types";
import { splitLines, writeScript } from "../shared";

interface PanelImage {
  url: string;
  prompt?: string;
}

export const comicDubWorkflow: WorkflowDefinition = {
  id: "comic-dub",
  name: "Comic dub",
  tagline: "Upload comic panels in reading order. Each panel gets a Ken Burns pan + voiceover.",
  icon: "BookOpen",
  accentColor: "#38bdf8",
  defaultOrientation: "portrait",
  enabled: true,
  reviewCriteria:
    "Focus on: dialogue fit to panel, pacing (~2-4s per panel), voiceover coverage, transition variety between panels.",
  sceneEditorTargets: ["text", "background"],

  slots: [
    {
      id: "comicTitle",
      label: "Comic title",
      description: "Name of the comic (used in AI script generation).",
      type: "topic",
    },
    {
      id: "panels",
      label: "Panels",
      description: "Panel images in reading order. One panel = one scene.",
      type: "file-folder",
      accepts: ["image/*"],
      required: true,
      aiGenerator: {
        label: "Read panels → script",
        produces: "script",
        requires: ["panels"],
        kind: "comic-ocr",
      },
    },
    {
      id: "script",
      label: "Dub script",
      description: "One line per panel. Use the button above to auto-extract from the panels.",
      type: "text",
      required: true,
      aiGenerator: {
        label: "Write dub script",
        produces: "script",
        requires: ["comicTitle", "panels"],
        kind: "comic-script",
      },
    },
    {
      id: "narrationVoice",
      label: "Narrator voice",
      description: "Used for 'narrator' speaker. Other characters get alternating presets.",
      type: "selection",
      defaultValue: "onyx",
      options: [
        { value: "alloy", label: "alloy" },
        { value: "echo", label: "echo" },
        { value: "fable", label: "fable" },
        { value: "onyx", label: "onyx" },
        { value: "nova", label: "nova" },
        { value: "shimmer", label: "shimmer" },
      ],
    },
  ],

  async generate(values, ctx) {
    const panels = (values.panels as PanelImage[] | undefined) ?? [];
    if (panels.length === 0) throw new Error("Upload at least one panel");
    const lines = splitLines(String(values.script ?? ""));
    if (lines.length === 0) throw new Error("Script required");
    // If OCR produced entries with speakers, prefer those (index-aligned).
    const entries = (values.dubEntries as Array<{ speaker: string; line: string }> | undefined) ?? [];

    const scenes: Scene[] = panels.map((panel, i) => {
      const entry = entries[i];
      const line = entry?.line ?? lines[i] ?? "";
      const speaker = entry?.speaker;
      const portrait = ctx.orientation === "portrait";
      const scene: Scene = {
        id: createId(),
        type: "text_only",
        duration: Math.max(2.5, Math.min(5, line.split(/\s+/).length / 2.7 + 1.2)),
        emphasisText: line,
        emphasisSize: portrait ? 62 : 46,
        emphasisColor: "#fff8dc",
        emphasisGlow: "rgba(0,0,0,0.9)",
        textY: portrait ? 260 : 140,
        transition: i === 0 ? "beat_flash" : "none",
        background: {
          color: "#000000",
          imageUrl: panel.url,
          kenBurns: true,
          vignette: 0.55,
        },
      };
      if (speaker) {
        // Pre-create a voiceover stub so narrate-all can see the speaker.
        scene.voiceover = {
          audioUrl: "",
          audioDurationSec: scene.duration,
          provider: "openai",
          voice: "",
          text: line,
          speaker,
        };
      }
      return scene;
    });
    return { scenes };
  },

  async runAiGenerator(generator, values, ctx) {
    if (generator.kind === "comic-ocr") {
      const panels = (values.panels as PanelImage[] | undefined) ?? [];
      if (panels.length === 0) throw new Error("Upload panels first");
      const res = await fetch("/api/comic-dub/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          panels: panels.map((p, i) => ({
            id: `p${i}`,
            url: p.url,
            prompt: p.prompt,
          })),
          comicTitle: String(values.comicTitle ?? ""),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `OCR failed (${res.status})`);
      // Persist the speaker list so the voice mapping UI can show them, and
      // the entries so narrate-all can use per-speaker voices.
      // Writing into workflowInputs is the responsibility of the caller, but
      // we return the script (primary slot value) and the caller writes
      // `script`. Stash `dubEntries` and `dubSpeakers` via a side-channel.
      if (typeof window !== "undefined") {
        import("@/store/project-store").then(({ useProjectStore }) => {
          useProjectStore.getState().setWorkflowInputs({
            dubEntries: data.entries,
            dubSpeakers: data.speakers,
          });
        });
      }
      return data.script as string;
    }
    if (generator.kind === "comic-script") {
      const title = String(values.comicTitle ?? "").trim();
      const panels = (values.panels as PanelImage[] | undefined) ?? [];
      if (!title) throw new Error("Comic title required");
      const count = Math.max(4, panels.length || 10);
      return await writeScript(
        `Write a dub script for a comic called "${title}". Generate exactly ${count} lines of dramatic narration — one per panel. Punchy, no filler, one line per scene.`,
        count,
        ctx.orientation,
      );
    }
    throw new Error(`Unsupported generator: ${generator.kind}`);
  },

  autoPipeline: {
    topicLabel: "Comic title",
    topicSlotId: "comicTitle",
    steps: [
      {
        label: "Write dub script",
        async run(values, setValues, ctx) {
          const title = String(values.comicTitle ?? "").trim();
          if (!title) throw new Error("Comic title required");
          const panels = (values.panels as PanelImage[] | undefined) ?? [];
          const count = Math.max(4, panels.length || 10);
          const script = await writeScript(
            `Write a ${count}-line comic dub for "${title}"`,
            count,
            ctx.orientation,
          );
          setValues({ script });
        },
      },
    ],
  },
};
