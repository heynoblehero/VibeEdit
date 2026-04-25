"use client";

import { useEffect, useState } from "react";

interface Voice {
  id: string;
  provider: string;
  name: string;
  description: string;
  tags: string[];
  costPer1kChars: number;
}

// Per-scene voice override stored in localStorage. Same pattern as
// MediaModelPicker. The agent reads this hint when narrateScene is called.
export function VoicePicker({ sceneId }: { sceneId: string }) {
  const [voices, setVoices] = useState<Voice[]>([]);
  const storageKey = `vibeedit:scene:${sceneId}:voiceId`;
  const [picked, setPicked] = useState<string>("");

  useEffect(() => {
    fetch("/api/media/voices")
      .then((r) => r.json())
      .then((d) => setVoices(d.voices ?? []))
      .catch(() => {});
    try {
      setPicked(window.localStorage.getItem(storageKey) ?? "");
    } catch {}
  }, [storageKey]);

  if (voices.length === 0) return null;

  return (
    <div className="flex items-center gap-1.5 text-[11px] text-neutral-500">
      <span className="uppercase tracking-wider">voice</span>
      <select
        value={picked}
        onChange={(e) => {
          const v = e.target.value;
          setPicked(v);
          try {
            if (v) window.localStorage.setItem(storageKey, v);
            else window.localStorage.removeItem(storageKey);
          } catch {}
        }}
        className="flex-1 bg-neutral-900 border border-neutral-700 rounded px-1 py-0.5 text-[11px] text-white focus:outline-none focus:border-emerald-500"
      >
        <option value="">Auto (project default)</option>
        {voices.map((v) => (
          <option key={v.id} value={v.id} title={v.description}>
            {v.name} · {v.tags[0]}
          </option>
        ))}
      </select>
    </div>
  );
}
