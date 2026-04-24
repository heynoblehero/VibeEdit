import { createId, type Scene } from "@/lib/scene-schema";
import type { WorkflowDefinition } from "../types";

interface VideoUpload {
  url: string;
  name: string;
}

export const gamingWorkflow: WorkflowDefinition = {
  id: "gaming-highlights",
  name: "Gaming highlights",
  tagline: "Clip folder → hype-paced highlight reel with title overlays.",
  icon: "Gamepad2",
  accentColor: "#8b5cf6",
  defaultOrientation: "landscape",
  enabled: true,
  paid: true,
  reviewCriteria:
    "Focus on: clip length (2-5s per hit), game title overlay on intro, no clip runs too long, final clip should be the biggest moment.",
  sceneEditorTargets: ["text", "effects", "background"],

  slots: [
    {
      id: "gameTitle",
      label: "Game title",
      description: "e.g. 'Elden Ring'",
      type: "topic",
    },
    {
      id: "clips",
      label: "Gameplay clips",
      description: "Drop your highlight clips in the order you want them cut.",
      type: "file-folder",
      accepts: ["video/*"],
      required: true,
    },
    {
      id: "callouts",
      label: "Callouts (optional)",
      description: "Short overlay text per clip (e.g. 'FIRST BLOOD', 'CLUTCH').",
      type: "text",
    },
  ],

  async generate(values, ctx) {
    const clips = (values.clips as VideoUpload[] | undefined) ?? [];
    if (clips.length === 0) throw new Error("Upload gameplay clips");
    const gameTitle = String(values.gameTitle ?? "").trim();
    const callouts = String(values.callouts ?? "")
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    const portrait = ctx.orientation === "portrait";

    // Intro card with game title.
    const scenes: Scene[] = [];
    if (gameTitle) {
      scenes.push({
        id: createId(),
        type: "text_only",
        duration: 1.5,
        emphasisText: gameTitle.toUpperCase(),
        emphasisSize: portrait ? 130 : 110,
        emphasisColor: "#8b5cf6",
        emphasisGlow: "#8b5cf666",
        textY: portrait ? 700 : 450,
        transition: "beat_flash_colored",
        transitionColor: "#8b5cf6",
        zoomPunch: 1.2,
        background: { color: "#0a0a0a", vignette: 0.55 },
      });
    }

    // One scene per clip.
    for (let i = 0; i < clips.length; i++) {
      const clip = clips[i];
      const callout = callouts[i];
      scenes.push({
        id: createId(),
        type: "text_only",
        duration: 3,
        emphasisText: callout?.toUpperCase() ?? "",
        emphasisSize: portrait ? 88 : 68,
        emphasisColor: "#fbbf24",
        emphasisGlow: "rgba(0,0,0,0.9)",
        textY: portrait ? 180 : 100,
        transition: "beat_flash",
        shakeIntensity: i === clips.length - 1 ? 10 : 6,
        zoomPunch: 1.1,
        background: {
          color: "#000000",
          videoUrl: clip.url,
          videoMuted: false,
          vignette: 0.5,
        },
      });
    }

    return { scenes };
  },
};
