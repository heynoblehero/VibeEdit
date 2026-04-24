"use client";

import { ImagePlus, Trash2, Upload, Users } from "lucide-react";
import { useCallback, useRef } from "react";
import { useAssetStore } from "@/store/asset-store";

export function AssetPanel() {
  const { characters, addCharacter, removeCharacter } = useAssetStore();
  const inputRef = useRef<HTMLInputElement>(null);

  const handleUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files) return;
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/")) continue;
        const url = URL.createObjectURL(file);
        const name = file.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " ");
        addCharacter({
          id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          name,
          src: url,
        });
      }
      e.target.value = "";
    },
    [addCharacter],
  );

  return (
    <div className="p-3 border-b border-neutral-800">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Users className="h-3.5 w-3.5 text-emerald-400" />
          <span className="text-xs font-semibold text-white">Characters</span>
          <span className="text-[10px] text-neutral-500">{characters.length}</span>
        </div>
        <button
          onClick={() => inputRef.current?.click()}
          className="flex items-center gap-1 text-[10px] text-emerald-400 hover:text-emerald-300"
        >
          <ImagePlus className="h-3 w-3" /> Upload
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/webp"
          multiple
          onChange={handleUpload}
          className="hidden"
        />
      </div>
      <div className="flex flex-wrap gap-1.5">
        {characters.map((c) => (
          <div
            key={c.id}
            className="group relative w-10 h-10 rounded border border-neutral-700 overflow-hidden bg-neutral-900 hover:border-emerald-500 transition-colors"
            title={c.name}
          >
            <img src={c.src} alt={c.name} className="w-full h-full object-contain" />
            <button
              onClick={() => removeCharacter(c.id)}
              className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
            >
              <Trash2 className="h-3 w-3 text-red-400" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
