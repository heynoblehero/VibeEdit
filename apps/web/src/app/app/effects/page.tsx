"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import { Wordmark } from "@/components/Wordmark";
import { EFFECTS_CATALOG } from "@/lib/effects/catalog";
import { effectPreviewUrl, type EffectCategory } from "@/lib/effects/catalog-types";

type Project = { id: string; name: string };

const CATEGORY_LABELS: Record<string, string> = {
  overlay: "Overlays",
  transition: "Transitions",
  background: "Backgrounds",
  sfx: "SFX",
  grade: "Color grades",
  typography: "Typography",
  character: "Characters",
};

export default function EffectsPage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [projects, setProjects] = useState<Project[]>([]);
  const [active, setActive] = useState<EffectCategory | "all">("all");
  // Only the hovered card animates its (looping) webp preview — animating all 13
  // at once pins the main thread and the page never idles.
  const [hovered, setHovered] = useState<string | null>(null);

  useEffect(() => {
    if (!isPending && !session) router.replace("/app/login");
  }, [isPending, session, router]);

  useEffect(() => {
    if (session)
      fetch("/api/projects")
        .then((r) => (r.ok ? r.json() : { projects: [] }))
        .then((data) => setProjects((data.projects as Project[]) || []))
        .catch(() => {});
  }, [session]);

  // Categories that actually have entries, in a sensible order.
  const categories = useMemo(() => {
    const order: EffectCategory[] = [
      "overlay",
      "transition",
      "background",
      "sfx",
      "grade",
      "typography",
      "character",
    ];
    const present = new Set(EFFECTS_CATALOG.map((e) => e.category));
    return order.filter((c) => present.has(c));
  }, []);

  const shown = useMemo(
    () =>
      active === "all" ? EFFECTS_CATALOG : EFFECTS_CATALOG.filter((e) => e.category === active),
    [active],
  );

  function useInProject(presetId: string, name: string, projectId: string) {
    if (!projectId) return;
    localStorage.setItem(
      `vibeedit:seed:${projectId}`,
      `Add the effect "${name}" (preset_id: ${presetId}) to the video — call apply_effect with preset_id "${presetId}" and place it where it fits best.`,
    );
    router.push(`/app/projects/${projectId}/edit`);
  }

  if (isPending || !session) return null;

  return (
    <main className="mx-auto max-w-5xl p-4 sm:p-8">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-3 sm:mb-10">
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
        Ready-made overlays, animated backgrounds, and SFX. Drop one into a project and the AI
        composites it correctly — or just name an effect (or its preset id) in the editor chat.
      </p>

      <div className="mb-6 flex flex-wrap gap-2">
        {(["all", ...categories] as const).map((cat) => (
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
        {shown.map((effect) => (
          <li
            key={effect.presetId}
            onMouseEnter={() => setHovered(effect.presetId)}
            onMouseLeave={() => setHovered((h) => (h === effect.presetId ? null : h))}
            className="flex flex-col overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]"
          >
            <div className="relative flex aspect-video items-center justify-center bg-black">
              {/* SFX show a static waveform; video previews (animated webp) only load
                  + animate on hover so the whole grid doesn't animate at once. */}
              {effect.kind === "audio" || hovered === effect.presetId ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={effectPreviewUrl(effect)}
                  alt={effect.name}
                  className={`h-full w-full ${effect.kind === "audio" ? "object-contain p-4" : "object-cover"}`}
                />
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
                {effect.compositing.blend}
              </span>
            </div>

            <div className="flex flex-1 flex-col gap-2 p-3">
              <div>
                <div className="text-sm font-semibold text-[var(--color-fg)]">{effect.name}</div>
                <div className="mt-0.5 line-clamp-2 text-xs text-[var(--color-fg-muted)]">
                  {effect.description}
                </div>
              </div>
              <div className="mt-auto flex items-center justify-between gap-2 pt-1">
                <code className="truncate font-mono text-[10px] text-[var(--color-fg-subtle)]">
                  {effect.presetId}
                </code>
                <select
                  defaultValue=""
                  disabled={projects.length === 0}
                  onChange={(event) =>
                    useInProject(effect.presetId, effect.name, event.target.value)
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
        ))}
      </ul>
    </main>
  );
}
