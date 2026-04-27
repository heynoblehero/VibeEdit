"use client";

import { Copy, Loader2, Mic, RefreshCw, Trash2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { type Voiceover } from "@/lib/scene-schema";
import { useProjectStore } from "@/store/project-store";
import { useVoiceStore } from "@/store/voice-store";

export function BulkActionsBar() {
  const selectedIds = useProjectStore((s) => s.selectedSceneIds);
  const scenes = useProjectStore((s) => s.project.scenes);
  const removeScenes = useProjectStore((s) => s.removeScenes);
  const duplicateScene = useProjectStore((s) => s.duplicateScene);
  const updateScene = useProjectStore((s) => s.updateScene);
  const setSceneVoiceover = useProjectStore((s) => s.setSceneVoiceover);
  const clearSelection = useProjectStore((s) => s.clearSelection);
  const activeVoice = useVoiceStore((s) => s.activeVoice);
  const [running, setRunning] = useState<string | null>(null);

  if (selectedIds.length < 2) return null;

  const selectedScenes = scenes.filter((s) => selectedIds.includes(s.id));

  const bulkDuplicate = () => {
    // Duplicate in order so the new set follows the originals.
    for (const id of selectedIds) duplicateScene(id);
    toast.success(`Duplicated ${selectedIds.length} scenes`);
  };

  const bulkDelete = () => {
    removeScenes(selectedIds);
    toast.success(`Deleted ${selectedIds.length} scenes`);
  };

  const bulkRefine = async (instruction: string) => {
    setRunning(instruction);
    const toastId = toast.loading(`${instruction}...`);
    let ok = 0;
    let fail = 0;
    for (const scene of selectedScenes) {
      try {
        const res = await fetch("/api/refine", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scene, instruction }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "refine failed");
        if (data.patch) updateScene(scene.id, data.patch);
        ok++;
      } catch {
        fail++;
      }
    }
    toast.success(`${instruction} applied to ${ok}/${ok + fail}`, { id: toastId });
    setRunning(null);
  };

  const bulkNarrate = async () => {
    setRunning("narrate");
    const toastId = toast.loading(`Narrating ${selectedScenes.length}...`);
    let ok = 0;
    let fail = 0;
    for (let i = 0; i < selectedScenes.length; i++) {
      const scene = selectedScenes[i];
      const text = [scene.text, scene.emphasisText, scene.subtitleText]
        .filter(Boolean)
        .join(" ")
        .trim();
      if (!text) continue;
      toast.loading(`Narrating ${i + 1}/${selectedScenes.length}...`, { id: toastId });
      try {
        const body =
          activeVoice.kind === "elevenlabs"
            ? { text, elevenLabsVoiceId: activeVoice.id }
            : { text, voice: activeVoice.id };
        const res = await fetch("/api/voiceover", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "voiceover failed");
        const vo: Voiceover = {
          audioUrl: data.audioUrl,
          audioDurationSec: data.audioDurationSec,
          provider: activeVoice.kind,
          voice: activeVoice.id,
          text,
        };
        setSceneVoiceover(scene.id, vo);
        ok++;
      } catch {
        fail++;
      }
    }
    toast.success(`Narrated ${ok}/${ok + fail}`, { id: toastId });
    setRunning(null);
  };

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 bg-neutral-950 border border-emerald-500/40 rounded-full shadow-xl px-3 py-1.5">
      <span className="text-[11px] text-emerald-300 font-semibold">
        {selectedIds.length} selected
        <span className="text-emerald-500/70 font-mono ml-1.5">
          {(() => {
            const total = selectedScenes.reduce((s, sc) => s + sc.duration, 0);
            return `${total.toFixed(1)}s`;
          })()}
        </span>
      </span>
      <div className="h-4 w-px bg-neutral-800" />
      <button
        onClick={bulkDuplicate}
        className="flex items-center gap-1 text-[11px] text-neutral-300 hover:text-white px-2 py-0.5 rounded transition-colors"
        title="Duplicate"
      >
        <Copy className="h-3 w-3" />
        Duplicate
      </button>
      <button
        onClick={bulkNarrate}
        disabled={running === "narrate"}
        className="flex items-center gap-1 text-[11px] text-sky-300 hover:text-sky-200 px-2 py-0.5 rounded transition-colors disabled:opacity-50"
        title="Narrate all selected"
      >
        {running === "narrate" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Mic className="h-3 w-3" />}
        Narrate
      </button>
      <button
        onClick={() => bulkRefine("make it punchier")}
        disabled={!!running}
        className="flex items-center gap-1 text-[11px] text-purple-300 hover:text-purple-200 px-2 py-0.5 rounded transition-colors disabled:opacity-50"
        title="AI refine: punchier"
      >
        {running === "make it punchier" ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
        Punchier
      </button>
      <button
        onClick={bulkDelete}
        className="flex items-center gap-1 text-[11px] text-red-400 hover:text-red-300 px-2 py-0.5 rounded transition-colors"
        title="Delete"
      >
        <Trash2 className="h-3 w-3" />
        Delete
      </button>
      <div className="h-4 w-px bg-neutral-800" />
      <button
        onClick={clearSelection}
        className="p-1 text-neutral-500 hover:text-white transition-colors"
        title="Clear selection"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}
