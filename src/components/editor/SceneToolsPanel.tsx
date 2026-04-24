"use client";

import { Film, Loader2, Mic, User } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { type Voiceover } from "@/lib/scene-schema";
import { getWorkflow } from "@/lib/workflows/registry";
import { useAssetStore } from "@/store/asset-store";
import { useBRollStore } from "@/store/broll-store";
import { useProjectStore } from "@/store/project-store";
import { useVoiceStore } from "@/store/voice-store";

export function SceneToolsPanel() {
  const project = useProjectStore((s) => s.project);
  const workflow = getWorkflow(project.workflowId);
  // Poses only make sense for workflows with a character concept (faceless).
  const showPoses = workflow.sceneEditorTargets?.includes("character") ?? true;
  const setSceneVoiceover = useProjectStore((s) => s.setSceneVoiceover);
  const updateScene = useProjectStore((s) => s.updateScene);
  const { characters, sfx } = useAssetStore();
  const setSuggestions = useBRollStore((s) => s.setSuggestions);
  const brollLoading = useBRollStore((s) => s.isLoading);
  const setBrollLoading = useBRollStore((s) => s.setLoading);

  const [isNarrating, setIsNarrating] = useState(false);
  const [isSuggestingPoses, setIsSuggestingPoses] = useState(false);
  const activeVoice = useVoiceStore((s) => s.activeVoice);

  const handleNarrateAll = async () => {
    if (project.scenes.length === 0) return;
    setIsNarrating(true);
    const toastId = toast.loading("Narrating scenes...");
    let ok = 0;
    let fail = 0;
    try {
      for (let i = 0; i < project.scenes.length; i++) {
        const scene = project.scenes[i];
        const text = [scene.text, scene.emphasisText, scene.subtitleText]
          .filter(Boolean)
          .join(" ")
          .trim();
        if (!text) continue;
        toast.loading(`Narrating ${i + 1}/${project.scenes.length}...`, { id: toastId });
        try {
          // Speaker-aware: if the scene was tagged with a speaker (e.g. comic
          // dub workflow), pick a voice based on that speaker so the same
          // character consistently gets the same voice. Fall back to the
          // globally-active voice otherwise.
          const speaker = scene.voiceover?.speaker;
          let voiceId: string = activeVoice.id;
          let voiceKind: "openai" | "elevenlabs" = activeVoice.kind;
          if (speaker) {
            const narratorVoice = String(
              project.workflowInputs?.narrationVoice ?? "onyx",
            );
            const fallbackPool = ["alloy", "echo", "fable", "nova", "shimmer"];
            if (speaker === "narrator" || speaker === "sfx") {
              voiceId = narratorVoice;
              voiceKind = "openai";
            } else {
              let hash = 0;
              for (let k = 0; k < speaker.length; k++) {
                hash = (hash * 31 + speaker.charCodeAt(k)) >>> 0;
              }
              voiceId = fallbackPool[hash % fallbackPool.length];
              voiceKind = "openai";
            }
          }
          const body =
            voiceKind === "elevenlabs"
              ? { text, elevenLabsVoiceId: voiceId }
              : { text, voice: voiceId };
          const res = await fetch("/api/voiceover", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error ?? `voiceover failed (${res.status})`);
          const vo: Voiceover = {
            audioUrl: data.audioUrl,
            audioDurationSec: data.audioDurationSec,
            provider: voiceKind,
            voice: voiceId,
            text,
            speaker,
          };
          setSceneVoiceover(scene.id, vo);
          ok++;
        } catch (e) {
          console.error("narrate scene failed:", e);
          fail++;
        }
      }
      if (fail === 0) {
        toast.success(`Narrated ${ok} scenes`, { id: toastId });
      } else {
        toast.warning(`Narrated ${ok}/${ok + fail} scenes`, {
          id: toastId,
          description: `${fail} scene${fail === 1 ? "" : "s"} failed`,
        });
      }
    } finally {
      setIsNarrating(false);
    }
  };

  const handleSuggestPoses = async () => {
    if (project.scenes.length === 0 || characters.length === 0) return;
    setIsSuggestingPoses(true);
    const toastId = toast.loading("Choosing best poses...");
    try {
      const res = await fetch("/api/pose-suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenes: project.scenes.map((s) => ({
            id: s.id,
            text: [s.text, s.emphasisText, s.subtitleText].filter(Boolean).join(" "),
            type: s.type,
          })),
          availablePoses: characters.map((c) => c.id),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `pose suggest failed (${res.status})`);
      const picks = (data.picks ?? []) as Array<{ sceneId: string; characterId: string; flipCharacter?: boolean }>;
      let applied = 0;
      for (const p of picks) {
        if (characters.some((c) => c.id === p.characterId)) {
          updateScene(p.sceneId, {
            characterId: p.characterId,
            flipCharacter: p.flipCharacter,
          });
          applied++;
        }
      }
      toast.success(`Suggested poses for ${applied} scenes`, { id: toastId });
    } catch (e) {
      toast.error("Pose suggest failed", {
        id: toastId,
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setIsSuggestingPoses(false);
    }
  };

  const handleSuggestBroll = async () => {
    if (project.scenes.length === 0) return;
    setBrollLoading(true);
    try {
      const res = await fetch("/api/broll/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenes: project.scenes.map((s) => ({
            id: s.id,
            text: s.text || s.emphasisText || s.subtitleText || "",
            durationSec: s.duration,
          })),
        }),
      });
      const data = await res.json();
      if (data.suggestions) {
        setSuggestions(data.suggestions);
        toast.success(`B-roll suggestions ready for ${data.suggestions.length} scenes`);
      } else if (data.error) {
        toast.error(data.error);
      }
    } catch (e) {
      toast.error("B-roll suggest failed", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setBrollLoading(false);
    }
  };

  if (project.scenes.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 p-4 border-b border-neutral-800">
      <span className="text-[10px] uppercase tracking-wider text-neutral-500 font-medium">
        Scene tools
      </span>
      <button
        onClick={handleNarrateAll}
        disabled={isNarrating}
        className="flex items-center gap-2 justify-center bg-sky-600 hover:bg-sky-500 disabled:bg-neutral-800 disabled:text-neutral-500 text-white text-xs font-semibold px-3 py-1.5 rounded transition-colors"
      >
        {isNarrating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mic className="h-3.5 w-3.5" />}
        Narrate all ({activeVoice.kind === "elevenlabs" ? "cloned voice" : activeVoice.id})
      </button>
      {showPoses && (
        <button
          onClick={handleSuggestPoses}
          disabled={isSuggestingPoses || characters.length === 0}
          className="flex items-center gap-2 justify-center bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 disabled:opacity-50 text-neutral-300 text-xs font-medium px-3 py-1.5 rounded transition-colors"
        >
          {isSuggestingPoses ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <User className="h-3.5 w-3.5" />}
          Suggest poses
        </button>
      )}
      <button
        onClick={handleSuggestBroll}
        disabled={brollLoading}
        className="flex items-center gap-2 justify-center bg-pink-600 hover:bg-pink-500 disabled:bg-neutral-800 disabled:text-neutral-500 text-white text-xs font-semibold px-3 py-1.5 rounded transition-colors"
      >
        {brollLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Film className="h-3.5 w-3.5" />}
        Suggest B-roll
      </button>
    </div>
  );
}
