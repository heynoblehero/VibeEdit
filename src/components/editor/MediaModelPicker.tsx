"use client";

import { useEffect, useState } from "react";

interface ModelEntry {
  id: string;
  kind: "image" | "video";
  name: string;
  description: string;
  tags: string[];
  estimatedCostUsd: number;
}

// Tiny dropdown the SceneEditor renders so a user can override the agent's
// default media model on a per-scene basis. The selected id is stored in
// localStorage so the agent can pick it up if the user explicitly told them
// to use it. (Pure metadata — doesn't actually trigger generation.)
//
// Stored under: vibeedit:scene:<sceneId>:imageModel / :videoModel
export function MediaModelPicker({
  sceneId,
  kind,
  onPick,
}: {
  sceneId: string;
  kind: "image" | "video";
  onPick?: (modelId: string) => void;
}) {
  const [models, setModels] = useState<ModelEntry[]>([]);
  const storageKey = `vibeedit:scene:${sceneId}:${kind}Model`;
  const [picked, setPicked] = useState<string>("");

  useEffect(() => {
    fetch("/api/media/models")
      .then((r) => r.json())
      .then((d) => setModels((d.models ?? []).filter((m: ModelEntry) => m.kind === kind)))
      .catch(() => {});
    try {
      setPicked(window.localStorage.getItem(storageKey) ?? "");
    } catch {}
  }, [kind, storageKey]);

  if (models.length === 0) return null;

  return (
    <div className="flex items-center gap-1.5 text-[11px] text-neutral-500">
      <span className="uppercase tracking-wider">{kind} model</span>
      <select
        value={picked}
        onChange={(e) => {
          const v = e.target.value;
          setPicked(v);
          try {
            if (v) window.localStorage.setItem(storageKey, v);
            else window.localStorage.removeItem(storageKey);
          } catch {}
          if (onPick && v) onPick(v);
        }}
        className="flex-1 bg-neutral-900 border border-neutral-700 rounded px-1 py-0.5 text-[11px] text-white focus:outline-none focus:border-emerald-500"
        title="Tell the agent which model to use for this scene's media — leave on Auto for default."
      >
        <option value="">Auto (agent picks)</option>
        {models.map((m) => (
          <option key={m.id} value={m.id} title={m.description}>
            {m.name} · ${m.estimatedCostUsd}
          </option>
        ))}
      </select>
    </div>
  );
}
