"use client";

import { useCallback, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useStoryboardStore } from "@/stores/storyboard-store";
import { useEditor } from "@/hooks/use-editor";
import { cn } from "@/utils/ui";
import {
  Clapperboard,
  Play,
  Check,
  X,
  Clock,
  Type,
  Image,
  Video,
  Sparkles,
  Wand2,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  CheckCheck,
} from "lucide-react";
import type { StoryboardScene } from "@/types/storyboard";
import type { SerializedMediaAsset } from "@/lib/ai/types";

/* ------------------------------------------------------------------ */
/*  Visual type icon helper                                            */
/* ------------------------------------------------------------------ */

function VisualTypeIcon({
  type,
  className,
}: {
  type: StoryboardScene["visualType"];
  className?: string;
}) {
  switch (type) {
    case "text":
      return <Type className={className} />;
    case "image":
      return <Image className={className} />;
    case "video":
      return <Video className={className} />;
    case "generated":
      return <Sparkles className={className} />;
    case "effect":
      return <Wand2 className={className} />;
    default:
      return <Clapperboard className={className} />;
  }
}

/* ------------------------------------------------------------------ */
/*  Style options                                                      */
/* ------------------------------------------------------------------ */

const STYLE_OPTIONS = [
  { value: "professional", label: "Professional", description: "Clean and corporate" },
  { value: "casual", label: "Casual", description: "Relaxed and friendly" },
  { value: "cinematic", label: "Cinematic", description: "Dramatic and bold" },
  { value: "fun", label: "Fun", description: "Energetic and vibrant" },
];

/* ------------------------------------------------------------------ */
/*  Stage 1: Concept Input                                             */
/* ------------------------------------------------------------------ */

