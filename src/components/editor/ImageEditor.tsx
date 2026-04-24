"use client";

import { RotateCcw, X } from "lucide-react";
import { useMemo } from "react";
import type { BRoll, ImageFilter } from "@/lib/scene-schema";
import { useEditorStore } from "@/store/editor-store";
import { useProjectStore } from "@/store/project-store";

function filterCss(f?: ImageFilter): string {
  if (!f) return "none";
  const parts: string[] = [];
  if (f.brightness != null) parts.push(`brightness(${f.brightness})`);
  if (f.contrast != null) parts.push(`contrast(${f.contrast})`);
  if (f.saturation != null) parts.push(`saturate(${f.saturation})`);
  if (f.blur != null) parts.push(`blur(${f.blur}px)`);
  if (f.grayscale != null) parts.push(`grayscale(${f.grayscale})`);
  return parts.length ? parts.join(" ") : "none";
}

export function ImageEditor() {
  const brollId = useEditorStore((s) => s.imageEditorBRollId);
  const close = useEditorStore((s) => s.openImageEditor);
  const scenes = useProjectStore((s) => s.project.scenes);
  const updateBRoll = useProjectStore((s) => s.updateBRoll);

  const found = useMemo(() => {
    if (!brollId) return null;
    for (const sc of scenes) {
      const b = (sc.broll ?? []).find((x) => x.id === brollId);
      if (b) return { scene: sc, broll: b };
    }
    return null;
  }, [brollId, scenes]);

  if (!brollId || !found) return null;
  const { scene, broll } = found;

  const patch = (p: Partial<BRoll>) => updateBRoll(scene.id, broll.id, p);
  const patchFilter = (f: Partial<ImageFilter>) =>
    patch({ filter: { ...(broll.filter ?? {}), ...f } });

  const reset = () =>
    patch({ filter: {}, offsetX: 0, offsetY: 0, scale: 1, opacity: 1 });

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-6"
      onClick={() => close(null)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-neutral-950 border border-neutral-800 rounded-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col"
      >
        <div className="flex items-center justify-between p-4 border-b border-neutral-800">
          <div>
            <div className="text-sm font-semibold text-white">Edit image</div>
            <div className="text-[10px] text-neutral-500 capitalize">
              {broll.kind} · {broll.source} · {broll.position}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={reset}
              className="flex items-center gap-1 text-[10px] text-neutral-400 hover:text-white px-2 py-1 rounded-md border border-neutral-800 hover:border-neutral-600 transition-colors"
            >
              <RotateCcw className="h-3 w-3" /> Reset
            </button>
            <button
              onClick={() => close(null)}
              className="p-1 text-neutral-400 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-[1fr_280px] gap-4 p-4 flex-1 overflow-hidden">
          <div className="bg-black rounded-lg overflow-hidden flex items-center justify-center min-h-[300px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={broll.url}
              alt=""
              style={{
                maxWidth: "100%",
                maxHeight: "55vh",
                filter: filterCss(broll.filter),
                transform: `translate(${broll.offsetX ?? 0}px, ${broll.offsetY ?? 0}px) scale(${broll.scale ?? 1})`,
                opacity: broll.opacity ?? 1,
                transformOrigin: "center center",
              }}
            />
          </div>

          <div className="space-y-3 overflow-y-auto pr-1">
            <Section label="Filters">
              <Slider
                label="Brightness"
                min={0}
                max={2}
                step={0.05}
                value={broll.filter?.brightness ?? 1}
                onChange={(v) => patchFilter({ brightness: v })}
              />
              <Slider
                label="Contrast"
                min={0}
                max={2}
                step={0.05}
                value={broll.filter?.contrast ?? 1}
                onChange={(v) => patchFilter({ contrast: v })}
              />
              <Slider
                label="Saturation"
                min={0}
                max={2}
                step={0.05}
                value={broll.filter?.saturation ?? 1}
                onChange={(v) => patchFilter({ saturation: v })}
              />
              <Slider
                label="Blur"
                min={0}
                max={20}
                step={0.5}
                value={broll.filter?.blur ?? 0}
                onChange={(v) => patchFilter({ blur: v })}
              />
              <Slider
                label="Grayscale"
                min={0}
                max={1}
                step={0.05}
                value={broll.filter?.grayscale ?? 0}
                onChange={(v) => patchFilter({ grayscale: v })}
              />
            </Section>

            <Section label="Transform">
              <Slider
                label="Scale"
                min={0.5}
                max={2}
                step={0.05}
                value={broll.scale ?? 1}
                onChange={(v) => patch({ scale: v })}
              />
              <Slider
                label="Offset X"
                min={-400}
                max={400}
                step={5}
                value={broll.offsetX ?? 0}
                onChange={(v) => patch({ offsetX: v })}
              />
              <Slider
                label="Offset Y"
                min={-400}
                max={400}
                step={5}
                value={broll.offsetY ?? 0}
                onChange={(v) => patch({ offsetY: v })}
              />
              <Slider
                label="Opacity"
                min={0}
                max={1}
                step={0.05}
                value={broll.opacity ?? 1}
                onChange={(v) => patch({ opacity: v })}
              />
            </Section>

            <div className="flex gap-1 flex-wrap">
              {PRESETS.map((p) => (
                <button
                  key={p.name}
                  onClick={() => patch({ filter: p.filter })}
                  className="text-[10px] px-2 py-1 rounded-md border border-neutral-800 hover:border-emerald-500 text-neutral-300 transition-colors"
                >
                  {p.name}
                </button>
              ))}
            </div>

            {broll.attribution && (
              <div className="text-[9px] text-neutral-600 pt-2 border-t border-neutral-800">
                {broll.attribution}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="text-[10px] uppercase tracking-wider text-neutral-500 font-medium">
        {label}
      </div>
      {children}
    </div>
  );
}

function Slider({
  label,
  min,
  max,
  step,
  value,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex justify-between text-[10px] text-neutral-400 mb-0.5">
        <span>{label}</span>
        <span className="font-mono text-neutral-500">{value.toFixed(2)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-emerald-500 h-1"
      />
    </div>
  );
}

const PRESETS: Array<{ name: string; filter: ImageFilter }> = [
  { name: "None", filter: {} },
  { name: "Pop", filter: { contrast: 1.2, saturation: 1.3 } },
  { name: "Moody", filter: { brightness: 0.85, contrast: 1.15, saturation: 0.8 } },
  { name: "B&W", filter: { grayscale: 1, contrast: 1.1 } },
  { name: "Dreamy", filter: { blur: 1.5, brightness: 1.1, saturation: 1.1 } },
  { name: "Warm", filter: { brightness: 1.05, saturation: 1.2, contrast: 1.05 } },
];
