"use client";

import { Check, Film, Image as ImageIcon, Loader2, Pencil, Sparkles, Trash2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { SearchResult } from "@/lib/broll-search";
import type { BRoll, BRollPosition, Scene } from "@/lib/scene-schema";
import { createId } from "@/lib/scene-schema";
import { useBRollStore } from "@/store/broll-store";
import { useEditorStore } from "@/store/editor-store";
import { useProjectStore } from "@/store/project-store";

const POSITIONS: BRollPosition[] = [
  "full",
  "overlay-tl",
  "overlay-tr",
  "overlay-bl",
  "overlay-br",
  "pip-left",
  "pip-right",
  "lower-third",
];

export function BRollPanel({ scene }: { scene: Scene }) {
  const fps = useProjectStore((s) => s.project.fps);
  const addBRoll = useProjectStore((s) => s.addBRoll);
  const removeBRoll = useProjectStore((s) => s.removeBRoll);
  const updateBRoll = useProjectStore((s) => s.updateBRoll);
  const openImageEditor = useEditorStore((s) => s.openImageEditor);
  const suggestion = useBRollStore((s) => s.suggestions[scene.id]);
  const clearSuggestion = useBRollStore((s) => s.clearSuggestion);

  const accept = (r: SearchResult, position: BRollPosition) => {
    const b: BRoll = {
      id: createId(),
      kind: r.kind,
      url: r.url,
      thumbUrl: r.thumbUrl,
      position,
      startFrame: 0,
      durationFrames: Math.max(1, Math.round(scene.duration * fps)),
      opacity: 1,
      source: r.source,
      sourceId: r.sourceId,
      attribution: r.attribution,
      width: r.width,
      height: r.height,
    };
    addBRoll(scene.id, b);
  };

  const suggestedResults = suggestion
    ? [...suggestion.clips, ...suggestion.images, ...suggestion.gifs]
    : [];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Film className="h-3.5 w-3.5 text-pink-400" />
        <span className="text-xs font-semibold text-white">B-Roll</span>
        <span className="text-[10px] text-neutral-500 ml-auto">
          {(scene.broll ?? []).length} active
        </span>
      </div>

      {(scene.broll ?? []).length > 0 && (
        <div className="space-y-1.5">
          {(scene.broll ?? []).map((b) => (
            <div
              key={b.id}
              className="flex items-center gap-2 p-1.5 rounded-md border border-neutral-800 bg-neutral-900"
            >
              <div className="w-10 h-10 rounded overflow-hidden bg-neutral-800 shrink-0">
                {b.thumbUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={b.thumbUrl} alt="" className="w-full h-full object-cover" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] text-neutral-300 truncate capitalize">
                  {b.kind} &middot; {b.source}
                </div>
                <select
                  value={b.position}
                  onChange={(e) =>
                    updateBRoll(scene.id, b.id, { position: e.target.value as BRollPosition })
                  }
                  className="input-field w-full text-[10px] mt-0.5 py-0.5"
                >
                  {POSITIONS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
              {b.kind === "image" && (
                <button
                  onClick={() => openImageEditor(b.id)}
                  className="p-1 text-neutral-500 hover:text-emerald-400 transition-colors"
                  title="Edit image"
                >
                  <Pencil className="h-3 w-3" />
                </button>
              )}
              <button
                onClick={() => removeBRoll(scene.id, b.id)}
                className="p-1 text-neutral-500 hover:text-red-400 transition-colors"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <SuggestButton scene={scene} />

      {suggestion && (
        <div className="space-y-2 pt-2 border-t border-neutral-800">
          <div className="flex items-center gap-2">
            <Sparkles className="h-3 w-3 text-purple-400" />
            <span className="text-[10px] text-neutral-400">
              {suggestion.keywords.join(" · ")}
            </span>
            <button
              onClick={() => clearSuggestion(scene.id)}
              className="ml-auto p-0.5 text-neutral-600 hover:text-neutral-300"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
          <div className="text-[9px] text-neutral-600">
            AI → {suggestion.kindPreference} at {suggestion.position} · {suggestion.rationale}
          </div>
          {suggestedResults.length === 0 ? (
            <div className="text-[10px] text-neutral-500 italic">
              No results. Check API keys in .env.local (PEXELS_API_KEY, PIXABAY_API_KEY, TENOR_API_KEY).
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-1.5">
              {suggestedResults.slice(0, 9).map((r) => (
                <button
                  key={r.id}
                  onClick={() => accept(r, suggestion.position)}
                  className="group relative aspect-video rounded-md overflow-hidden border border-neutral-800 hover:border-emerald-500 transition-colors"
                  title={`${r.source} · ${r.kind}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={r.thumbUrl} alt="" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                    <Check className="h-4 w-4 text-white opacity-0 group-hover:opacity-100" />
                  </div>
                  <span className="absolute bottom-0 left-0 text-[8px] bg-black/70 px-1 text-neutral-300 capitalize">
                    {r.kind}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SuggestButton({ scene }: { scene: Scene }) {
  const setSuggestions = useBRollStore((s) => s.setSuggestions);
  const setLoading = useBRollStore((s) => s.setLoading);
  const isLoading = useBRollStore((s) => s.isLoading);

  const run = async () => {
    setLoading(true);
    try {
      const text = scene.text || scene.emphasisText || scene.subtitleText || "";
      const res = await fetch("/api/broll/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenes: [{ id: scene.id, text, durationSec: scene.duration }],
        }),
      });
      const data = await res.json();
      if (data.suggestions) setSuggestions(data.suggestions);
      else if (data.error) toast.error(data.error);
    } catch (e) {
      toast.error("B-roll suggest failed", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={run}
      disabled={isLoading}
      className="flex items-center gap-2 w-full justify-center bg-pink-600 hover:bg-pink-500 disabled:bg-neutral-700 disabled:text-neutral-500 text-white text-xs font-semibold px-3 py-2 rounded-lg transition-colors"
    >
      {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImageIcon className="h-3.5 w-3.5" />}
      Suggest B-roll
    </button>
  );
}
