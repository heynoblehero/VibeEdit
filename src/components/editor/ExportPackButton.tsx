"use client";

import JSZip from "jszip";
import { Loader2, Package, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useProjectStore } from "@/store/project-store";

type Platform = "youtube" | "tiktok" | "shorts" | "reels";

interface Metadata {
  title: string;
  description: string;
  hashtags: string[];
}

export function ExportPackButton() {
  const project = useProjectStore((s) => s.project);
  const [open, setOpen] = useState(false);
  const [platform, setPlatform] = useState<Platform>("youtube");
  const [metadata, setMetadata] = useState<Metadata | null>(null);
  const [loading, setLoading] = useState(false);
  const [zipping, setZipping] = useState(false);

  const generate = async () => {
    setLoading(true);
    setMetadata(null);
    try {
      const sceneSummary = project.scenes
        .slice(0, 10)
        .map(
          (s, i) =>
            `${i + 1}. ${s.emphasisText || s.text || s.subtitleText || s.type}`,
        )
        .join(" | ");
      const res = await fetch("/api/export-metadata", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform,
          projectName: project.name,
          script: project.script,
          workflowName: project.workflowId,
          sceneSummary,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `metadata failed (${res.status})`);
      setMetadata(data.metadata as Metadata);
    } catch (e) {
      toast.error("Metadata failed", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setLoading(false);
    }
  };

  const downloadPack = async () => {
    if (!metadata) return;
    setZipping(true);
    try {
      // Look for the most-recently-downloaded MP4 in the render queue — not
      // reliable. Instead, prompt the user to upload the MP4 file for the pack.
      // Simpler: ask them to pick the video they already downloaded.
      const fileInput = document.createElement("input");
      fileInput.type = "file";
      fileInput.accept = "video/mp4,video/webm,image/gif";
      await new Promise<void>((resolve, reject) => {
        fileInput.onchange = () => resolve();
        fileInput.oncancel = () => reject(new Error("cancelled"));
        fileInput.click();
      });
      const videoFile = fileInput.files?.[0];
      if (!videoFile) throw new Error("no video selected");

      const zip = new JSZip();
      zip.file(`video.${videoFile.name.split(".").pop() ?? "mp4"}`, videoFile);
      const description = [
        metadata.title,
        "",
        metadata.description,
        "",
        metadata.hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" "),
      ].join("\n");
      zip.file("description.txt", description);
      zip.file(
        "metadata.json",
        JSON.stringify({ ...metadata, platform, projectName: project.name }, null, 2),
      );

      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(project.name || "vibeedit").replace(/[^\w-]+/g, "_")}-${platform}-pack.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Export pack ready");
    } catch (e) {
      if (e instanceof Error && e.message === "cancelled") return;
      toast.error("Export failed", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setZipping(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        disabled={project.scenes.length === 0}
        title="Export a platform-ready pack"
        className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-md bg-neutral-900 border border-neutral-800 text-neutral-300 hover:text-white hover:border-neutral-600 disabled:opacity-40 transition-colors"
      >
        <Package className="h-3 w-3" />
        Export
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-6">
          <div className="w-full max-w-md bg-neutral-950 border border-neutral-800 rounded-xl p-4 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-fuchsia-400" />
              <span className="text-sm font-semibold text-white">Export pack</span>
              <button
                onClick={() => setOpen(false)}
                className="ml-auto p-1 text-neutral-500 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-4 gap-1">
              {(["youtube", "tiktok", "shorts", "reels"] as Platform[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setPlatform(p)}
                  className={`text-[11px] py-1.5 rounded border transition-colors capitalize ${
                    platform === p
                      ? "border-fuchsia-500 bg-fuchsia-500/10 text-fuchsia-300"
                      : "border-neutral-700 text-neutral-400 hover:border-neutral-500"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>

            <button
              onClick={generate}
              disabled={loading}
              className="flex items-center justify-center gap-2 bg-fuchsia-600 hover:bg-fuchsia-500 disabled:opacity-50 text-white text-xs font-semibold px-3 py-1.5 rounded"
            >
              {loading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Package className="h-3.5 w-3.5" />
              )}
              {metadata ? "Regenerate metadata" : "Generate metadata"}
            </button>

            {metadata && (
              <div className="flex flex-col gap-2 bg-neutral-900 border border-neutral-800 rounded p-2">
                <div>
                  <div className="text-[10px] uppercase text-neutral-500">Title</div>
                  <input
                    className="w-full bg-transparent text-sm text-white focus:outline-none"
                    value={metadata.title}
                    onChange={(e) => setMetadata({ ...metadata, title: e.target.value })}
                  />
                </div>
                <div>
                  <div className="text-[10px] uppercase text-neutral-500">Description</div>
                  <textarea
                    className="w-full h-24 bg-transparent text-xs text-neutral-200 focus:outline-none resize-none"
                    value={metadata.description}
                    onChange={(e) => setMetadata({ ...metadata, description: e.target.value })}
                  />
                </div>
                <div>
                  <div className="text-[10px] uppercase text-neutral-500">Hashtags</div>
                  <input
                    className="w-full bg-transparent text-xs text-emerald-300 focus:outline-none"
                    value={metadata.hashtags
                      .map((h) => (h.startsWith("#") ? h : `#${h}`))
                      .join(" ")}
                    onChange={(e) =>
                      setMetadata({
                        ...metadata,
                        hashtags: e.target.value
                          .split(/\s+/)
                          .map((t) => t.replace(/^#/, ""))
                          .filter(Boolean),
                      })
                    }
                  />
                </div>
              </div>
            )}

            <button
              onClick={downloadPack}
              disabled={!metadata || zipping}
              className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold px-3 py-1.5 rounded"
            >
              {zipping ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Package className="h-3.5 w-3.5" />}
              Download pack (.zip)
            </button>
            <p className="text-[10px] text-neutral-600 leading-tight">
              You'll pick the rendered MP4; the pack includes it + description.txt + metadata.json.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
