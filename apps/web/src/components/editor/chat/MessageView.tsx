"use client";

import { useState } from "react";
import { type AspectRatio, type ChatMessage, type ContentBlock } from "./types";
import { BUILD_STEP_NAMES, ScreenshotStrip, ToolUseBubble } from "./ToolRenderers";

// A compact, Telegram/YouTube-style video card for a composition version. Shows
// a small poster with a play button; tapping opens the fullscreen viewer (zoom +
// rotate). The heavy player only mounts in the viewer, so a long thread with
// many version cards stays light. Width is capped per orientation so vertical
// (9:16) clips don't blow up the bubble.
export function VideoMessageCard({
  label,
  aspectRatio,
  onOpen,
}: {
  label: string;
  aspectRatio: AspectRatio;
  onOpen: () => void;
}) {
  const [w, h] = aspectRatio.split(":");
  const portrait = Number(h) > Number(w);
  const maxWidth = portrait ? 150 : 260;

  return (
    <button
      onClick={onOpen}
      aria-label={`Play ${label} fullscreen`}
      style={{ maxWidth }}
      className="group block w-full overflow-hidden rounded-2xl rounded-tl-sm border border-[var(--color-border)] bg-[var(--color-surface)] text-left shadow-sm transition-colors hover:border-[var(--color-accent)]/50"
    >
      <div className="relative w-full" style={{ aspectRatio: `${w} / ${h}` }}>
        <div className="absolute inset-0 bg-gradient-to-br from-[var(--color-surface-2)] to-black" />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm transition-transform group-hover:scale-105">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <polygon points="6,4 20,12 6,20" />
            </svg>
          </span>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 px-2.5 py-1.5">
        <span className="truncate text-[11px] font-medium text-[var(--color-fg)]">{label}</span>
        <span className="shrink-0 text-[9px] text-[var(--color-fg-muted)]">{aspectRatio}</span>
      </div>
    </button>
  );
}

export function MessageBubble({
  message,
  projectId,
  onBranched,
}: {
  message: ChatMessage;
  projectId: string;
  onBranched: (newProjectId: string) => void;
}) {
  if (message.role === "user") {
    const text =
      typeof message.content === "string"
        ? message.content
        : message.content
            .filter((b) => b.type === "text")
            .map((b) => (b as { text: string }).text)
            .join("\n");
    return (
      <div className="ml-auto max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-tr-sm bg-[var(--color-surface-2)] px-3.5 py-2.5 text-sm text-[var(--color-fg)]">
        {text}
      </div>
    );
  }
  if (typeof message.content === "string") {
    return (
      <div className="group max-w-[88%] whitespace-pre-wrap break-words rounded-2xl rounded-tl-sm border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-2.5 text-sm leading-relaxed">
        {message.content}
        <ForkFromHere projectId={projectId} messageId={message.id} onBranched={onBranched} />
      </div>
    );
  }
  const grouped = groupContentBlocks(message.content);
  return (
    <div className="group max-w-[88%] space-y-2 rounded-2xl rounded-tl-sm border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-3 text-sm">
      {grouped.map((item, i) => {
        if (item.kind === "text") {
          return (
            <div key={i} className="whitespace-pre-wrap break-words">
              {item.text}
            </div>
          );
        }
        if (item.kind === "tool_use") {
          return <ToolUseBubble key={i} name={item.name} input={item.input} />;
        }
        if (item.kind === "screenshots") {
          return <ScreenshotStrip key={i} images={item.images} />;
        }
        return <BuildGroupHistory key={i} group={item} />;
      })}
      <ForkFromHere projectId={projectId} messageId={message.id} onBranched={onBranched} />
    </div>
  );
}

type ContentGroup =
  | { kind: "text"; text: string }
  | { kind: "tool_use"; name: string; input: Record<string, unknown> }
  | { kind: "screenshots"; images: Array<{ data: string; mimeType: string }> }
  | {
      kind: "buildGroup";
      steps: Array<{ name: string; input: Record<string, unknown> }>;
      images: Array<{ data: string; mimeType: string }>;
    };

