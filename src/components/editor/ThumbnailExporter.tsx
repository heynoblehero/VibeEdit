"use client";

import { Download, Image as ImageIcon, Loader2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { getOrientation, sceneDurationFrames } from "@/lib/scene-schema";
import { useAssetStore } from "@/store/asset-store";
import { useProjectStore } from "@/store/project-store";

export function ThumbnailExporter() {
  const project = useProjectStore((s) => s.project);
  const characters = useAssetStore((s) => s.characters);
  const sfx = useAssetStore((s) => s.sfx);
  const orientation = getOrientation(project);

  const [open, setOpen] = useState(false);
  const [sceneId, setSceneId] = useState<string>(() => project.scenes[0]?.id ?? "");
  const [frame, setFrame] = useState(18);
  const [headline, setHeadline] = useState("");
  const [color, setColor] = useState("#ffffff");
  const [fontSize, setFontSize] = useState(120);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (open && !sceneId && project.scenes[0]) {
      setSceneId(project.scenes[0].id);
    }
  }, [open, sceneId, project.scenes]);

  // ⌘⇧E opens the thumbnail dialog. Wired here so the button can stay
  // in HeaderOverflow without being unconditionally mounted.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey && e.shiftKey && e.key.toLowerCase() === "e") {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const scene = useMemo(
    () => project.scenes.find((s) => s.id === sceneId),
    [project.scenes, sceneId],
  );
  const maxFrame = scene ? Math.max(0, sceneDurationFrames(scene, project.fps) - 1) : 0;

  const fetchPreview = useCallback(async () => {
    if (!scene) return;
    setLoadingPreview(true);
    try {
      const charMap: Record<string, string> = {};
      for (const c of characters) charMap[c.id] = c.src;
      const sfxMap: Record<string, string> = {};
      for (const s of sfx) sfxMap[s.id] = s.src;
      const res = await fetch("/api/thumbnail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scene,
          width: project.width,
          height: project.height,
          fps: project.fps,
          characters: charMap,
          sfx: sfxMap,
          orientation,
          frame,
          scale: 1,
        }),
      });
      if (!res.ok) throw new Error(`thumbnail failed ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
    } catch (e) {
      toast.error("Preview failed", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setLoadingPreview(false);
    }
  }, [scene, project.width, project.height, project.fps, characters, sfx, orientation, frame]);

  useEffect(() => {
    if (!open || !scene) return;
    fetchPreview();
  }, [open, scene, frame, fetchPreview]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleExport = async () => {
    if (!previewUrl || !canvasRef.current) return;
    setExporting(true);
    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("preview load failed"));
        img.src = previewUrl;
      });
      const canvas = canvasRef.current!;
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("no 2d context");
      ctx.drawImage(img, 0, 0);

      if (headline.trim()) {
        const fs = fontSize * (canvas.width / 1920);
        ctx.font = `bold ${fs}px Geist, system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const x = canvas.width / 2;
        const y = canvas.height - fs * 1.5;
        ctx.lineWidth = fs * 0.12;
        ctx.strokeStyle = "#000";
        ctx.fillStyle = color;
        ctx.lineJoin = "round";
        ctx.strokeText(headline.toUpperCase(), x, y);
        ctx.fillText(headline.toUpperCase(), x, y);
      }

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/png"),
      );
      if (!blob) throw new Error("canvas toBlob failed");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(project.name || "vibeedit").replace(/[^\w-]+/g, "_")}-thumbnail.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Thumbnail exported");
    } catch (e) {
      toast.error("Export failed", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        disabled={project.scenes.length === 0}
        title="Make a thumbnail"
        className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-md bg-neutral-900 border border-neutral-800 text-neutral-300 hover:text-white hover:border-neutral-600 disabled:opacity-40 transition-colors"
      >
        <ImageIcon className="h-3 w-3" />
        Thumbnail
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-6">
          <div className="w-full max-w-3xl bg-neutral-950 border border-neutral-800 rounded-xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-4 py-2 border-b border-neutral-800">
              <div className="flex items-center gap-2">
                <ImageIcon className="h-4 w-4 text-emerald-400" />
                <span className="text-sm font-semibold text-white">Thumbnail</span>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-1 text-neutral-500 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4 grid grid-cols-[1fr_280px] gap-4">
              <div className="flex items-center justify-center bg-black rounded-lg overflow-hidden min-h-[300px] relative">
                {previewUrl ? (
                  <div className="relative w-full h-full flex items-center justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={previewUrl}
                      alt=""
                      className="max-w-full max-h-[60vh] object-contain"
                    />
                    {headline.trim() && (
                      <div
                        className="absolute left-0 right-0 bottom-6 text-center pointer-events-none px-6"
                        style={{
                          color,
                          fontWeight: 800,
                          fontSize: `${fontSize / 20}px`,
                          textShadow:
                            "-2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000",
                          textTransform: "uppercase",
                        }}
                      >
                        {headline}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-neutral-600 text-sm flex items-center gap-2">
                    {loadingPreview ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> Rendering frame...
                      </>
                    ) : (
                      "pick a scene to preview"
                    )}
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] uppercase tracking-wider text-neutral-500 font-medium">
                    Scene
                  </label>
                  <select
                    value={sceneId}
                    onChange={(e) => {
                      setSceneId(e.target.value);
                      setFrame(18);
                    }}
                    className="bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-emerald-500"
                  >
                    {project.scenes.map((s, i) => (
                      <option key={s.id} value={s.id}>
                        {i + 1}. {s.emphasisText || s.text || s.type}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] uppercase tracking-wider text-neutral-500 font-medium">
                    Frame: {frame} / {maxFrame}
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={maxFrame}
                    value={frame}
                    onChange={(e) => setFrame(Number(e.target.value))}
                    className="accent-emerald-500"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] uppercase tracking-wider text-neutral-500 font-medium">
                    Headline
                  </label>
                  <input
                    type="text"
                    value={headline}
                    onChange={(e) => setHeadline(e.target.value)}
                    placeholder="YOUR HEADLINE"
                    className="bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] uppercase tracking-wider text-neutral-500 font-medium">
                      Color
                    </label>
                    <input
                      type="color"
                      value={color}
                      onChange={(e) => setColor(e.target.value)}
                      className="h-7 w-full rounded cursor-pointer bg-transparent border border-neutral-700"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] uppercase tracking-wider text-neutral-500 font-medium">
                      Size: {fontSize}
                    </label>
                    <input
                      type="range"
                      min={60}
                      max={260}
                      value={fontSize}
                      onChange={(e) => setFontSize(Number(e.target.value))}
                      className="accent-emerald-500"
                    />
                  </div>
                </div>
                <button
                  onClick={handleExport}
                  disabled={exporting || !previewUrl}
                  className="mt-2 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-neutral-700 disabled:text-neutral-500 text-white text-xs font-semibold px-3 py-2 rounded-md transition-colors"
                >
                  {exporting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Download className="h-3.5 w-3.5" />
                  )}
                  Export PNG
                </button>
                <canvas ref={canvasRef} className="hidden" />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
