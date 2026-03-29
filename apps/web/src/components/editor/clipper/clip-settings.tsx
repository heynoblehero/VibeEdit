"use client";

import { useClipperStore } from "@/stores/clipper-store";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import type { ClipPlatform, CaptionStyle } from "@/types/clipper";
import { PLATFORM_SPECS } from "@/types/clipper";
import {
  Clock,
  Hash,
  MessageSquare,
  Type,
  MonitorSmartphone,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Platform option data                                               */
/* ------------------------------------------------------------------ */

const PLATFORM_OPTIONS: { value: ClipPlatform; label: string }[] = [
  { value: "tiktok", label: PLATFORM_SPECS["tiktok"].label },
  { value: "youtube-shorts", label: PLATFORM_SPECS["youtube-shorts"].label },
  { value: "instagram-reels", label: PLATFORM_SPECS["instagram-reels"].label },
];

const CAPTION_POSITIONS: { value: CaptionStyle["position"]; label: string }[] = [
  { value: "top", label: "Top" },
  { value: "center", label: "Center" },
  { value: "bottom", label: "Bottom" },
];

/* ------------------------------------------------------------------ */
/*  Slider row                                                         */
/* ------------------------------------------------------------------ */

function SettingsSliderRow({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  unit = "",
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  unit?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-muted-foreground w-28 shrink-0">
        {label}
      </span>
      <Slider
        className="flex-1"
        min={min}
        max={max}
        step={step}
        value={[value]}
        onValueChange={([v]) => onChange(v)}
      />
      <span className="text-xs text-muted-foreground tabular-nums w-12 text-right">
        {value}{unit}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main settings component                                            */
/* ------------------------------------------------------------------ */

export function ClipSettings() {
  const settings = useClipperStore((s) => s.settings);
  const updateSettings = useClipperStore((s) => s.updateSettings);

  const togglePlatform = (platform: ClipPlatform) => {
    const current = settings.platforms;
    const next = current.includes(platform)
      ? current.filter((p) => p !== platform)
      : [...current, platform];
    // Ensure at least one platform is selected
    if (next.length > 0) {
      updateSettings({ platforms: next });
    }
  };

  const updateCaptionStyle = (partial: Partial<CaptionStyle>) => {
    updateSettings({
      captionStyle: { ...settings.captionStyle, ...partial },
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Clip Duration Range */}
      <div className="rounded-lg border border-border/60 bg-card/40 p-3 flex flex-col gap-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Clock className="h-4 w-4 text-muted-foreground" />
          Clip Duration
        </div>
        <SettingsSliderRow
          label="Min Length"
          value={settings.minClipDuration}
          onChange={(v) =>
            updateSettings({
              minClipDuration: Math.min(v, settings.maxClipDuration - 5),
            })
          }
          min={5}
          max={120}
          step={5}
          unit="s"
        />
        <SettingsSliderRow
          label="Max Length"
          value={settings.maxClipDuration}
          onChange={(v) =>
            updateSettings({
              maxClipDuration: Math.max(v, settings.minClipDuration + 5),
            })
          }
          min={10}
          max={180}
          step={5}
          unit="s"
        />
      </div>

      {/* Max Clips */}
      <div className="rounded-lg border border-border/60 bg-card/40 p-3 flex flex-col gap-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Hash className="h-4 w-4 text-muted-foreground" />
          Max Clips
        </div>
        <SettingsSliderRow
          label="Limit"
          value={settings.maxClips}
          onChange={(v) => updateSettings({ maxClips: v })}
          min={5}
          max={200}
          step={5}
        />
      </div>

      {/* Platforms */}
      <div className="rounded-lg border border-border/60 bg-card/40 p-3 flex flex-col gap-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <MonitorSmartphone className="h-4 w-4 text-muted-foreground" />
          Platforms
        </div>
        <div className="flex flex-wrap gap-3">
          {PLATFORM_OPTIONS.map((p) => (
            <label
              key={p.value}
              className="flex items-center gap-2 text-sm cursor-pointer"
            >
              <Checkbox
                checked={settings.platforms.includes(p.value)}
                onCheckedChange={() => togglePlatform(p.value)}
              />
              <span className="text-foreground">{p.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Caption Style */}
      <div className="rounded-lg border border-border/60 bg-card/40 p-3 flex flex-col gap-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
          Caption Style
        </div>

        {/* Position selector */}
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground w-28 shrink-0">
            Position
          </span>
          <div className="flex rounded-md border border-border/60 overflow-hidden flex-1">
            {CAPTION_POSITIONS.map((pos) => (
              <button
                key={pos.value}
                type="button"
                onClick={() => updateCaptionStyle({ position: pos.value })}
                className={`flex-1 px-2.5 py-1 text-xs font-medium transition-colors ${
                  settings.captionStyle.position === pos.value
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted/60"
                }`}
              >
                {pos.label}
              </button>
            ))}
          </div>
        </div>

        {/* Font size */}
        <SettingsSliderRow
          label="Font Size"
          value={settings.captionStyle.fontSize}
          onChange={(v) => updateCaptionStyle({ fontSize: v })}
          min={24}
          max={72}
          step={2}
          unit="px"
        />

        {/* Hook text toggle */}
        <div className="flex items-center gap-3">
          <Type className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-xs text-foreground flex-1">
            Add hook text (first 3 seconds)
          </span>
          <Switch
            checked={settings.addHookText}
            onCheckedChange={(checked) =>
              updateSettings({ addHookText: checked })
            }
          />
        </div>
      </div>
    </div>
  );
}
