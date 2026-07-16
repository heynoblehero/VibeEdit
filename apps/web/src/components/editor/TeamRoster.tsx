"use client";

import { useEffect, useState } from "react";
import { parseScenes, type SceneInfo } from "@/lib/ai/scene-manifest";

// The "Editor Team" roster: one row per scene agent, derived from the scene
// markers in index.html. Selecting a row focuses that agent — the chat scopes to
// its thread and routes instructions to it. "All scenes" returns to the lead.
export function TeamRoster({
  projectId,
  reloadKey,
  activeSceneId,
  onSelectAgent,
}: {
  projectId: string;
  reloadKey: number;
  activeSceneId: string | null;
  onSelectAgent: (sceneId: string | null) => void;
}) {
  const [scenes, setScenes] = useState<SceneInfo[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    fetch(`/api/projects/${projectId}/files/index.html?v=${reloadKey}`)
      .then((response) => (response.ok ? response.text() : ""))
      .then((html) => {
        if (!active) return;
        setScenes(parseScenes(html));
        setLoaded(true);
      })
      .catch(() => {
        if (active) setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, [projectId, reloadKey]);

  const rowBase =
    "w-full rounded-lg border px-3 py-2 text-left transition-colors focus:outline-none focus:border-[var(--color-accent)]";
  const active = (on: boolean) =>
    on
      ? "border-[var(--color-accent)] bg-[var(--color-accent)]/8"
      : "border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-border-2)]";

  const fmt = (seconds: number | null) => (seconds == null ? "?" : `${seconds}s`);

  return (
    <div className="flex flex-col gap-2 p-3">
      <div className="px-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-fg-subtle)]">
        The Team
      </div>

      <button
        type="button"
        onClick={() => onSelectAgent(null)}
        className={`${rowBase} ${active(activeSceneId === null)}`}
      >
        <div className="text-xs font-semibold text-[var(--color-fg)]">All scenes · lead</div>
        <div className="text-[10px] text-[var(--color-fg-muted)]">
          Brief, plan, and whole-video changes
        </div>
      </button>

      {scenes.map((scene, index) => {
        const on = activeSceneId === scene.id;
        const range =
          scene.start != null
            ? `${fmt(scene.start)}–${fmt(scene.start + (scene.duration ?? 0))}`
            : "—";
        return (
          <button
            key={scene.id}
            type="button"
            onClick={() => onSelectAgent(scene.id)}
            className={`${rowBase} ${active(on)}`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-[var(--color-fg)]">
                {scene.name ?? `Scene ${index + 1}`}
              </span>
              <span className="font-mono text-[10px] text-[var(--color-fg-subtle)]">{range}</span>
            </div>
            <div className="font-mono text-[10px] text-[var(--color-fg-muted)]">{scene.id}</div>
          </button>
        );
      })}

      {loaded && scenes.length === 0 && (
        <div className="px-1 py-2 text-[11px] leading-relaxed text-[var(--color-fg-muted)]">
          No scene agents yet. Build a composition in chat — each scene becomes an agent you can
          direct on its own.
        </div>
      )}
    </div>
  );
}
