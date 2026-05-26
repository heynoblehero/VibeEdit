"use client";

import { useState } from "react";

type Track = "footage" | "composition";

type Step = {
  n: string;
  title: string;
  body: string;
  example: string;
  mono?: boolean;
};

const TRACKS: Record<Track, { label: string; steps: Step[] }> = {
  footage: {
    label: "Edit footage",
    steps: [
      {
        n: "01",
        title: "Drop your footage.",
        body: "Upload any .mp4 or .mov to the project, then describe the edit in plain English.",
        example: '"Trim my talking head, remove filler words, auto-grade, burn 2-word captions."',
      },
      {
        n: "02",
        title: "The agent edits.",
        body: "Cuts on word boundaries (never mid-phoneme), auto-grades each segment, burns captions with output-timeline sync, and normalizes to −14 LUFS. One encode per segment — no quality loss from chained re-encodes.",
        example: "✓ transcribe  ✓ snap_to_boundary  ✓ render_edl  ✓ loudnorm  ✓ Done.",
        mono: true,
      },
      {
        n: "03",
        title: "Download or keep chatting.",
        body: '"Tighten the cut at 0:42." "Add warm grade on the b-roll." Iterate in chat. When it looks right, hit Render.',
        example: "EDL → lossless concat → captions last → −14 LUFS → final.mp4",
        mono: true,
      },
    ],
  },
  composition: {
    label: "Create from scratch",
    steps: [
      {
        n: "01",
        title: "Write a brief.",
        body: "One sentence. A creative brief, not a timeline. The agent reads it and plans every scene.",
        example: '"60s 16:9 history mystery about Roanoke. Sepia, slow ken-burns, no flashes."',
      },
      {
        n: "02",
        title: "The agent builds — and checks its own work.",
        body: "It writes the composition, lints it, screenshots key frames, and fixes anything broken before you see it.",
        example: "✓ plan_composition  ✓ write_file  ✓ lint  ✓ screenshot_at_time  ✓ Built it.",
        mono: true,
      },
      {
        n: "03",
        title: "Edit by chat. Render to MP4.",
        body: '"Make scene 3 punchier." "Drop the white flash." Iterate in plain language. When it looks right, hit Render.',
        example: "Render MP4 · YouTube 1080p · 30fps  →  output.mp4",
        mono: true,
      },
    ],
  },
};

export function HowItWorksTabs() {
  const [active, setActive] = useState<Track>("footage");
  const track = TRACKS[active];

  return (
    <div>
      <div className="mb-12 flex justify-center sm:mb-16">
        <div className="inline-flex rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-1">
          {(["footage", "composition"] as Track[]).map((id) => (
            <button
              key={id}
              onClick={() => setActive(id)}
              className={`rounded-md px-5 py-2 text-sm font-semibold transition ${
                active === id
                  ? "bg-[var(--color-accent)] text-black"
                  : "text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
              }`}
            >
              {TRACKS[id].label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-12 sm:space-y-16">
        {track.steps.map((step) => (
          <div
            key={`${active}-${step.n}`}
            className="grid gap-4 sm:gap-6 md:grid-cols-[120px_1fr] md:items-start md:gap-10 animate-[fadeIn_200ms_ease-out]"
          >
            <div className="font-mono text-4xl font-bold text-[var(--color-accent)]/70 sm:text-5xl md:text-6xl">
              {step.n}
            </div>
            <div>
              <h3 className="mb-3 text-2xl font-bold sm:text-3xl">{step.title}</h3>
              <p className="mb-5 max-w-2xl text-base text-[var(--color-fg-muted)] sm:text-lg">
                {step.body}
              </p>
              <div
                className={`rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-sm sm:p-5 ${
                  step.mono ? "font-mono text-[var(--color-fg)]" : "italic text-[var(--color-fg)]"
                }`}
              >
                {step.example}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
