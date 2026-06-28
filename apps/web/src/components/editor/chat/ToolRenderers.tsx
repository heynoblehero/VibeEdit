"use client";

import { useState } from "react";
import { type VariantInfo, summarizeToolInput } from "./types";

// Tool names that represent the iterative "build" loop (write/lint/screenshot).
// Consecutive runs of these are collapsed into a single "Built it" group in
// both the live stream and saved history.
export const BUILD_STEP_NAMES = new Set([
  "write_file",
  "diff_file",
  "lint_composition",
  "screenshot_at_time",
]);

export function ScreenshotStrip({ images }: { images: Array<{ data: string; mimeType: string }> }) {
  return (
    <div className="mt-2 ml-3 flex flex-wrap gap-1.5">
      {images.map((image, index) => (
        <img
          // eslint-disable-next-line @next/next/no-img-element
          key={index}
          src={`data:${image.mimeType};base64,${image.data}`}
          alt={`Screenshot ${index + 1}`}
          className="max-h-32 rounded border border-[var(--color-border)]"
        />
      ))}
    </div>
  );
}

const API_KEY_ERROR_RE = /no ([\w][\w\s\-/]*?) api key/i;

export function ApiKeyErrorCard({ result }: { result: string }) {
  const match = result.match(API_KEY_ERROR_RE);
  if (!match) return null;
  const service = match[1].trim();
  return (
    <a
      href="/app/settings/api-keys"
      className="mt-1.5 ml-3 flex items-center gap-2 rounded border border-[var(--color-accent)]/40 bg-[var(--color-accent)]/5 px-2.5 py-1.5 text-xs font-sans no-underline hover:bg-[var(--color-accent)]/10"
    >
      <span className="text-[var(--color-accent)]">⚠</span>
      <span className="text-[var(--color-fg)]">No {service} API key set</span>
      <span className="ml-auto shrink-0 text-[var(--color-accent)]">Add in Settings →</span>
    </a>
  );
}

