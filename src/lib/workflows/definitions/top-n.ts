import { createId, type Scene } from "@/lib/scene-schema";
import type { WorkflowDefinition } from "../types";
import { generateImages } from "../shared";

interface ListItem {
  title: string;
  description?: string;
  imageUrl?: string;
}

export const topNWorkflow: WorkflowDefinition = {
  id: "top-n",
  name: "Top-N list",
  tagline: "Countdown videos. Each item = big number + title + image.",
  icon: "ListOrdered",
  accentColor: "#10b981",
  defaultOrientation: "landscape",
  enabled: true,
  reviewCriteria:
    "Focus on: #1 is saved for last (countdown), each scene has a readable title, images don't block the number, intro/outro bookend the list.",
  sceneEditorTargets: ["text", "counter", "effects", "background"],

  slots: [
    {
      id: "topic",
      label: "List topic",
      description: "e.g. 'Top 10 games of 2025'",
      type: "topic",
      aiGenerator: {
        label: "Generate list",
        produces: "items",
        requires: ["topic"],
        kind: "topn-items",
      },
    },
    {
      id: "items",
      label: "Items (ranked — best is LAST)",
      description: "The list counts DOWN. #1 goes at the bottom.",
      type: "structured-list",
      required: true,
      aiGenerator: {
        label: "Generate images",
        produces: "items",
        requires: ["items"],
        kind: "topn-images",
      },
    },
  ],

  async generate(values, ctx) {
    const items = (values.items as ListItem[] | undefined) ?? [];
    if (items.length === 0) throw new Error("Add at least one item");
    const n = items.length;
    const portrait = ctx.orientation === "portrait";

    // Intro scene announcing the list.
    const intro: Scene = {
      id: createId(),
      type: "text_only",
      duration: 2,
      emphasisText: `TOP ${n}`,
      emphasisSize: portrait ? 160 : 140,
      emphasisColor: "#10b981",
      emphasisGlow: "#10b98166",
      textY: portrait ? 500 : 380,
      transition: "beat_flash_colored",
      transitionColor: "#10b981",
      zoomPunch: 1.15,
      background: { color: "#0a0a0a", vignette: 0.5 },
    };

    // One scene per item (countdown: first item shown is #N, last is #1).
    const itemScenes: Scene[] = items.map((it, i) => {
      const rank = n - i;
      return {
        id: createId(),
        type: "big_number",
        duration: 3,
        numberFrom: rank,
        numberTo: rank,
        numberColor: rank === 1 ? "#fbbf24" : "#10b981",
        emphasisText: it.title.toUpperCase(),
        emphasisSize: portrait ? 72 : 54,
        emphasisColor: "#ffffff",
        text: it.description,
        textColor: "#a3a3a3",
        textSize: portrait ? 40 : 32,
        textY: portrait ? 900 : 560,
        transition: rank === 1 ? "beat_flash_colored" : "beat_flash",
        transitionColor: rank === 1 ? "#fbbf24" : "#10b981",
        zoomPunch: rank === 1 ? 1.2 : 1.1,
        background: {
          color: "#0a0a0a",
          imageUrl: it.imageUrl,
          kenBurns: !!it.imageUrl,
          imageOpacity: 0.55,
          vignette: 0.6,
        },
      };
    });

    return { scenes: [intro, ...itemScenes] };
  },

  async runAiGenerator(generator, values, ctx) {
    if (generator.kind === "topn-items") {
      const topic = String(values.topic ?? "").trim();
      if (!topic) throw new Error("Topic required");
      // Use /api/script to draft structured items from a topic.
      const res = await fetch("/api/script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: `Generate a ranked list of exactly 10 items for: ${topic}. Format: one per line as "Title | short reason". No numbering.`,
          targetLines: 10,
          orientation: ctx.orientation,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `list failed (${res.status})`);
      const lines = String(data.script ?? "")
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
      const items: ListItem[] = lines.map((l) => {
        const [title, ...rest] = l.split("|").map((s) => s.trim());
        return { title: title.replace(/^\d+\.\s*/, ""), description: rest.join(" | ") || undefined };
      });
      return items;
    }
    if (generator.kind === "topn-images") {
      const items = (values.items as ListItem[] | undefined) ?? [];
      if (items.length === 0) throw new Error("Add items first");
      const prompts = items.map((i) => `${i.title} — ${i.description ?? ""}`);
      const images = await generateImages(
        prompts,
        "bold editorial illustration, single subject, dramatic lighting",
        ctx.orientation,
      );
      return items.map((it, i) => ({ ...it, imageUrl: images[i]?.url ?? it.imageUrl }));
    }
    throw new Error(`Unsupported generator: ${generator.kind}`);
  },

  autoPipeline: {
    topicLabel: "List topic",
    topicSlotId: "topic",
    steps: [
      {
        label: "Generate ranked list",
        async run(values, setValues, ctx) {
          const topic = String(values.topic ?? "").trim();
          if (!topic) throw new Error("Topic required");
          const res = await fetch("/api/script", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              topic: `Generate a ranked list of exactly 10 items for: ${topic}. Format: one per line as "Title | reason".`,
              targetLines: 10,
              orientation: ctx.orientation,
            }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error ?? "list failed");
          const lines = String(data.script ?? "")
            .split("\n")
            .map((l) => l.trim())
            .filter(Boolean);
          const items: ListItem[] = lines.map((l) => {
            const [title, ...rest] = l.split("|").map((s) => s.trim());
            return { title: title.replace(/^\d+\.\s*/, ""), description: rest.join(" | ") || undefined };
          });
          setValues({ items });
        },
      },
      {
        label: "Generate item images",
        async run(values, setValues, ctx) {
          const items = (values.items as ListItem[] | undefined) ?? [];
          const prompts = items.map((i) => `${i.title} — ${i.description ?? ""}`);
          const images = await generateImages(
            prompts,
            "bold editorial illustration",
            ctx.orientation,
          );
          setValues({
            items: items.map((it, i) => ({ ...it, imageUrl: images[i]?.url ?? it.imageUrl })),
          });
        },
      },
    ],
  },
};
