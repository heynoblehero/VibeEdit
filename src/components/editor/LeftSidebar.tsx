"use client";

/**
 * LeftSidebar — vertical tab bar on the left edge of the editor.
 *
 * Replaces the right-side Uploads drawer + the topbar AI button with a
 * persistent left panel containing three tabs:
 *
 *   📁 Uploads — per-project upload bin (drag tiles onto the timeline).
 *   ⚡ Actions — draggable transition / effect / scene-type cards.
 *   ✨ AI       — prefab agent commands as draggable cards + open-chat.
 *
 * All three tabs use the same drag-onto-timeline / drag-onto-scene
 * pattern. Each card sets a vibeedit/* dataTransfer MIME type that
 * Timeline.tsx and SceneCard.tsx interpret to perform the right
 * mutation (insert scene, set cut, push effect, focused-chat).
 */

import { Layers, Sparkles, Upload, Wand2 } from "lucide-react";
import { useState } from "react";
import { ActionsPanel } from "./ActionsPanel";
import { AIPanel } from "./AIPanel";
import { TracksPanel } from "./TracksPanel";
import { UploadsPanel } from "./UploadsPanel";

type TabKey = "uploads" | "actions" | "ai" | "tracks";

interface TabDef {
  key: TabKey;
  label: string;
  icon: typeof Upload;
  color: string;
}

const TABS: TabDef[] = [
  { key: "uploads", label: "Uploads", icon: Upload, color: "text-emerald-400" },
  { key: "actions", label: "Actions", icon: Wand2, color: "text-amber-400" },
  { key: "tracks", label: "Tracks", icon: Layers, color: "text-cyan-400" },
  { key: "ai", label: "AI", icon: Sparkles, color: "text-sky-400" },
];

const STORAGE_KEY = "vibeedit:leftsidebar-tab";

export function LeftSidebar() {
  const [active, setActiveRaw] = useState<TabKey>(() => {
    if (typeof window === "undefined") return "uploads";
    const saved = window.localStorage.getItem(STORAGE_KEY) as TabKey | null;
    return saved && TABS.some((t) => t.key === saved) ? saved : "uploads";
  });
  const setActive = (k: TabKey) => {
    setActiveRaw(k);
    try {
      window.localStorage.setItem(STORAGE_KEY, k);
    } catch {
      // localStorage unavailable — non-critical, ignore.
    }
  };

  return (
    <div className="w-72 flex shrink-0 border-r border-neutral-800/80 bg-neutral-950/60 backdrop-blur-sm overflow-hidden">
      {/* Vertical tab strip */}
      <div className="w-12 flex flex-col items-center gap-0.5 py-2 border-r border-neutral-800/60 bg-gradient-to-b from-neutral-950 to-neutral-950/80">
        {TABS.map((t) => {
          const Icon = t.icon;
          const isActive = active === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setActive(t.key)}
              title={t.label}
              className={`relative flex flex-col items-center gap-0.5 w-full py-2.5 transition-all ${
                isActive
                  ? `${t.color} bg-gradient-to-r from-neutral-900 to-neutral-900/40`
                  : "text-neutral-600 hover:text-white hover:bg-neutral-900/60"
              }`}
            >
              {isActive && (
                <span
                  className={`absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 rounded-r ${t.color.replace("text-", "bg-")}`}
                />
              )}
              <Icon className="h-4 w-4" strokeWidth={isActive ? 2.5 : 2} />
              <span className="text-[9px] uppercase tracking-wider font-medium">
                {t.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="flex-1 min-w-0 flex flex-col">
        {active === "uploads" && <UploadsPanel inline />}
        {active === "actions" && <ActionsPanel />}
        {active === "tracks" && <TracksPanel />}
        {active === "ai" && <AIPanel />}
      </div>
    </div>
  );
}
