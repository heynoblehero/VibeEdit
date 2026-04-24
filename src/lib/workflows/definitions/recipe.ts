import { createId, type Scene } from "@/lib/scene-schema";
import type { WorkflowDefinition } from "../types";

interface Step {
  title: string;
  description?: string; // e.g. "45s" or "chop the onions"
}

interface VideoUpload {
  url: string;
  name: string;
}

function parseDurationSec(text: string | undefined, fallback: number): number {
  if (!text) return fallback;
  const m = text.match(/(\d+(?:\.\d+)?)\s*s/i);
  if (m) return Math.min(30, Number(m[1]));
  const minute = text.match(/(\d+(?:\.\d+)?)\s*m/i);
  if (minute) return Math.min(30, Number(minute[1]) * 60);
  return fallback;
}

export const recipeWorkflow: WorkflowDefinition = {
  id: "recipe-reels",
  name: "Recipe reels",
  tagline: "Ingredients + steps → timer-paced cooking Shorts with top-down clips.",
  icon: "Utensils",
  accentColor: "#ef4444",
  defaultOrientation: "portrait",
  enabled: true,
  reviewCriteria:
    "Focus on: ingredient list visible early, steps in order, clip-to-step match, step captions readable at a glance, final dish reveal scene.",
  sceneEditorTargets: ["text", "background"],

  slots: [
    {
      id: "dishName",
      label: "Dish name",
      description: "e.g. 'crispy honey garlic chicken'",
      type: "topic",
    },
    {
      id: "ingredients",
      label: "Ingredients",
      description: "One per line. Shown as the intro scene.",
      type: "text",
      required: true,
    },
    {
      id: "steps",
      label: "Cooking steps",
      description: "Each step: title + duration-or-note in description.",
      type: "structured-list",
      required: true,
    },
    {
      id: "clips",
      label: "Top-down clips",
      description: "Optional clips per step. Index-aligned to the steps list.",
      type: "file-folder",
      accepts: ["video/*"],
    },
  ],

  async generate(values, ctx) {
    const dishName = String(values.dishName ?? "Today's recipe");
    const ingredientsRaw = String(values.ingredients ?? "").trim();
    if (!ingredientsRaw) throw new Error("Ingredients required");
    const ingredients = ingredientsRaw
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    const steps = (values.steps as Step[] | undefined) ?? [];
    if (steps.length === 0) throw new Error("Add at least one step");
    const clips = (values.clips as VideoUpload[] | undefined) ?? [];
    const portrait = ctx.orientation === "portrait";

    // Intro: dish name + ingredients.
    const intro: Scene = {
      id: createId(),
      type: "text_only",
      duration: 3,
      emphasisText: dishName.toUpperCase(),
      emphasisSize: portrait ? 96 : 72,
      emphasisColor: "#ef4444",
      emphasisGlow: "#ef444466",
      text: ingredients.slice(0, 10).join(" · "),
      textSize: portrait ? 36 : 28,
      textColor: "#e5e5e5",
      textY: portrait ? 500 : 340,
      transition: "beat_flash_colored",
      transitionColor: "#ef4444",
      zoomPunch: 1.1,
      background: { color: "#0a0a0a", vignette: 0.55 },
    };

    const stepScenes: Scene[] = steps.map((st, i) => {
      const dur = parseDurationSec(st.description, 3);
      const clip = clips[i];
      return {
        id: createId(),
        type: "text_only",
        duration: dur,
        emphasisText: `STEP ${i + 1}`,
        emphasisSize: portrait ? 52 : 40,
        emphasisColor: "#ef4444",
        textY: portrait ? 180 : 100,
        text: st.title,
        textSize: portrait ? 64 : 48,
        textColor: "#ffffff",
        subtitleText: st.description,
        subtitleColor: "#a3a3a3",
        transition: "none",
        background: {
          color: "#111111",
          videoUrl: clip?.url,
          videoMuted: true,
          vignette: 0.5,
        },
      };
    });

    // Outro: "done".
    const outro: Scene = {
      id: createId(),
      type: "text_only",
      duration: 2,
      emphasisText: "DONE",
      emphasisSize: portrait ? 180 : 140,
      emphasisColor: "#fbbf24",
      emphasisGlow: "#fbbf2466",
      textY: portrait ? 700 : 460,
      transition: "beat_flash_colored",
      transitionColor: "#fbbf24",
      zoomPunch: 1.2,
      background: { color: "#0a0a0a", vignette: 0.5 },
    };

    return { scenes: [intro, ...stepScenes, outro] };
  },
};
