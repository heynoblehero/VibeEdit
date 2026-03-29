"use client";

import { useEffect, useRef, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { useRecordingStore } from "@/stores/recording-store";
import { useEditor } from "@/hooks/use-editor";
import type { RecordingMode, BeautyFilterSettings, BackgroundSettings, NoiseSuppressionSettings } from "@/types/recording";
import {
  Camera,
  Monitor,
  MonitorSmartphone,
  Mic,
  MicOff,
  Circle,
  Square,
  X,
  Sparkles,
  Eye,
  ChevronDown,
  ChevronRight,
  Volume2,
  ImageOff,
} from "lucide-react";
import { cn } from "@/utils/ui";
import { useState } from "react";

/* ------------------------------------------------------------------ */
/*  Mode tab data                                                      */
/* ------------------------------------------------------------------ */

const MODE_TABS: { value: RecordingMode; label: string; icon: React.ReactNode }[] = [
  { value: "camera", label: "Camera", icon: <Camera className="h-4 w-4" /> },
  { value: "screen", label: "Screen", icon: <Monitor className="h-4 w-4" /> },
  {
    value: "screen-camera",
    label: "Screen+Camera",
    icon: <MonitorSmartphone className="h-4 w-4" />,
  },
];

/* ------------------------------------------------------------------ */
/*  Collapsible section                                                */
/* ------------------------------------------------------------------ */

function SettingsSection({
  title,
  icon,
  enabled,
  onToggle,
  children,
  defaultOpen = false,
}: {
  title: string;
  icon: React.ReactNode;
  enabled: boolean;
  onToggle: (checked: boolean) => void;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-lg border border-border/60 bg-card/40 overflow-hidden">
      <div
        role="button"
        tabIndex={0}
        className="flex w-full items-center gap-2.5 px-3 py-2.5 text-sm font-medium hover:bg-muted/40 transition-colors cursor-pointer"
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen((v) => !v); } }}
      >
        {open ? (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
        )}
        <span className="text-muted-foreground">{icon}</span>
        <span className="flex-1 text-left">{title}</span>
        <Switch
          checked={enabled}
          onCheckedChange={onToggle}
          onClick={(e) => e.stopPropagation()}
        />
      </div>
      {open && enabled && (
        <div className="px-3 pb-3 pt-1 flex flex-col gap-3 border-t border-border/40">
          {children}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Slider row                                                         */
/* ------------------------------------------------------------------ */

function SliderRow({
  label,
  value,
  onChange,
  min = 0,
  max = 100,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-muted-foreground w-24 shrink-0">{label}</span>
      <Slider
        className="flex-1"
        min={min}
        max={max}
        step={1}
        value={[value]}
        onValueChange={([v]) => onChange(v)}
      />
      <span className="text-xs text-muted-foreground tabular-nums w-8 text-right">
        {value}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Audio level meter                                                  */
/* ------------------------------------------------------------------ */

function AudioLevelMeter({ level }: { level: number }) {
  const pct = Math.round(level * 100);
  return (
    <div className="flex items-center gap-2">
      {level > 0 ? (
        <Mic className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      ) : (
        <MicOff className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      )}
      <div className="flex-1 h-2 rounded-full bg-accent overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-75"
          style={{
            width: `${pct}%`,
            background:
              pct < 70
                ? "hsl(var(--primary))"
                : pct < 90
                  ? "hsl(45, 100%, 50%)"
                  : "hsl(0, 80%, 55%)",
          }}
        />
      </div>
      <span className="text-[10px] text-muted-foreground tabular-nums w-8 text-right">
        {pct}%
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Timer display                                                      */
/* ------------------------------------------------------------------ */

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export function RecordingPanel() {
  const {
    isOpen,
    state,
    settings,
    recordingDuration,
    audioLevel,
    error,
    close,
    setRecordingState,
    updateSettings,
    incrementDuration,
  } = useRecordingStore();

  const editor = useEditor();
  const videoRef = useRef<HTMLVideoElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isRecording = state === "recording";
  const isPreviewing = state === "previewing";
  const showCameraSettings = settings.mode === "camera" || settings.mode === "screen-camera";

  /* ---- Timer ---- */
  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => {
        incrementDuration();
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRecording, incrementDuration]);

  /* ---- Start preview when dialog opens ---- */
  useEffect(() => {
    if (!isOpen || state !== "idle") return;

    let cancelled = false;
    const startPreview = async () => {
      try {
        await editor.recording.startPreview(settings);
        if (cancelled) return;
        setRecordingState("previewing");

        // Bind the raw stream to the video element for preview
        const stream = editor.recording.getPreviewStream();
        if (videoRef.current && stream) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : "Failed to access camera/screen";
        useRecordingStore.getState().setError(msg);
        setRecordingState("error");
      }
    };

    startPreview();
    return () => { cancelled = true; };
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---- Cleanup on close ---- */
  useEffect(() => {
    if (!isOpen) {
      if (videoRef.current) videoRef.current.srcObject = null;
      editor.recording.cancelRecording();
      setRecordingState("idle");
    }
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---- Handle mode switch ---- */
  const handleModeChange = useCallback(
    async (mode: RecordingMode) => {
      updateSettings({ mode });
      if (state === "previewing" || state === "idle") {
        try {
          setRecordingState("preparing");
          await editor.recording.startPreview({ ...settings, mode });
          setRecordingState("previewing");
          const stream = editor.recording.getPreviewStream();
          if (videoRef.current && stream) {
            videoRef.current.srcObject = stream;
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Failed to switch mode";
          useRecordingStore.getState().setError(msg);
          setRecordingState("error");
        }
      }
    },
    [settings, state, updateSettings, setRecordingState, editor],
  );

  /* ---- Record / Stop ---- */
  const handleRecordToggle = useCallback(async () => {
    if (isRecording) {
      try {
        setRecordingState("processing");
        const result = await editor.recording.stopRecording();
        await editor.recording.addRecordingToProject(result);
        setRecordingState("idle");
        close();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Recording failed";
        useRecordingStore.getState().setError(msg);
        setRecordingState("error");
      }
    } else if (isPreviewing) {
      try {
        editor.recording.startRecording();
        setRecordingState("recording");
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to start recording";
        useRecordingStore.getState().setError(msg);
        setRecordingState("error");
      }
    } else {
      // Not previewing yet — start preview first, then auto-record
      try {
        setRecordingState("preparing");
        await editor.recording.startPreview(settings);
        const stream = editor.recording.getPreviewStream();
        if (videoRef.current && stream) {
          videoRef.current.srcObject = stream;
        }
        editor.recording.startRecording();
        setRecordingState("recording");
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to start recording";
        useRecordingStore.getState().setError(msg);
        setRecordingState("error");
      }
    }
  }, [isRecording, isPreviewing, settings, setRecordingState, editor, close]);

  /* ---- Beauty filters update ---- */
  const updateBeautyFilters = useCallback(
    (partial: Partial<BeautyFilterSettings>) => {
      updateSettings({ beautyFilters: { ...settings.beautyFilters, ...partial } });
    },
    [settings.beautyFilters, updateSettings],
  );

  /* ---- Background removal update ---- */
  const updateBackgroundRemoval = useCallback(
    (partial: Partial<BackgroundSettings>) => {
      updateSettings({ backgroundRemoval: { ...settings.backgroundRemoval, ...partial } });
    },
    [settings.backgroundRemoval, updateSettings],
  );

  /* ---- Noise suppression update ---- */
  const updateNoiseSuppression = useCallback(
    (partial: Partial<NoiseSuppressionSettings>) => {
      updateSettings({ noiseSuppression: { ...settings.noiseSuppression, ...partial } });
    },
    [settings.noiseSuppression, updateSettings],
  );

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && close()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* ---- Header ---- */}
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-primary" />
            Record Clip
          </DialogTitle>
          <DialogDescription>
            Record from your camera, screen, or both.
          </DialogDescription>
        </DialogHeader>

        <div className="p-6 pt-0 flex flex-col gap-5">
          {/* ---- Mode tabs ---- */}
          <div className="flex rounded-lg border border-border/60 overflow-hidden bg-muted/30">
            {MODE_TABS.map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => handleModeChange(tab.value)}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium transition-colors",
                  settings.mode === tab.value
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
                )}
              >
                {tab.icon}
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>

          {/* ---- Live preview ---- */}
          <div className="relative aspect-video rounded-lg bg-black/90 border border-border/40 overflow-hidden flex items-center justify-center">
            {/* Raw camera/screen preview — effects are applied after recording in the editor */}
            <video
              ref={videoRef}
              className="absolute inset-0 w-full h-full object-cover"
              autoPlay
              muted
              playsInline
            />
            {/* Placeholder when no stream */}
            {(state === "idle" || state === "preparing") && (
              <div className="relative z-10 flex flex-col items-center gap-2 text-muted-foreground/60">
                {settings.mode === "screen" ? (
                  <Monitor className="h-12 w-12" />
                ) : (
                  <Camera className="h-12 w-12" />
                )}
                <span className="text-xs">
                  Click Record to start {settings.mode === "screen" ? "screen capture" : "camera preview"}
                </span>
              </div>
            )}
            {/* Recording indicator */}
            {isRecording && (
              <div className="absolute top-3 left-3 z-20 flex items-center gap-2 bg-black/60 backdrop-blur-sm rounded-full px-3 py-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse" />
                <span className="text-xs text-white font-mono tabular-nums">
                  {formatDuration(recordingDuration)}
                </span>
              </div>
            )}
            {/* Processing overlay */}
            {state === "processing" && (
              <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                <div className="flex flex-col items-center gap-2 text-white">
                  <div className="h-6 w-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span className="text-xs">Processing...</span>
                </div>
              </div>
            )}
          </div>

          {/* ---- Error message ---- */}
          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          {/* ---- Settings ---- */}
          <div className="flex flex-col gap-2">
            {/* Beauty Filters -- only for camera modes */}
            {showCameraSettings && (
              <SettingsSection
                title="Beauty Filters"
                icon={<Sparkles className="h-4 w-4" />}
                enabled={settings.beautyFilters.enabled}
                onToggle={(checked) => updateBeautyFilters({ enabled: checked })}
              >
                <SliderRow
                  label="Skin Smoothing"
                  value={settings.beautyFilters.skinSmoothing}
                  onChange={(v) => updateBeautyFilters({ skinSmoothing: v })}
                />
                <SliderRow
                  label="Brighten"
                  value={settings.beautyFilters.brightening}
                  onChange={(v) => updateBeautyFilters({ brightening: v })}
                />
                <SliderRow
                  label="Face Slim"
                  value={settings.beautyFilters.faceSlimming}
                  onChange={(v) => updateBeautyFilters({ faceSlimming: v })}
                />
              </SettingsSection>
            )}

            {/* Background Removal */}
            {showCameraSettings && (
              <SettingsSection
                title="Background"
                icon={<ImageOff className="h-4 w-4" />}
                enabled={settings.backgroundRemoval.enabled}
                onToggle={(checked) => updateBackgroundRemoval({ enabled: checked })}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-24 shrink-0">Mode</span>
                  <div className="flex rounded-md border border-border/60 overflow-hidden flex-1">
                    {(["remove", "blur", "replace"] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => updateBackgroundRemoval({ mode })}
                        className={cn(
                          "flex-1 px-2.5 py-1 text-xs font-medium transition-colors capitalize",
                          settings.backgroundRemoval.mode === mode
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:bg-muted/60",
                        )}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>
                </div>
                {settings.backgroundRemoval.mode === "blur" && (
                  <SliderRow
                    label="Blur Intensity"
                    value={settings.backgroundRemoval.blurIntensity}
                    onChange={(v) => updateBackgroundRemoval({ blurIntensity: v })}
                  />
                )}
                {settings.backgroundRemoval.mode === "replace" && (
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-24 shrink-0">Color</span>
                    <input
                      type="color"
                      value={settings.backgroundRemoval.replacementColor}
                      onChange={(e) =>
                        updateBackgroundRemoval({ replacementColor: e.target.value })
                      }
                      className="h-7 w-10 rounded border border-border cursor-pointer bg-transparent"
                    />
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {settings.backgroundRemoval.replacementColor}
                    </span>
                  </div>
                )}
              </SettingsSection>
            )}

            {/* Noise Suppression */}
            <SettingsSection
              title="Noise Suppression"
              icon={<Volume2 className="h-4 w-4" />}
              enabled={settings.noiseSuppression.enabled}
              onToggle={(checked) => updateNoiseSuppression({ enabled: checked })}
              defaultOpen
            >
              <SliderRow
                label="Strength"
                value={settings.noiseSuppression.strength}
                onChange={(v) => updateNoiseSuppression({ strength: v })}
              />
            </SettingsSection>
          </div>

          {/* ---- Audio level ---- */}
          <AudioLevelMeter level={audioLevel} />

          {/* Info: effects applied after recording */}
          <p className="text-[11px] text-muted-foreground/70 text-center">
            Beauty filters &amp; effects are applied after recording in the editor timeline.
          </p>

          {/* ---- Bottom bar: timer + record button ---- */}
          <div className="flex items-center justify-between pt-1 border-t border-border/40">
            <span className="text-lg font-mono tabular-nums text-muted-foreground">
              {formatDuration(recordingDuration)}
            </span>

            <div className="flex items-center gap-3">
              {isRecording ? (
                <Button
                  variant="destructive"
                  size="lg"
                  onClick={handleRecordToggle}
                  className="gap-2 rounded-full px-6"
                >
                  <Square className="h-4 w-4 fill-current" />
                  Stop
                </Button>
              ) : (
                <Button
                  variant="destructive"
                  size="lg"
                  onClick={handleRecordToggle}
                  disabled={state === "processing"}
                  className="gap-2 rounded-full px-6"
                >
                  <Circle className="h-4 w-4 fill-current" />
                  Record
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
