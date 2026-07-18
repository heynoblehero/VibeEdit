"use client";

import { useEffect, useMemo, useState } from "react";
import { EFFECTS_CATALOG } from "@/lib/effects/catalog";
import {
  effectPreviewUrl,
  type EffectCategory,
  type EffectEntry,
} from "@/lib/effects/catalog-types";

// A registry code-effect (native GSAP/CSS block) — previewed live in an iframe.
type CodeBlock = { name: string; title?: string; description: string; tags?: string[] };
type Item = { kind: "media"; media: EffectEntry } | { kind: "code"; code: CodeBlock };
type Filter = EffectCategory | "motion" | "all";

const CATEGORY_LABELS: Record<string, string> = {
  all: "All",
  overlay: "Overlays",
  transition: "Transitions",
  background: "Backgrounds",
  sfx: "SFX",
  motion: "Motion FX",
};

/**
 * In-editor Effects Store. The project is already open, so clicking an effect
 * asks the agent to add it to the current project via a vibeedit:send-prompt
 * event (the open Chat handles it) — no need to route through the standalone
 * /app/effects "Use in a project" flow.
 */
export function EffectsPanel() {
  const [blocks, setBlocks] = useState<CodeBlock[]>([]);
  const [active, setActive] = useState<Filter>("all");
  const [hovered, setHovered] = useState<string | null>(null);
  const [addedKey, setAddedKey] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/registry")
      .then((r) => (r.ok ? r.json() : { blocks: [] }))
      .then((data) => {
        if (!cancelled) setBlocks((data.blocks as CodeBlock[]) || []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const filters = useMemo<Filter[]>(() => {
    const present = new Set(EFFECTS_CATALOG.map((e) => e.category));
    const media = (["overlay", "transition", "background", "sfx"] as EffectCategory[]).filter((c) =>
      present.has(c),
    );
    return ["all", ...media, ...(blocks.length ? (["motion"] as Filter[]) : [])];
  }, [blocks.length]);

  const items = useMemo<Item[]>(() => {
    const media: Item[] =
      active === "motion"
        ? []
        : EFFECTS_CATALOG.filter((e) => active === "all" || e.category === active).map((e) => ({
            kind: "media" as const,
            media: e,
          }));
    const code: Item[] =
      active === "all" || active === "motion"
        ? blocks.map((b) => ({ kind: "code" as const, code: b }))
        : [];
    return [...media, ...code];
  }, [active, blocks]);

  function apply(item: Item) {
    const text =
      item.kind === "media"
        ? `Add the effect "${item.media.name}" (preset_id: ${item.media.presetId}) to the video — call apply_effect with preset_id "${item.media.presetId}" and place it where it fits best.`
        : `Add the "${item.code.title ?? item.code.name}" motion effect to the video — read_registry_block("${item.code.name}") and integrate it into a scene.`;
    window.dispatchEvent(new CustomEvent("vibeedit:send-prompt", { detail: { text } }));
    // Jump to the chat on mobile so the user sees the agent pick it up.
    window.dispatchEvent(new CustomEvent("vibeedit:focus-chat"));
    const key = item.kind === "media" ? item.media.presetId : item.code.name;
    setAddedKey(key);
    setTimeout(() => setAddedKey((k) => (k === key ? null : k)), 1600);
  }

  return (
    <div className="flex flex-col">
      {/* Filter chips */}
      <div className="sticky top-0 z-10 flex gap-1.5 overflow-x-auto border-b border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2">
        {filters.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setActive(f)}
            className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
              active === f
                ? "border-[var(--color-accent)] bg-[var(--color-accent)]/10 text-[var(--color-accent)]"
                : "border-[var(--color-border)] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
            }`}
          >
            {CATEGORY_LABELS[f] ?? f}
          </button>
        ))}
      </div>

      <p className="px-3 pt-2.5 text-[11px] text-[var(--color-fg-subtle)]">
        Click an effect to have the AI add it to this video.
      </p>

      {/* Grid */}
      <div className="grid grid-cols-2 gap-2 p-3">
        {items.map((item) => {
          const key = item.kind === "media" ? item.media.presetId : item.code.name;
          const name =
            item.kind === "media" ? item.media.name : (item.code.title ?? item.code.name);
          const isHovered = hovered === key;
          const isAudio = item.kind === "media" && item.media.kind === "audio";
          const added = addedKey === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => apply(item)}
              onMouseEnter={() => setHovered(key)}
              onMouseLeave={() => setHovered((h) => (h === key ? null : h))}
              title={`Add "${name}" to this video`}
              className="group flex flex-col overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-left transition-colors hover:border-[var(--color-accent)]/50"
            >
              <span className="relative flex aspect-video w-full items-center justify-center overflow-hidden bg-[var(--color-bg-2)]">
                <span className="absolute left-1 top-1 z-10 rounded bg-[var(--color-accent)]/90 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-black">
                  Free
                </span>
                {/* Hover-to-load preview so we don't mount dozens of iframes/webps at once */}
                {isHovered && item.kind === "code" ? (
                  <iframe
                    src={`/api/registry/${item.code.name}`}
                    title={name}
                    sandbox="allow-scripts"
                    className="pointer-events-none h-full w-full border-0"
                  />
                ) : isHovered && item.kind === "media" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={effectPreviewUrl(item.media)}
                    alt=""
                    className={`h-full w-full ${isAudio ? "object-contain p-1" : "object-cover"}`}
                  />
                ) : (
                  <span className="select-none text-[10px] font-semibold uppercase tracking-wide text-[var(--color-fg-subtle)]">
                    {item.kind === "code" ? "Motion FX" : (item.media.category ?? "Effect")}
                  </span>
                )}
                {added && (
                  <span className="absolute inset-0 flex items-center justify-center bg-[var(--color-accent)]/85 text-xs font-semibold text-black">
                    Added ✓
                  </span>
                )}
              </span>
              <span className="truncate px-2 py-1.5 text-[11px] font-medium text-[var(--color-fg)]">
                {name}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
