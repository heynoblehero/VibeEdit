/**
 * Representative briefs for the eval harness. Keep this set small and stable so
 * the "% postable" number is comparable run-to-run. Add a brief whenever a real
 * user prompt exposes a new failure mode — that's how the eval grows teeth.
 */

export interface Brief {
  id: string;
  prompt: string;
  format: "16:9" | "9:16" | "1:1";
  /** Does this brief imply narration (→ audio + captions are scored as required)? */
  needsAudio: boolean;
  /**
   * Which pipeline this brief exercises. Absent/"build" → generate a
   * composition. "edit" → the talk-to-edit footage path (EDL → mp4 wrapped in
   * a single-clip index.html); scored with the additive edit-mode checks.
   */
  mode?: "build" | "edit";
  /**
   * For edit briefs: a project-relative source clip the agent should edit. The
   * runner is expected to seed this into the project before the run.
   */
  sourceClip?: string;
}

export const BRIEFS: Brief[] = [
  {
    id: "apple-evil",
    prompt: "Make a punchy 30-second short about why Apple is evil. Use real images.",
    format: "9:16",
    needsAudio: false,
  },
  {
    id: "octopus-facts",
    prompt: "A 25s comic-style facts short: 3 wild facts about octopuses.",
    format: "9:16",
    needsAudio: false,
  },
  {
    id: "history-doc",
    prompt: "A 40-second narrated mini-doc about the fall of the Berlin Wall.",
    format: "16:9",
    needsAudio: true,
  },
  {
    id: "finance-hook",
    prompt: "30s finance explainer: why inflation quietly steals your savings. Energetic.",
    format: "9:16",
    needsAudio: true,
  },
  {
    id: "product-launch",
    prompt: "A clean 20-second product launch teaser for a fictional smartwatch called Pulse.",
    format: "16:9",
    needsAudio: false,
  },
  {
    id: "sleep-story",
    prompt: "A calm 35-second sleep-story intro about a quiet cabin in the snow.",
    format: "9:16",
    needsAudio: true,
  },
  // ── Edit-path briefs (talk-to-edit footage → EDL → single-clip wrapper). ──
  {
    id: "edit-talkinghead-tighten",
    prompt:
      "Here's a raw talking-head clip. Tighten it — cut the dead air and ums at the start and end — and burn in captions.",
    format: "9:16",
    needsAudio: true,
    mode: "edit",
    sourceClip: "assets/uploads/talkinghead.mp4",
  },
  {
    id: "edit-broll-trim",
    prompt:
      "Trim this raw vlog footage down to the best 20 seconds and add a quick title card at the top.",
    format: "16:9",
    needsAudio: false,
    mode: "edit",
    sourceClip: "assets/uploads/vlog.mp4",
  },
];
