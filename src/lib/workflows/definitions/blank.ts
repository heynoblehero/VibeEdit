import type { WorkflowDefinition } from "../types";

// Blank / unconstrained workflow. No slots, no forced structure. Agent uses
// the project's `systemPrompt` (if set) + the user's chat turns. This is the
// default for new projects — you pick a real template only if you want the
// structured slot UI or workflow-specific review criteria.
export const blankWorkflow: WorkflowDefinition = {
  id: "blank",
  name: "Blank",
  tagline: "Just vibe — chat with the AI, no template.",
  icon: "Sparkles",
  accentColor: "#10b981",
  defaultOrientation: "landscape",
  enabled: true,
  slots: [],
  sceneEditorTargets: ["text", "effects", "background", "broll"],

  // No templated generation — the agent handles everything via chat. The main
  // Generate button is hidden on this workflow; we still need a stub to
  // satisfy the type.
  async generate() {
    return { scenes: [] };
  },

  reviewCriteria:
    "No fixed template. Review for pacing and visual variety generally; don't enforce a specific video format.",
};