function groupContentBlocks(blocks: ContentBlock[]): ContentGroup[] {
  const result: ContentGroup[] = [];
  let buffer: {
    steps: Array<{ name: string; input: Record<string, unknown> }>;
    images: Array<{ data: string; mimeType: string }>;
  } | null = null;
  const flush = () => {
    if (!buffer) return;
    if (buffer.steps.length === 1 && buffer.images.length === 0) {
      result.push({
        kind: "tool_use",
        name: buffer.steps[0].name,
        input: buffer.steps[0].input,
      });
    } else if (buffer.steps.length > 0) {
      result.push({
        kind: "buildGroup",
        steps: buffer.steps,
        images: buffer.images,
      });
    }
    buffer = null;
  };
  for (const block of blocks) {
    // Rendered as suggestion chips, not as a tool bubble in the thread.
    if (block.type === "tool_use" && block.name === "suggest_next_steps") continue;
    if (block.type === "tool_use" && BUILD_STEP_NAMES.has(block.name)) {
      if (!buffer) buffer = { steps: [], images: [] };
      buffer.steps.push({ name: block.name, input: block.input });
      continue;
    }
    if (block.type === "tool_result" && block.images && block.images.length > 0) {
      if (buffer) {
        buffer.images.push(...block.images);
      } else {
        result.push({ kind: "screenshots", images: block.images });
      }
      continue;
    }
    flush();
    if (block.type === "text") {
      result.push({ kind: "text", text: block.text });
    } else if (block.type === "tool_use") {
      result.push({
        kind: "tool_use",
        name: block.name,
        input: block.input,
      });
    }
  }
  flush();
  return result;
}

function BuildGroupHistory({
  group,
}: {
  group: {
    steps: Array<{ name: string; input: Record<string, unknown> }>;
    images: Array<{ data: string; mimeType: string }>;
  };
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded border border-[var(--color-border)] bg-[var(--color-bg-2)] font-mono text-xs">
      <button
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-2 px-2 py-1.5 text-left hover:bg-[var(--color-bg)]"
      >
        <span>
          <span className="text-[var(--color-success)]">✓</span>{" "}
          <span className="text-[var(--color-fg)]">Built it</span>
          <span className="text-[var(--color-fg-muted)]">
            {" "}
            · {group.steps.length} step
            {group.steps.length === 1 ? "" : "s"}
          </span>
        </span>
        <span className="text-[var(--color-fg-muted)]">{open ? "−" : "+"}</span>
      </button>
      {open && (
        <div className="space-y-1.5 border-t border-[var(--color-border)] px-2 py-2">
          {group.steps.map((step, i) => (
            <ToolUseBubble key={i} name={step.name} input={step.input} />
          ))}
        </div>
      )}
      {group.images.length > 0 && <ScreenshotStrip images={group.images} />}
    </div>
  );
}

function ForkFromHere({
  projectId,
  messageId,
  onBranched,
}: {
  projectId: string;
  messageId?: string;
  onBranched: (newProjectId: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  if (!messageId) return null;
  async function fork() {
    if (busy) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/branch`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messageId }),
      });
      if (!response.ok) return;
      const data = (await response.json()) as { id: string };
      onBranched(data.id);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="mt-2 flex items-center justify-end opacity-0 transition-opacity group-hover:opacity-100">
      <button
        onClick={fork}
        disabled={busy}
        className="rounded border border-[var(--color-border)] bg-[var(--color-bg-2)] px-2 py-0.5 text-[10px] text-[var(--color-fg-muted)] hover:border-[var(--color-accent)] hover:text-[var(--color-fg)] disabled:opacity-50"
        title="Fork project from this point"
      >
        {busy ? "forking…" : "⑂ fork from here"}
      </button>
    </div>
  );
}
