"use client";

import { Loader2, Music, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { useProjectStore } from "@/store/project-store";

export function MusicPanel() {
  const music = useProjectStore((s) => s.project.music);
  const setMusic = useProjectStore((s) => s.setMusic);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/music/upload", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `upload failed (${res.status})`);
      setMusic({
        url: data.url,
        name: data.name,
        volume: music?.volume ?? 0.55,
        duckedVolume: music?.duckedVolume ?? 0.18,
      });
      toast.success(`Music added: ${data.name}`);
    } catch (err) {
      toast.error("Upload failed", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setUploading(false);
    }
  };

  const handleClear = () => {
    setMusic(undefined);
    toast.success("Music removed");
  };

  return (
    <div className="flex flex-col gap-2 p-4 border-b border-neutral-800">
      <div className="flex items-center gap-2">
        <Music className="h-4 w-4 text-pink-400" />
        <span className="text-sm font-semibold text-white">Music bed</span>
      </div>
      {music ? (
        <>
          <div className="flex items-center gap-2 text-xs text-neutral-300 truncate">
            <span className="truncate flex-1">{music.name}</span>
            <button
              onClick={handleClear}
              className="p-1 text-neutral-500 hover:text-red-400 transition-colors"
              title="Remove music"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
          <audio
            src={music.url}
            controls
            className="w-full h-7"
            preload="metadata"
          />
          <div className="flex items-center gap-2">
            <label className="text-[10px] text-neutral-500 w-12">Base</label>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={music.volume}
              onChange={(e) =>
                setMusic({ ...music, volume: Number(e.target.value) })
              }
              className="flex-1 accent-pink-500 h-1"
            />
            <span className="text-[11px] text-white font-mono w-8">
              {Math.round(music.volume * 100)}%
            </span>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[10px] text-neutral-500 w-12">Ducked</label>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={music.duckedVolume}
              onChange={(e) =>
                setMusic({ ...music, duckedVolume: Number(e.target.value) })
              }
              className="flex-1 accent-pink-500 h-1"
            />
            <span className="text-[11px] text-white font-mono w-8">
              {Math.round(music.duckedVolume * 100)}%
            </span>
          </div>
          <span className="text-[9px] text-neutral-600 leading-tight">
            "Ducked" volume plays while a scene has a voiceover. "Base" plays otherwise.
          </span>
        </>
      ) : (
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="flex items-center justify-center gap-2 bg-neutral-900 hover:bg-neutral-800 disabled:opacity-50 border border-neutral-800 text-neutral-300 text-xs font-medium px-3 py-2 rounded-lg transition-colors"
        >
          {uploading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Upload className="h-3.5 w-3.5" />
          )}
          Upload music (MP3/WAV)
        </button>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="audio/mpeg,audio/wav,audio/mp4,audio/ogg,.mp3,.wav,.m4a,.ogg"
        className="hidden"
        onChange={handleFile}
      />
    </div>
  );
}
