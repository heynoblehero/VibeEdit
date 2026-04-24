"use client";

import {
  Captions,
  Library,
  Mic2,
  Music,
  Palette,
  Wrench,
} from "lucide-react";
import { useState } from "react";
import { AssetLibraryPanel } from "./AssetLibraryPanel";
import { AssetPanel } from "./AssetPanel";
import { CaptionStylePanel } from "./CaptionStylePanel";
import { MusicPanel } from "./MusicPanel";
import { SavedStylesPanel } from "./SavedStylesPanel";
import { StyleMatchPanel } from "./StyleMatchPanel";
import { VoicePacksPanel } from "./VoicePacksPanel";

type TabId = "music" | "voice" | "captions" | "style" | "library" | "assets";

interface Tab {
  id: TabId;
  label: string;
  icon: typeof Music;
  render: () => React.ReactNode;
}

const TABS: Tab[] = [
  { id: "music", label: "Music", icon: Music, render: () => <MusicPanel /> },
  { id: "voice", label: "Voice", icon: Mic2, render: () => <VoicePacksPanel /> },
  {
    id: "captions",
    label: "Captions",
    icon: Captions,
    render: () => <CaptionStylePanel />,
  },
  {
    id: "style",
    label: "Style",
    icon: Palette,
    render: () => (
      <>
        <StyleMatchPanel />
        <SavedStylesPanel />
      </>
    ),
  },
  { id: "library", label: "Library", icon: Library, render: () => <AssetLibraryPanel /> },
  { id: "assets", label: "Assets", icon: Wrench, render: () => <AssetPanel /> },
];

export function ConfigTabs() {
  const [active, setActive] = useState<TabId | null>(null);

  if (active === null) {
    return (
      <div className="flex items-center justify-around border-b border-neutral-800 bg-neutral-950/50">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setActive(t.id)}
            className="flex flex-col items-center gap-0.5 py-2 flex-1 text-neutral-500 hover:text-white hover:bg-neutral-900 transition-colors"
            title={t.label}
          >
            <t.icon className="h-3.5 w-3.5" />
            <span className="text-[9px]">{t.label}</span>
          </button>
        ))}
      </div>
    );
  }

  const current = TABS.find((t) => t.id === active)!;
  return (
    <div className="flex flex-col border-b border-neutral-800">
      <div className="flex items-center justify-around bg-neutral-950/50 border-b border-neutral-900">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setActive(t.id === active ? null : t.id)}
            className={`flex flex-col items-center gap-0.5 py-1.5 flex-1 transition-colors ${
              t.id === active
                ? "text-emerald-300 bg-emerald-500/5"
                : "text-neutral-600 hover:text-neutral-300"
            }`}
            title={t.label}
          >
            <t.icon className="h-3.5 w-3.5" />
            <span className="text-[9px]">{t.label}</span>
          </button>
        ))}
      </div>
      <div className="flex flex-col">{current.render()}</div>
    </div>
  );
}
