"use client";

import { Loader2, Mic2, Trash2, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { OPENAI_VOICES } from "@/lib/voices";
import { useVoiceStore } from "@/store/voice-store";

export function VoicePacksPanel() {
  const { clones, activeVoice, refresh, setActive, removeClone } = useVoiceStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [cloneName, setCloneName] = useState("");

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", f);
      form.append("name", cloneName.trim() || `Voice ${clones.length + 1}`);
      const res = await fetch("/api/voice-clones", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `clone failed (${res.status})`);
      await refresh();
      setCloneName("");
      toast.success(`Voice "${data.voice?.name}" cloned`);
    } catch (err) {
      toast.error("Voice clone failed", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col gap-2 p-4 border-b border-neutral-800">
      <div className="flex items-center gap-2">
        <Mic2 className="h-4 w-4 text-sky-400" />
        <span className="text-sm font-semibold text-white">Voice packs</span>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-[10px] uppercase tracking-wider text-neutral-500">
          Active voice
        </span>
        <div className="flex items-center gap-1.5">
          <select
            value={
              activeVoice.kind === "openai"
                ? `openai:${activeVoice.id}`
                : `elevenlabs:${activeVoice.id}`
            }
            onChange={(e) => {
              const [kind, id] = e.target.value.split(":");
              if (kind === "openai" || kind === "elevenlabs") {
                setActive({ kind, id });
              }
            }}
            className="flex-1 bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-sky-500"
          >
            <optgroup label="OpenAI">
              {OPENAI_VOICES.map((v) => (
                <option key={v} value={`openai:${v}`}>{v}</option>
              ))}
            </optgroup>
            {clones.length > 0 && (
              <optgroup label="ElevenLabs (cloned)">
                {clones.map((c) => (
                  <option key={c.id} value={`elevenlabs:${c.id}`}>
                    {c.name}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-1 pt-1">
        <span className="text-[10px] uppercase tracking-wider text-neutral-500">
          Clone your voice
        </span>
        <input
          type="text"
          value={cloneName}
          onChange={(e) => setCloneName(e.target.value)}
          placeholder="voice name"
          className="bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-sky-500"
        />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="flex items-center justify-center gap-2 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-xs font-semibold px-3 py-1.5 rounded transition-colors"
        >
          {uploading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Upload className="h-3.5 w-3.5" />
          )}
          Upload 30s sample
        </button>
        <span className="text-[9px] text-neutral-600 leading-tight">
          Uploads to ElevenLabs. Needs ELEVENLABS_API_KEY on the server.
        </span>
        <input
          ref={fileRef}
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={handleFile}
        />
      </div>

      {clones.length > 0 && (
        <div className="flex flex-col gap-1 pt-1">
          <span className="text-[10px] uppercase tracking-wider text-neutral-500">
            My clones
          </span>
          {clones.map((c) => (
            <div
              key={c.id}
              className="flex items-center gap-2 text-xs text-neutral-300 bg-neutral-900 border border-neutral-800 rounded px-2 py-1"
            >
              <span className="truncate flex-1">{c.name}</span>
              <button
                onClick={() => removeClone(c.id)}
                className="p-1 text-neutral-500 hover:text-red-400 transition-colors"
                title="Delete clone"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
