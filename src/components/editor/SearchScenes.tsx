"use client";

import { Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useProjectStore } from "@/store/project-store";

/**
 * Modal search bar — ⌘F opens. Free-text matches against scene
 * emphasisText, voiceover.text, label, statValue, quoteText, and
 * bulletItems. Click a result to select that scene.
 */
export function SearchScenes() {
  const project = useProjectStore((s) => s.project);
  const selectScene = useProjectStore((s) => s.selectScene);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "f") {
        const t = e.target as HTMLElement | null;
        const inText =
          t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
        if (inText) return;
        e.preventDefault();
        setOpen(true);
        setTimeout(() => inputRef.current?.focus(), 30);
      }
      if (e.key === "Escape" && open) {
        e.preventDefault();
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const results = useMemo(() => {
    if (!open || q.trim().length === 0) return [];
    const needle = q.toLowerCase();
    return project.scenes
      .map((s, idx) => {
        const haystack = [
          s.label,
          s.emphasisText,
          s.statValue,
          s.statLabel,
          s.quoteText,
          s.quoteAttribution,
          ...(s.bulletItems ?? []),
          s.voiceover?.text,
          s.type,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (haystack.includes(needle)) {
          // Find the snippet around the match for context.
          const idxIn = haystack.indexOf(needle);
          const start = Math.max(0, idxIn - 30);
          const snippet = haystack.slice(start, start + 80);
          return { sceneId: s.id, idx, snippet };
        }
        return null;
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);
  }, [open, q, project.scenes]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[80] bg-black/40 backdrop-blur-sm flex items-start justify-center p-8"
      onClick={() => setOpen(false)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl bg-neutral-950 border border-neutral-800 rounded-lg shadow-xl overflow-hidden"
      >
        <div className="flex items-center gap-2 px-3 py-2 border-b border-neutral-800">
          <Search className="h-4 w-4 text-neutral-500" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search scenes…"
            className="flex-1 bg-transparent text-sm text-neutral-100 outline-none placeholder:text-neutral-600"
          />
          <button
            onClick={() => setOpen(false)}
            className="p-1 rounded text-neutral-500 hover:text-white hover:bg-neutral-800"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
        <div className="max-h-80 overflow-y-auto divide-y divide-neutral-900">
          {q.trim().length === 0 ? (
            <p className="px-3 py-4 text-[11px] text-neutral-500">
              Type to search across scene text, voiceover, labels, bullets, quotes, stats…
            </p>
          ) : results.length === 0 ? (
            <p className="px-3 py-4 text-[11px] text-neutral-500">No matches.</p>
          ) : (
            results.map((r) => (
              <button
                key={r.sceneId}
                onClick={() => {
                  selectScene(r.sceneId);
                  setOpen(false);
                }}
                className="w-full text-left px-3 py-2 text-[12px] text-neutral-200 hover:bg-neutral-900"
              >
                <div className="flex items-baseline gap-2">
                  <span className="text-emerald-400 font-mono text-[10px]">
                    Scene {r.idx + 1}
                  </span>
                  <span className="text-neutral-500 text-[10px] truncate">
                    {r.snippet}…
                  </span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
