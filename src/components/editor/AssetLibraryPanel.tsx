"use client";

import { Library, Music, Trash2, Upload, Video, Volume2 } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  useAssetLibraryStore,
  type LibraryAssetKind,
} from "@/store/asset-library-store";
import { useProjectStore } from "@/store/project-store";

const KIND_ICON: Record<LibraryAssetKind, typeof Music> = {
  music: Music,
  sfx: Volume2,
  clip: Video,
  image: Library,
};

export function AssetLibraryPanel() {
  const assets = useAssetLibraryStore((s) => s.assets);
  const add = useAssetLibraryStore((s) => s.add);
  const remove = useAssetLibraryStore((s) => s.remove);
  const setMusic = useProjectStore((s) => s.setMusic);

  const [uploadKind, setUploadKind] = useState<LibraryAssetKind>("music");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", f);
      const res = await fetch("/api/assets/upload", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `upload failed (${res.status})`);
      add({
        kind: uploadKind,
        url: data.url,
        name: f.name,
        tags: [],
        bytes: data.bytes,
      });
      toast.success(`Added to library`);
    } catch (err) {
      toast.error("Upload failed", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setUploading(false);
    }
  };

  const useInProject = (assetId: string) => {
    const asset = assets.find((a) => a.id === assetId);
    if (!asset) return;
    if (asset.kind === "music") {
      setMusic({
        url: asset.url,
        name: asset.name,
        volume: 0.55,
        duckedVolume: 0.18,
      });
      toast.success(`"${asset.name}" set as music bed`);
    } else {
      // Copy the URL so the user can paste it where useful.
      navigator.clipboard?.writeText(asset.url).catch(() => {});
      toast.success(`URL copied`, {
        description: "Paste into a clip / image slot or use an upload flow.",
      });
    }
  };

  return (
    <div className="flex flex-col gap-2 p-4 border-b border-neutral-800">
      <div className="flex items-center gap-2">
        <Library className="h-4 w-4 text-emerald-400" />
        <span className="text-sm font-semibold text-white">Asset library</span>
        <span className="text-[10px] text-neutral-500 ml-auto">{assets.length}</span>
      </div>
      <p className="text-[10px] text-neutral-600 leading-tight">
        Reusable music / SFX / B-roll across every project.
      </p>
      <div className="flex items-center gap-1.5">
        <select
          value={uploadKind}
          onChange={(e) => setUploadKind(e.target.value as LibraryAssetKind)}
          className="bg-neutral-900 border border-neutral-700 rounded px-1.5 py-1 text-[11px] text-white focus:outline-none"
        >
          <option value="music">Music</option>
          <option value="sfx">SFX</option>
          <option value="clip">Clip</option>
          <option value="image">Image</option>
        </select>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="flex-1 flex items-center justify-center gap-1 text-[11px] bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 px-2 py-1 rounded transition-colors disabled:opacity-50"
        >
          <Upload className="h-3 w-3" />
          Add
        </button>
        <input
          ref={fileRef}
          type="file"
          className="hidden"
          accept={
            uploadKind === "music" || uploadKind === "sfx"
              ? "audio/*"
              : uploadKind === "clip"
                ? "video/*"
                : "image/*"
          }
          onChange={handleFile}
        />
      </div>
      {assets.length > 0 && (
        <div className="flex flex-col gap-1 max-h-64 overflow-y-auto">
          {assets.map((a) => {
            const Icon = KIND_ICON[a.kind];
            return (
              <div
                key={a.id}
                className="group flex items-center gap-2 bg-neutral-900 border border-neutral-800 rounded px-2 py-1"
              >
                <Icon className="h-3 w-3 text-neutral-500 shrink-0" />
                <button
                  onClick={() => useInProject(a.id)}
                  className="flex-1 min-w-0 text-left text-xs text-white hover:text-emerald-300 truncate"
                  title={a.kind === "music" ? "Set as music bed" : "Copy URL"}
                >
                  {a.name}
                </button>
                <span className="text-[9px] text-neutral-600">{a.kind}</span>
                <button
                  onClick={() => remove(a.id)}
                  className="opacity-0 group-hover:opacity-100 p-0.5 text-neutral-500 hover:text-red-400 transition-all"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