export function VariantPicker({ info, projectId }: { info: VariantInfo; projectId: string }) {
  const [chosenIndex, setChosenIndex] = useState<number | null>(null);
  const [promoting, setPromoting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pick(index: number) {
    if (promoting || chosenIndex !== null) return;
    setPromoting(true);
    setError(null);
    try {
      const response = await fetch(`/api/projects/${projectId}/variants/promote`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          variantPath: info.paths[index],
          targetPath: info.targetPath,
        }),
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      setChosenIndex(index);
      // Auto-send a follow-up to the agent so it knows which variant to use.
      window.dispatchEvent(
        new CustomEvent("vibeedit:variant-picked", {
          detail: {
            targetPath: info.targetPath,
            variantNumber: index + 1,
            sceneSlug: info.sceneSlug,
          },
        }),
      );
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setPromoting(false);
    }
  }

  return (
    <div className="mt-2 rounded-lg border border-[var(--color-accent)] bg-[var(--color-bg-2)] p-3 font-sans">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-xs font-semibold uppercase tracking-wider text-[var(--color-accent)]">
          Pick one — variants for {info.sceneSlug}
        </div>
        {chosenIndex !== null && (
          <span className="text-[10px] text-[var(--color-success)]">
            ✓ Using #{chosenIndex + 1}
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {info.paths.map((path, index) => {
          const url = `/api/projects/${projectId}/files/${path}`;
          const isChosen = chosenIndex === index;
          return (
            <button
              key={path}
              onClick={() => pick(index)}
              disabled={promoting || chosenIndex !== null}
              className={`group relative aspect-video overflow-hidden rounded-md border transition-all ${
                isChosen
                  ? "border-[var(--color-accent)] ring-2 ring-[var(--color-accent)]"
                  : "border-[var(--color-border)] hover:border-[var(--color-accent)]"
              } ${promoting || chosenIndex !== null ? "cursor-not-allowed" : "cursor-pointer"}`}
            >
              <img src={url} alt={`Variant ${index + 1}`} className="h-full w-full object-cover" />
              <span className="absolute left-1 top-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                #{index + 1}
              </span>
              {isChosen && (
                <div className="absolute inset-0 flex items-center justify-center bg-[var(--color-accent)]/30">
                  <span className="rounded-full bg-[var(--color-accent)] px-2 py-1 text-xs font-bold text-black">
                    ✓
                  </span>
                </div>
              )}
            </button>
          );
        })}
      </div>
      {error && <div className="mt-2 text-xs text-[var(--color-danger)]">{error}</div>}
      {chosenIndex === null && !promoting && (
        <div className="mt-2 text-[11px] text-[var(--color-fg-muted)]">
          Click any variant to make it the scene background. Others stay in{" "}
          <code className="rounded bg-[var(--color-bg)] px-1">{info.dir}</code>.
        </div>
      )}
    </div>
  );
}

type Scene = {
  index: number;
  durationSeconds: number;
  intent: string;
  beats: string[];
  fx: string[];
};

export function PlanCard({ input }: { input: Record<string, unknown> }) {
  const format = String(input.format || "16:9");
  const totalDuration = Number(input.totalDurationSeconds || 0);
  const niche = String(input.niche || "");
  const palette = String(input.palette || "");
  const scenes = (Array.isArray(input.scenes) ? input.scenes : []) as Scene[];
  return (
    <div className="overflow-hidden rounded-lg border border-[var(--color-accent)] bg-[var(--color-bg-2)]">
      <div className="flex items-center justify-between gap-2 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2">
        <div className="flex items-center gap-2 text-xs">
          <span className="rounded bg-[var(--color-accent)] px-1.5 py-0.5 font-semibold text-black">
            PLAN
          </span>
          <span className="font-mono text-[var(--color-fg-muted)]">
            {format} · {totalDuration}s · {scenes.length} scenes
          </span>
        </div>
      </div>
      <div className="space-y-2 p-3">
        <div className="text-xs text-[var(--color-fg-muted)]">
          <span className="text-[var(--color-fg)]">{niche}</span>
          {palette && <span> · {palette}</span>}
        </div>
        <ol className="space-y-2 text-xs">
          {scenes.map((scene) => (
            <li
              key={scene.index}
              className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] p-2"
            >
              <div className="mb-1 flex items-center justify-between font-mono text-[var(--color-fg-muted)]">
                <span className="font-bold text-[var(--color-accent)]">#{scene.index}</span>
                <span>{scene.durationSeconds}s</span>
              </div>
              <div className="mb-1 font-medium text-[var(--color-fg)]">{scene.intent}</div>
              {scene.beats?.length > 0 && (
                <ul className="ml-3 list-disc space-y-0.5 text-[var(--color-fg-muted)]">
                  {scene.beats.map((beat, i) => (
                    <li key={i}>{beat}</li>
                  ))}
                </ul>
              )}
              {scene.fx?.length > 0 && !(scene.fx.length === 1 && scene.fx[0] === "none") && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {scene.fx.map((fx, i) => (
                    <span
                      key={i}
                      className="rounded bg-[var(--color-bg)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--color-accent-2)]"
                    >
                      {fx}
                    </span>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

export function ToolUseBubble({
  name,
  input,
  prevContent,
}: {
  name: string;
  input: Record<string, unknown>;
  prevContent?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [diffMode, setDiffMode] = useState(false);
  if (name === "plan_composition") {
    return <PlanCard input={input} />;
  }
  const isWrite = name === "write_file";
  const path = typeof input.path === "string" ? input.path : "";
  const content = typeof input.content === "string" ? (input.content as string) : "";
  if (isWrite && path) {
    const lineCount = content.split("\n").length;
    const byteCount = content.length;
    const diff = prevContent !== undefined ? computeLineDiff(prevContent, content) : null;
    return (
      <div className="rounded border border-[var(--color-border)] bg-[var(--color-bg-2)] font-mono text-xs">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex w-full items-center justify-between gap-2 px-2 py-1.5 text-left hover:bg-[var(--color-bg)]"
        >
          <span className="flex min-w-0 items-center gap-1.5 truncate">
            <span className="text-[var(--color-accent)]">✎</span>{" "}
            <span className="text-[var(--color-fg)]">{path}</span>
            {diff ? (
              <span className="ml-1 shrink-0">
                <span className="text-[var(--color-success)]">+{diff.added}</span>
                <span className="text-[var(--color-fg-muted)]">/</span>
                <span className="text-[var(--color-danger)]">-{diff.removed}</span>
              </span>
            ) : (
              <span className="text-[var(--color-fg-muted)]">
                · {lineCount} lines · {byteCount.toLocaleString()}B
              </span>
            )}
          </span>
          <div className="flex shrink-0 items-center gap-2">
            {diff && expanded && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setDiffMode((v) => !v);
                }}
                className={`rounded px-1.5 py-0.5 text-[9px] font-medium transition-colors ${diffMode ? "bg-[var(--color-accent)] text-black" : "bg-[var(--color-bg)] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"}`}
              >
                diff
              </button>
            )}
            <span className="text-[var(--color-fg-muted)]">{expanded ? "−" : "+"}</span>
          </div>
        </button>
        {expanded &&
          (diffMode && diff ? (
            <div className="max-h-64 overflow-auto border-t border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-[11px] leading-snug">
              {diff.hunks.map((hunk, i) => {
                if (hunk.kind === "same") return null;
                return (
                  <div
                    key={i}
                    className={`font-mono ${hunk.kind === "add" ? "bg-[var(--color-success)]/10 text-[var(--color-success)]" : "bg-[var(--color-danger)]/10 text-[var(--color-danger)]"}`}
                  >
                    {hunk.kind === "add" ? "+" : "-"} {hunk.line}
                  </div>
                );
              })}
            </div>
          ) : (
            <pre className="max-h-64 overflow-auto border-t border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-[11px] leading-snug">
              {content.slice(0, 8000)}
              {content.length > 8000 && "\n…(truncated)"}
            </pre>
          ))}
      </div>
    );
  }
  return (
    <div className="rounded border border-[var(--color-border)] bg-[var(--color-bg-2)] px-2 py-1 font-mono text-xs text-[var(--color-fg-muted)]">
      <span className="text-[var(--color-success)]">✓</span>{" "}
      <span className="text-[var(--color-fg)]">{name}</span>
      <span>({summarizeToolInput(name, input)})</span>
    </div>
  );
}

export function computeLineDiff(
  prev: string,
  next: string,
): {
  added: number;
  removed: number;
  hunks: Array<{ kind: "add" | "remove" | "same"; line: string }>;
} {
  const MAX_LINES = 600;
  const prevLines = prev.split("\n").slice(0, MAX_LINES);
  const nextLines = next.split("\n").slice(0, MAX_LINES);
  const pn = prevLines.length;
  const nn = nextLines.length;
  const dp: number[][] = Array.from({ length: pn + 1 }, () => new Array(nn + 1).fill(0));
  for (let i = 1; i <= pn; i++) {
    for (let j = 1; j <= nn; j++) {
      dp[i][j] =
        prevLines[i - 1] === nextLines[j - 1]
          ? dp[i - 1][j - 1] + 1
          : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  const hunks: Array<{ kind: "add" | "remove" | "same"; line: string }> = [];
  let i = pn;
  let j = nn;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && prevLines[i - 1] === nextLines[j - 1]) {
      hunks.unshift({ kind: "same", line: prevLines[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      hunks.unshift({ kind: "add", line: nextLines[j - 1] });
      j--;
    } else {
      hunks.unshift({ kind: "remove", line: prevLines[i - 1] });
      i--;
    }
  }
  const added = hunks.filter((h) => h.kind === "add").length;
  const removed = hunks.filter((h) => h.kind === "remove").length;
  return { added, removed, hunks };
}
