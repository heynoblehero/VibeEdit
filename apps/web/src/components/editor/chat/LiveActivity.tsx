"use client";

import { useState } from "react";
import { type LiveEntry } from "./types";
import {
  ApiKeyErrorCard,
  BUILD_STEP_NAMES,
  PlanCard,
  ScreenshotStrip,
  ToolUseBubble,
  VariantPicker,
} from "./ToolRenderers";

// A compact one-line "what the agent is doing right now" indicator, driven by
// the tool_start / tool_end lifecycle events. Shows a spinner + friendly label
// (e.g. "Searching b-roll…"); renders nothing when idle, so a turn with no tool
// events (pure text reply) looks exactly as it did before.
export function ActivityIndicator({ label }: { label: string | null }) {
  if (!label) return null;
  return (
    <div className="flex items-center gap-2 text-[11px] font-medium text-[var(--color-fg-muted)]">
      <span
        className="inline-block h-3 w-3 animate-spin rounded-full border border-[var(--color-border)] border-t-[var(--color-accent)]"
        aria-hidden="true"
      />
      <span aria-live="polite">{label}…</span>
    </div>
  );
}

export function LiveLine({ entry, projectId }: { entry: LiveEntry; projectId?: string }) {
  if (entry.kind === "text") {
    return <div className="text-[var(--color-fg)]">{entry.text}</div>;
  }
  if (entry.kind === "error") {
    return <div className="text-[var(--color-danger)]">× {entry.message}</div>;
  }
  if (entry.name === "plan_composition" && entry.input) {
    return <PlanCard input={entry.input} />;
  }
  if (entry.name === "write_file" && entry.input) {
    const isFileDone = !!entry.result;
    if (isFileDone) {
      return (
        <ToolUseBubble name={entry.name} input={entry.input} prevContent={entry.prevContent} />
      );
    }
    const writePath = typeof entry.input.path === "string" ? entry.input.path : "";
    return (
      <div className="font-mono text-[var(--color-fg-muted)]">
        <span
          className="inline-block h-2.5 w-2.5 animate-spin rounded-full border border-[var(--color-border)] border-t-[var(--color-accent)]"
          aria-label="running"
        />{" "}
        <span className="text-[var(--color-fg)]">write_file</span>
        {writePath && <span> ({writePath})</span>}
      </div>
    );
  }
  const isDone = !!entry.result;
  return (
    <div className="font-mono text-[var(--color-fg-muted)]">
      {isDone ? (
        <span className="text-[var(--color-success)]">✓</span>
      ) : (
        <span
          className="inline-block h-2.5 w-2.5 animate-spin rounded-full border border-[var(--color-border)] border-t-[var(--color-accent)]"
          aria-label="running"
        />
      )}{" "}
      <span className="text-[var(--color-fg)]">{entry.name}</span>
      {entry.inputSummary && (
        <span className="text-[var(--color-fg-muted)]">({entry.inputSummary})</span>
      )}
      {entry.result && !entry.variants && (
        <>
          <div className="mt-0.5 ml-3 truncate text-[10px] text-[var(--color-fg-muted)]">
            {entry.result}
          </div>
          <ApiKeyErrorCard result={entry.result} />
        </>
      )}
      {entry.images && entry.images.length > 0 && <ScreenshotStrip images={entry.images} />}
      {entry.variants && projectId && <VariantPicker info={entry.variants} projectId={projectId} />}
    </div>
  );
}

type GroupedLive =
  | LiveEntry
  | {
      kind: "buildGroup";
      entries: Extract<LiveEntry, { kind: "tool" }>[];
    };

export function groupLive(entries: LiveEntry[]): GroupedLive[] {
  const result: GroupedLive[] = [];
  let buffer: Extract<LiveEntry, { kind: "tool" }>[] = [];
  const flush = () => {
    if (buffer.length === 0) return;
    if (buffer.length === 1) result.push(buffer[0]);
    else result.push({ kind: "buildGroup", entries: buffer });
    buffer = [];
  };
  for (const entry of entries) {
    if (entry.kind === "tool" && BUILD_STEP_NAMES.has(entry.name)) {
      buffer.push(entry);
    } else {
      flush();
      result.push(entry);
    }
  }
  flush();
  return result;
}

function BuildGroupView({
  entries,
  projectId,
}: {
  entries: Extract<LiveEntry, { kind: "tool" }>[];
  projectId?: string;
}) {
  const [open, setOpen] = useState(false);
  const allDone = entries.every((entry) => !!entry.result);
  const images = entries.flatMap((entry) => entry.images || []);
  return (
    <div className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] font-mono">
      <button
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-2 px-2 py-1.5 text-left hover:bg-[var(--color-bg)]"
      >
        <span>
          {allDone ? (
            <span className="text-[var(--color-success)]">✓</span>
          ) : (
            <span
              className="inline-block h-2.5 w-2.5 animate-spin rounded-full border border-[var(--color-border)] border-t-[var(--color-accent)]"
              aria-label="running"
            />
          )}{" "}
          <span className="text-[var(--color-fg)]">{allDone ? "Built it" : "Building…"}</span>
          <span className="text-[var(--color-fg-muted)]">
            {" "}
            · {entries.length} step{entries.length === 1 ? "" : "s"}
          </span>
        </span>
        <span className="text-[var(--color-fg-muted)]">{open ? "−" : "+"}</span>
      </button>
      {open && (
        <div className="space-y-1 border-t border-[var(--color-border)] px-2 py-1.5">
          {entries.map((entry, i) => (
            <LiveLine key={i} entry={entry} projectId={projectId} />
          ))}
        </div>
      )}
      {images.length > 0 && <ScreenshotStrip images={images} />}
    </div>
  );
}

// Renders the in-progress tool log for the current turn (grouping the build
// loop into a collapsible "Built it" section). Identical markup to the prior
// inline JSX in Chat.tsx.
export function LiveLog({ live, projectId }: { live: LiveEntry[]; projectId: string }) {
  return (
    <>
      {groupLive(live).map((entry, i) =>
        entry.kind === "buildGroup" ? (
          <BuildGroupView key={i} entries={entry.entries} projectId={projectId} />
        ) : (
          <LiveLine key={i} entry={entry} projectId={projectId} />
        ),
      )}
    </>
  );
}