function ConceptStage() {
  const concept = useStoryboardStore((s) => s.concept);
  const setConcept = useStoryboardStore((s) => s.setConcept);
  const targetDuration = useStoryboardStore((s) => s.targetDuration);
  const setTargetDuration = useStoryboardStore((s) => s.setTargetDuration);
  const style = useStoryboardStore((s) => s.style);
  const setStyle = useStoryboardStore((s) => s.setStyle);
  const setState = useStoryboardStore((s) => s.setState);
  const setStoryboard = useStoryboardStore((s) => s.setStoryboard);
  const setError = useStoryboardStore((s) => s.setError);

  const editor = useEditor();

  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = useCallback(async () => {
    if (!concept.trim()) return;
    setIsGenerating(true);
    setState("generating");

    try {
      // Get available media assets
      const assets: SerializedMediaAsset[] = editor.media.getAssets().map((a: any) => ({
        id: a.id,
        name: a.name,
        type: a.type,
        duration: a.duration,
        width: a.width,
        height: a.height,
      }));

      const { generateStoryboard } = await import(
        "@/services/storyboard/storyboard-generator"
      );

      const storyboard = await generateStoryboard({
        concept,
        targetDuration,
        style,
        mediaAssets: assets,
      });

      setStoryboard(storyboard);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setError(message);
    } finally {
      setIsGenerating(false);
    }
  }, [concept, targetDuration, style, editor, setState, setStoryboard, setError]);

  // Get media assets for preview
  const assets = editor.media.getAssets();

  const formatDuration = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    if (m === 0) return `${s}s`;
    return s > 0 ? `${m}m ${s}s` : `${m}m`;
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Concept textarea */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-foreground">
          Video Concept
        </label>
        <textarea
          value={concept}
          onChange={(e) => setConcept(e.target.value)}
          placeholder="Describe your video concept... e.g., 'A 60-second product launch video for a new fitness app, starting with an attention-grabbing hook, followed by feature highlights, social proof, and a call to action'"
          className="w-full h-28 rounded-lg border border-border bg-muted/20 px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
          maxLength={5000}
        />
        <p className="text-[11px] text-muted-foreground/60 text-right">
          {concept.length}/5000
        </p>
      </div>

      {/* Style selector */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-foreground">Style</label>
        <div className="grid grid-cols-4 gap-2">
          {STYLE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setStyle(opt.value)}
              className={cn(
                "rounded-lg border px-3 py-2 text-center transition-all",
                style === opt.value
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-muted/20 text-muted-foreground hover:bg-muted/40 hover:text-foreground"
              )}
            >
              <p className="text-xs font-medium">{opt.label}</p>
              <p className="text-[10px] opacity-60 mt-0.5">
                {opt.description}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Duration slider */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-foreground">
            Target Duration
          </label>
          <span className="text-sm text-primary font-medium tabular-nums">
            {formatDuration(targetDuration)}
          </span>
        </div>
        <input
          type="range"
          min={15}
          max={300}
          step={5}
          value={targetDuration}
          onChange={(e) => setTargetDuration(Number(e.target.value))}
          className="w-full accent-primary"
        />
        <div className="flex justify-between text-[10px] text-muted-foreground/50">
          <span>15s</span>
          <span>1m</span>
          <span>2m</span>
          <span>3m</span>
          <span>5m</span>
        </div>
      </div>

      {/* Available media preview */}
      {assets.length > 0 && (
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-foreground">
            Available Media ({assets.length})
          </label>
          <div className="rounded-lg border border-border/60 bg-muted/10 p-2.5 max-h-24 overflow-y-auto scrollbar-thin">
            <div className="flex flex-wrap gap-1.5">
              {assets.map((a: any) => (
                <span
                  key={a.id}
                  className="inline-flex items-center gap-1 rounded-md bg-muted/40 px-2 py-0.5 text-[11px] text-muted-foreground"
                >
                  {a.type === "video" ? (
                    <Video className="h-2.5 w-2.5" />
                  ) : a.type === "audio" ? (
                    <Clock className="h-2.5 w-2.5" />
                  ) : (
                    <Image className="h-2.5 w-2.5" />
                  )}
                  {a.name}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Generate button */}
      <Button
        size="lg"
        onClick={handleGenerate}
        disabled={!concept.trim() || isGenerating}
        className="gap-2 w-full"
      >
        {isGenerating ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Generating Storyboard...
          </>
        ) : (
          <>
            <Wand2 className="h-4 w-4" />
            Generate Storyboard
          </>
        )}
      </Button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Stage 2: Review Storyboard                                         */
/* ------------------------------------------------------------------ */

function SceneCard({
  scene,
  isExecuting,
}: {
  scene: StoryboardScene;
  isExecuting: boolean;
}) {
  const approveScene = useStoryboardStore((s) => s.approveScene);
  const rejectScene = useStoryboardStore((s) => s.rejectScene);
  const state = useStoryboardStore((s) => s.state);
  const isReviewing = state === "reviewing";

  return (
    <div
      className={cn(
        "rounded-lg border p-3 transition-all",
        scene.executed
          ? "border-emerald-500/30 bg-emerald-500/5"
          : isExecuting
            ? "border-primary/50 bg-primary/5 ring-1 ring-primary/20"
            : scene.approved
              ? "border-primary/30 bg-primary/5"
              : "border-border/60 bg-muted/10"
      )}
    >
      <div className="flex items-start gap-3">
        {/* Order number */}
        <div
          className={cn(
            "flex items-center justify-center h-7 w-7 rounded-full text-xs font-bold shrink-0",
            scene.executed
              ? "bg-emerald-500/20 text-emerald-500"
              : isExecuting
                ? "bg-primary/20 text-primary"
                : scene.approved
                  ? "bg-primary/15 text-primary"
                  : "bg-muted/60 text-muted-foreground"
          )}
        >
          {scene.executed ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : isExecuting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            scene.order
          )}
        </div>

        {/* Scene content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <VisualTypeIcon
              type={scene.visualType}
              className="h-3.5 w-3.5 text-muted-foreground shrink-0"
            />
            <h4 className="text-sm font-medium text-foreground truncate">
              {scene.title}
            </h4>
            <span className="text-[10px] text-muted-foreground shrink-0 tabular-nums flex items-center gap-0.5">
              <Clock className="h-2.5 w-2.5" />
              {scene.duration}s
            </span>
          </div>
          <p className="text-xs text-muted-foreground line-clamp-2">
            {scene.description}
          </p>
          {scene.suggestedText && (
            <p className="text-[11px] text-primary/70 mt-1 italic truncate">
              &quot;{scene.suggestedText}&quot;
            </p>
          )}
          {scene.notes && scene.notes.startsWith("Error:") && (
            <p className="text-[11px] text-destructive mt-1 flex items-center gap-1">
              <AlertCircle className="h-3 w-3 shrink-0" />
              {scene.notes}
            </p>
          )}
          <div className="flex items-center gap-1 mt-1.5">
            <span className="text-[10px] text-muted-foreground/50">
              {scene.aiActions.length} action{scene.aiActions.length !== 1 ? "s" : ""}
            </span>
            {scene.suggestedColor && (
              <span
                className="inline-block h-3 w-3 rounded-sm border border-border/40"
                style={{ backgroundColor: scene.suggestedColor }}
              />
            )}
          </div>
        </div>

        {/* Approve/Reject buttons */}
        {isReviewing && !scene.executed && (
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() =>
                scene.approved
                  ? rejectScene(scene.id)
                  : approveScene(scene.id)
              }
              className={cn(
                "rounded-md p-1.5 transition-colors",
                scene.approved
                  ? "bg-primary/15 text-primary hover:bg-primary/25"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
              title={scene.approved ? "Unapprove" : "Approve"}
            >
              <Check className="h-4 w-4" />
            </button>
            {scene.approved && (
              <button
                onClick={() => rejectScene(scene.id)}
                className="rounded-md p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                title="Reject"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        )}

        {/* Status indicator during execution */}
        {(state === "executing" || state === "done") && (
          <div className="shrink-0">
            {scene.executed ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            ) : isExecuting ? (
              <Loader2 className="h-4 w-4 text-primary animate-spin" />
            ) : scene.approved ? (
              <div className="h-4 w-4 rounded-full border border-muted-foreground/30" />
            ) : (
              <X className="h-4 w-4 text-muted-foreground/30" />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ReviewStage() {
  const storyboard = useStoryboardStore((s) => s.storyboard);
  const approveAll = useStoryboardStore((s) => s.approveAll);
  const setState = useStoryboardStore((s) => s.setState);
  const setExecuting = useStoryboardStore((s) => s.setExecuting);
  const markSceneDone = useStoryboardStore((s) => s.markSceneDone);
  const markSceneError = useStoryboardStore((s) => s.markSceneError);
  const setError = useStoryboardStore((s) => s.setError);
  const currentExecutingScene = useStoryboardStore(
    (s) => s.currentExecutingScene
  );
  const state = useStoryboardStore((s) => s.state);

  const scenes = storyboard?.scenes ?? [];
  const approvedCount = scenes.filter((s) => s.approved).length;
  const executedCount = scenes.filter((s) => s.executed).length;
  const totalDuration = scenes.reduce((sum, s) => sum + s.duration, 0);

  const handleExecute = useCallback(async () => {
    if (!storyboard || approvedCount === 0) return;

    const { executeStoryboard } = await import(
      "@/services/storyboard/storyboard-executor"
    );

    setState("executing");

    await executeStoryboard(storyboard, {
      onSceneStart: (index, scene) => {
        setExecuting(index);
      },
      onSceneComplete: (index, scene) => {
        markSceneDone(scene.id);
      },
      onError: (index, scene, error) => {
        markSceneError(scene.id, error);
      },
      onAllComplete: () => {
        // State is set to "done" automatically by markSceneDone
        // when all approved scenes are executed
      },
    });
  }, [
    storyboard,
    approvedCount,
    setState,
    setExecuting,
    markSceneDone,
    markSceneError,
  ]);

  const handleRegenerate = useCallback(() => {
    useStoryboardStore.getState().setState("idle");
  }, []);

  const isExecuting = state === "executing";
  const isDone = state === "done";

  return (
    <div className="flex flex-col gap-4">
      {/* Summary bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">
            {scenes.length} scenes
          </span>
          <span className="text-xs text-muted-foreground">
            <Clock className="inline h-3 w-3 mr-0.5" />
            {totalDuration}s total
          </span>
          {approvedCount > 0 && (
            <span className="text-xs text-primary">
              {approvedCount} approved
            </span>
          )}
          {executedCount > 0 && (
            <span className="text-xs text-emerald-500">
              {executedCount} done
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {state === "reviewing" && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRegenerate}
                className="text-xs gap-1.5"
              >
                <Sparkles className="h-3 w-3" />
                Re-generate
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={approveAll}
                className="text-xs gap-1.5"
              >
                <CheckCheck className="h-3 w-3" />
                Approve All
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Execution progress */}
      {(isExecuting || isDone) && (
        <div className="flex flex-col gap-1.5">
          <Progress
            value={
              approvedCount > 0
                ? (executedCount / approvedCount) * 100
                : 0
            }
            className="h-2"
          />
          <p className="text-[11px] text-muted-foreground text-center">
            {isDone
              ? `All ${executedCount} scenes executed`
              : `Executing scene ${currentExecutingScene + 1} of ${approvedCount}`}
          </p>
        </div>
      )}

      {/* Scene list */}
      <div className="flex flex-col gap-2 max-h-[50vh] overflow-y-auto scrollbar-thin pr-1">
        {scenes.map((scene, index) => (
          <SceneCard
            key={scene.id}
            scene={scene}
            isExecuting={
              isExecuting &&
              storyboard!.scenes
                .filter((s) => s.approved && !s.executed)
                .sort((a, b) => a.order - b.order)[currentExecutingScene]?.id === scene.id
            }
          />
        ))}
      </div>

      {/* Execute / Done button */}
      <div className="flex items-center gap-2">
        {state === "reviewing" && (
          <Button
            size="lg"
            onClick={handleExecute}
            disabled={approvedCount === 0}
            className="gap-2 w-full"
          >
            <Play className="h-4 w-4" />
            Execute Plan ({approvedCount} scene
            {approvedCount !== 1 ? "s" : ""})
          </Button>
        )}
        {isDone && (
          <Button
            size="lg"
            onClick={() => useStoryboardStore.getState().close()}
            className="gap-2 w-full"
          >
            <Check className="h-4 w-4" />
            Done
          </Button>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Generating stage (loading)                                         */
/* ------------------------------------------------------------------ */

function GeneratingStage() {
  return (
    <div className="flex flex-col items-center gap-4 py-8">
      <div className="flex items-center justify-center h-14 w-14 rounded-full bg-primary/10">
        <Loader2 className="h-7 w-7 text-primary animate-spin" />
      </div>
      <div className="text-center">
        <p className="text-sm font-medium">Generating your storyboard...</p>
        <p className="text-xs text-muted-foreground mt-1">
          Claude is planning your video scene by scene. This may take a moment.
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Error stage                                                        */
/* ------------------------------------------------------------------ */

function ErrorStage() {
  const error = useStoryboardStore((s) => s.error);
  const setError = useStoryboardStore((s) => s.setError);
  const setState = useStoryboardStore((s) => s.setState);

  return (
    <div className="flex flex-col items-center gap-4 py-8">
      <div className="flex items-center justify-center h-14 w-14 rounded-full bg-destructive/10">
        <AlertCircle className="h-7 w-7 text-destructive" />
      </div>
      <div className="text-center">
        <p className="text-sm font-medium">Something went wrong</p>
        <p className="text-xs text-muted-foreground mt-1 max-w-sm">
          {error || "An unexpected error occurred during storyboard generation."}
        </p>
      </div>
      <Button
        variant="outline"
        onClick={() => {
          setError(null);
          setState("idle");
        }}
        className="gap-2"
      >
        Try Again
      </Button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main panel component                                               */
/* ------------------------------------------------------------------ */

export function StoryboardPanel() {
  const isOpen = useStoryboardStore((s) => s.isOpen);
  const close = useStoryboardStore((s) => s.close);
  const state = useStoryboardStore((s) => s.state);
  const storyboard = useStoryboardStore((s) => s.storyboard);

  const isGenerating = state === "generating";
  const isReviewing = state === "reviewing";
  const isExecuting = state === "executing";
  const isDone = state === "done";
  const isError = state === "error";
  const isIdle = state === "idle";

  const scenesCount = storyboard?.scenes.length ?? 0;
  const titleSuffix =
    isReviewing || isExecuting || isDone
      ? ` -- ${scenesCount} scenes`
      : "";

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open && !isGenerating && !isExecuting) close();
      }}
    >
      <DialogContent
        className={cn(
          "max-h-[90vh] overflow-y-auto",
          isReviewing || isExecuting || isDone
            ? "max-w-3xl"
            : "max-w-2xl"
        )}
      >
        {/* Header */}
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clapperboard className="h-5 w-5 text-primary" />
            AI Storyboard{titleSuffix}
          </DialogTitle>
          <DialogDescription>
            {isIdle &&
              "Describe your video concept and let AI plan it scene by scene."}
            {isGenerating &&
              "Generating your storyboard..."}
            {isReviewing &&
              "Review and approve scenes, then execute the plan."}
            {isExecuting &&
              "Executing your storyboard. Please wait..."}
            {isDone &&
              "Your storyboard has been executed. Check the timeline."}
            {isError && "An error occurred."}
          </DialogDescription>
        </DialogHeader>

        <div className="p-6 pt-0">
          {isIdle && <ConceptStage />}
          {isGenerating && <GeneratingStage />}
          {(isReviewing || isExecuting || isDone) && <ReviewStage />}
          {isError && <ErrorStage />}
        </div>
      </DialogContent>
    </Dialog>
  );
}
