"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import { Wordmark } from "@/components/Wordmark";
import { EFFECTS_CATALOG } from "@/lib/effects/catalog";
import {
  effectFileUrl,
  effectPreviewUrl,
  type EffectCategory,
  type EffectEntry,
} from "@/lib/effects/catalog-types";

type Project = { id: string; name: string };
type Ratio = "16:9" | "9:16" | "1:1";
// A registry code-effect (native GSAP/CSS block) — previewed live in an iframe.
type CodeBlock = { name: string; title?: string; description: string; tags?: string[] };
// A card is either a media asset (mp4/mp3 overlay) or a code effect.
type Item = { kind: "media"; media: EffectEntry } | { kind: "code"; code: CodeBlock };
// "motion" is the virtual category for code effects.
type Filter = EffectCategory | "motion" | "all";

const RATIO_CLASS: Record<Ratio, string> = {
  "16:9": "aspect-video w-full",
  "9:16": "aspect-[9/16] h-[70vh]",
  "1:1": "aspect-square h-[70vh]",
};
const CATEGORY_LABELS: Record<string, string> = {
  overlay: "Overlays",
  transition: "Transitions",
  background: "Backgrounds",
  sfx: "SFX",
  motion: "Motion FX",
};

export default function EffectsPage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [projects, setProjects] = useState<Project[]>([]);
  const [blocks, setBlocks] = useState<CodeBlock[]>([]);
  const [active, setActive] = useState<Filter>("all");
  const [hovered, setHovered] = useState<string | null>(null);
  const [preview, setPreview] = useState<Item | null>(null);

  useEffect(() => {
    if (!isPending && !session) router.replace("/app/login");
  }, [isPending, session, router]);

  useEffect(() => {
    if (!session) return;
    fetch("/api/projects")
      .then((r) => (r.ok ? r.json() : { projects: [] }))
      .then((data) => setProjects((data.projects as Project[]) || []))
      .catch(() => {});
    fetch("/api/registry")
      .then((r) => (r.ok ? r.json() : { blocks: [] }))
      .then((data) => setBlocks((data.blocks as CodeBlock[]) || []))
      .catch(() => {});
  }, [session]);

  const categories = useMemo<Filter[]>(() => {
    const present = new Set(EFFECTS_CATALOG.map((e) => e.category));
    const media = (["overlay", "transition", "background", "sfx"] as EffectCategory[]).filter((c) =>
      present.has(c),
    );
    return [...media, ...(blocks.length ? (["motion"] as Filter[]) : [])];
  }, [blocks.length]);

  const items = useMemo<Item[]>(() => {
    const media: Item[] =
      active === "motion"
        ? []
        : EFFECTS_CATALOG.filter((e) => active === "all" || e.category === active).map((e) => ({
            kind: "media",
            media: e,
          }));
    const code: Item[] =
      active === "all" || active === "motion" ? blocks.map((b) => ({ kind: "code", code: b })) : [];
    return [...media, ...code];
  }, [active, blocks]);

  function seedProject(projectId: string, prompt: string) {
    if (!projectId) return;
    localStorage.setItem(`vibeedit:seed:${projectId}`, prompt);
    router.push(`/app/projects/${projectId}/edit`);
  }
  function useMediaInProject(effect: EffectEntry, projectId: string) {
    seedProject(
      projectId,
      `Add the effect "${effect.name}" (preset_id: ${effect.presetId}) to the video — call apply_effect with preset_id "${effect.presetId}" and place it where it fits best.`,
    );
  }
  function useCodeInProject(block: CodeBlock, projectId: string) {
    seedProject(
      projectId,
      `Add the "${block.title ?? block.name}" motion effect to the video — read_registry_block("${block.name}") and integrate it into a scene.`,
    );
  }

  if (isPending || !session) return null;

  return (
    <main className="mx-auto max-w-5xl p-4 sm:p-8">
      <header className="md:hidden mb-8 flex flex-wrap items-center justify-between gap-3 sm:mb-10">
        <Link href="/app/projects">
          <Wordmark size="md" />
        </Link>
        <nav className="flex flex-wrap gap-3 text-sm">
          <Link
            href="/app/projects"
            className="text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
          >
            Projects
          </Link>
          <Link
            href="/app/references"
            className="text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
          >
            References
          </Link>
          <Link href="/app/effects" className="text-[var(--color-accent)]">
            Effects
          </Link>
        </nav>
      </header>

      <h1 className="mb-2 text-2xl font-bold sm:text-3xl">Effects store</h1>
      <p className="mb-6 max-w-2xl text-[var(--color-fg-muted)]">
        Ready-made overlays, animated backgrounds, SFX, and native motion effects. Drop one into a
        project and the AI composites it correctly — or just name it in the editor chat.
      </p>

      <div className="mb-6 flex flex-wrap gap-2">
        {(["all", ...categories] as Filter[]).map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setActive(cat)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
              active === cat
                ? "border-[var(--color-accent)] bg-[var(--color-accent)]/10 text-[var(--color-accent)]"
                : "border-[var(--color-border)] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
            }`}
          >
            {cat === "all" ? "All" : (CATEGORY_LABELS[cat] ?? cat)}
          </button>
        ))}
      </div>

      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => {
          const id = item.kind === "media" ? item.media.presetId : `code:${item.code.name}`;
          const name =
            item.kind === "media" ? item.media.name : (item.code.title ?? item.code.name);
          const description =
            item.kind === "media" ? item.media.description : item.code.description;
          const badge = item.kind === "media" ? item.media.compositing.blend : "motion fx";
          const isAudio = item.kind === "media" && item.media.kind === "audio";
          return (
            <li
              key={id}
              onMouseEnter={() => setHovered(id)}
              onMouseLeave={() => setHovered((h) => (h === id ? null : h))}
              className="flex flex-col overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]"
            >
              <button
                type="button"
                onClick={() => setPreview(item)}
                title="Open full preview (16:9 · 9:16 · 1:1)"
                className="group relative flex aspect-video items-center justify-center overflow-hidden bg-black"
              >
                {hovered === id || isAudio ? (
                  item.kind === "code" ? (
                    <iframe
                      title={name}
                      src={`/api/registry/${item.code.name}`}
                      className="h-full w-full border-0"
                      sandbox="allow-scripts"
                    />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={effectPreviewUrl(item.media)}
                      alt={name}
                      className={`h-full w-full ${isAudio ? "object-contain p-4" : "object-cover"}`}
                    />
                  )
                ) : (
                  <span className="flex items-center gap-1.5 text-[11px] text-[var(--color-fg-subtle)]">
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path d="M8 5v14l11-7z" />
                    </svg>
                    hover to preview
                  </span>
                )}
                <span className="absolute right-2 top-2 rounded bg-black/60 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide text-white">
                  {badge}
                </span>
                <span className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-0 transition group-hover:bg-black/30 group-hover:opacity-100">
                  <span className="rounded-full bg-white/90 px-3 py-1.5 text-[11px] font-semibold text-black">
                    ▶ Preview
                  </span>
                </span>
              </button>

              <div className="flex flex-1 flex-col gap-2 p-3">
                <div>
                  <div className="text-sm font-semibold text-[var(--color-fg)]">{name}</div>
                  <div className="mt-0.5 line-clamp-2 text-xs text-[var(--color-fg-muted)]">
                    {description}
                  </div>
                </div>
                <div className="mt-auto flex items-center justify-between gap-2 pt-1">
                  <code className="truncate font-mono text-[10px] text-[var(--color-fg-subtle)]">
                    {item.kind === "media" ? item.media.presetId : item.code.name}
                  </code>
                  <select
                    defaultValue=""
                    disabled={projects.length === 0}
                    onChange={(event) =>
                      item.kind === "media"
                        ? useMediaInProject(item.media, event.target.value)
                        : useCodeInProject(item.code, event.target.value)
                    }
                    className="shrink-0 rounded-lg border border-[var(--color-accent)] bg-[var(--color-accent)]/8 px-2 py-1 text-[11px] font-semibold text-[var(--color-accent)]"
                    title="Use this effect in a project"
                  >
                    <option value="" disabled>
                      Use in…
                    </option>
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {preview && (
        <PreviewModal
          item={preview}
          projects={projects}
          onClose={() => setPreview(null)}
          onUse={(projectId) =>
            preview.kind === "media"
              ? useMediaInProject(preview.media, projectId)
              : useCodeInProject(preview.code, projectId)
          }
        />
      )}
    </main>
  );
}

// Full preview with aspect-ratio toggle. Media overlays composite over a
// placeholder scene (screen blend) so their light reads; code effects render
// live in an iframe (scaled to fit); SFX play in an <audio>.
function PreviewModal({
  item,
  projects,
  onClose,
  onUse,
}: {
  item: Item;
  projects: Project[];
  onClose: () => void;
  onUse: (projectId: string) => void;
}) {
  const [ratio, setRatio] = useState<Ratio>("16:9");
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const name = item.kind === "media" ? item.media.name : (item.code.title ?? item.code.name);
  const description = item.kind === "media" ? item.media.description : item.code.description;
  const idLabel = item.kind === "media" ? item.media.presetId : item.code.name;
  const isAudio = item.kind === "media" && item.media.kind === "audio";
  const isMediaOverlay =
    item.kind === "media" &&
    (item.media.compositing.blend === "screen" || item.media.compositing.blend === "add");

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-3xl flex-col gap-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-[var(--color-fg)]">{name}</h2>
            <p className="text-xs text-[var(--color-fg-muted)]">{description}</p>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 rounded-lg px-2 py-1 text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
            title="Close (Esc)"
          >
            ✕
          </button>
        </div>

        {!isAudio && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-fg-subtle)]">
              Preview at
            </span>
            {(["16:9", "9:16", "1:1"] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRatio(r)}
                className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                  ratio === r
                    ? "border-[var(--color-accent)] bg-[var(--color-accent)]/10 text-[var(--color-accent)]"
                    : "border-[var(--color-border)] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center justify-center rounded-xl bg-black p-2">
          {isAudio && item.kind === "media" ? (
            <div className="flex w-full flex-col items-center gap-3 p-6">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={effectPreviewUrl(item.media)} alt="" className="w-full max-w-md" />
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <audio
                src={effectFileUrl(item.media)}
                controls
                autoPlay
                loop
                className="w-full max-w-md"
              />
            </div>
          ) : (
            <div
              className={`relative overflow-hidden rounded-lg ${RATIO_CLASS[ratio]} max-h-[70vh]`}
            >
              {item.kind === "code" ? (
                <iframe
                  title={name}
                  src={`/api/registry/${item.code.name}`}
                  className="absolute inset-0 h-full w-full border-0"
                  sandbox="allow-scripts"
                />
              ) : (
                <>
                  {isMediaOverlay && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-600 via-slate-800 to-slate-900">
                      <span className="text-xs font-medium text-white/40">your video</span>
                    </div>
                  )}
                  {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                  <video
                    src={effectFileUrl(item.media)}
                    muted
                    loop
                    autoPlay
                    playsInline
                    className="absolute inset-0 h-full w-full object-cover"
                    style={
                      isMediaOverlay
                        ? {
                            mixBlendMode:
                              item.media.compositing.blend === "add" ? "plus-lighter" : "screen",
                            opacity: item.media.compositing.defaultOpacity ?? 0.85,
                          }
                        : undefined
                    }
                  />
                </>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <code className="font-mono text-[11px] text-[var(--color-fg-subtle)]">{idLabel}</code>
          <select
            defaultValue=""
            disabled={projects.length === 0}
            onChange={(event) => onUse(event.target.value)}
            className="rounded-lg border border-[var(--color-accent)] bg-[var(--color-accent)]/8 px-3 py-1.5 text-xs font-semibold text-[var(--color-accent)]"
          >
            <option value="" disabled>
              Use in a project…
            </option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
