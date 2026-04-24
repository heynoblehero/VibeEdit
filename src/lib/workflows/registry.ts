import { blankWorkflow } from "./definitions/blank";
import { comicDubWorkflow } from "./definitions/comic-dub";
import { commentaryWorkflow } from "./definitions/commentary";
import { facelessWorkflow } from "./definitions/faceless";
import { gamingWorkflow } from "./definitions/gaming";
import { movieReviewWorkflow } from "./definitions/movie-review";
import { podcastClipsWorkflow } from "./definitions/podcast-clips";
import { recipeWorkflow } from "./definitions/recipe";
import { slideshowWorkflow } from "./definitions/slideshow";
import { topNWorkflow } from "./definitions/top-n";
import { trueCrimeWorkflow } from "./definitions/true-crime";
import type { WorkflowDefinition } from "./types";

export const WORKFLOWS: WorkflowDefinition[] = [
  blankWorkflow,
  facelessWorkflow,
  slideshowWorkflow,
  commentaryWorkflow,
  comicDubWorkflow,
  podcastClipsWorkflow,
  movieReviewWorkflow,
  topNWorkflow,
  recipeWorkflow,
  trueCrimeWorkflow,
  gamingWorkflow,
];

// New projects default to "blank" — no template forced. Agent + chat drive
// everything from there.
export const DEFAULT_WORKFLOW_ID = "blank";

export function getWorkflow(id: string | undefined): WorkflowDefinition {
  return WORKFLOWS.find((w) => w.id === id) ?? blankWorkflow;
}
