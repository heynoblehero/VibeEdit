"use client";

import { useRef, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useClipperStore } from "@/stores/clipper-store";
import { ClipSettings } from "@/components/editor/clipper/clip-settings";
import { ClipPreviewGrid } from "@/components/editor/clipper/clip-preview-grid";
import { cn } from "@/utils/ui";
import {
  Scissors,
  Upload,
  Play,
  Download,
  Check,
  X,
  Sparkles,
  TrendingUp,
  Clock,
  Hash,
  FileVideo,
  Loader2,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import type { PipelineState } from "@/types/clipper";

/* ------------------------------------------------------------------ */
/*  Pipeline step labels                                               */
/* ------------------------------------------------------------------ */

const PIPELINE_STEPS: {
  state: PipelineState;
  label: string;
  step: number;
}[] = [
  { state: "transcribing", label: "Transcribing audio", step: 1 },
  { state: "analyzing", label: "Analyzing for viral moments", step: 2 },
  { state: "generating", label: "Generating clips", step: 3 },
  { state: "exporting", label: "Exporting", step: 4 },
];

function getStepIndex(state: PipelineState): number {
  const idx = PIPELINE_STEPS.findIndex((s) => s.state === state);
  return idx >= 0 ? idx : -1;
}

/* ------------------------------------------------------------------ */
/*  File drop zone                                                     */
/* ------------------------------------------------------------------ */

function FileDropZone() {
  const setSourceFile = useClipperStore((s) => s.setSourceFile);
  const sourceFile = useClipperStore((s) => s.sourceFile);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith("video/")) {
        setSourceFile(file);
      }
    },
    [setSourceFile],
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
    },
    [],
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        setSourceFile(file);
      }
      e.target.value = "";
    },
    [setSourceFile],
  );

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024)
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  if (sourceFile) {
    return (
      <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 flex items-center gap-3">
        <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-primary/10">
          <FileVideo className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{sourceFile.name}</p>
          <p className="text-xs text-muted-foreground">
            {formatFileSize(sourceFile.size)}
          </p>
        </div>
        <button
          type="button"
          onClick={() => useClipperStore.getState().setSourceFile(null)}
          className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onClick={() => fileInputRef.current?.click()}
      className="rounded-lg border-2 border-dashed border-border/60 hover:border-primary/40 bg-muted/20 hover:bg-primary/5 p-8 flex flex-col items-center gap-3 cursor-pointer transition-all group"
    >
      <div className="flex items-center justify-center h-12 w-12 rounded-full bg-muted/60 group-hover:bg-primary/10 transition-colors">
        <Upload className="h-6 w-6 text-muted-foreground group-hover:text-primary transition-colors" />
      </div>
      <div className="text-center">
        <p className="text-sm font-medium">
          Drop video here or click to browse
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Supports MP4, MOV, WebM, and other video formats
        </p>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept="video/*"
        onChange={handleFileSelect}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Stage 1: Upload & Configure                                        */
/* ------------------------------------------------------------------ */

function UploadStage() {
  const sourceFile = useClipperStore((s) => s.sourceFile);
  const setPipelineState = useClipperStore((s) => s.setPipelineState);
  const setProgress = useClipperStore((s) => s.setProgress);
  const setMoments = useClipperStore((s) => s.setMoments);

  const handleGenerate = useCallback(() => {
    if (!sourceFile) return;

    // Transition to processing state
    setPipelineState("transcribing");
    setProgress({
      state: "transcribing",
      step: 1,
      totalSteps: 4,
      stepLabel: "Transcribing audio...",
      progress: 0,
      clipsDone: 0,
      clipsTotal: 0,
    });

    // Simulate pipeline stages for demonstration
    // In production, this would call the actual pipeline API
    let currentStep = 0;
    const steps: Array<{
      state: "transcribing" | "analyzing" | "generating" | "exporting";
      label: string;
      duration: number;
    }> = [
      { state: "transcribing", label: "Transcribing audio...", duration: 2000 },
      {
        state: "analyzing",
        label: "Analyzing for viral moments...",
        duration: 3000,
      },
      { state: "generating", label: "Generating clips...", duration: 2500 },
      { state: "exporting", label: "Exporting clips...", duration: 1500 },
    ];

    const runStep = () => {
      if (currentStep >= steps.length) {
        // Done - generate mock moments
        const mockMoments = generateMockMoments();
        setMoments(mockMoments);
        setPipelineState("done");
        setProgress({
          state: "done",
          step: 4,
          totalSteps: 4,
          stepLabel: "Complete",
          progress: 1,
          clipsDone: mockMoments.length,
          clipsTotal: mockMoments.length,
        });
        return;
      }

      const step = steps[currentStep];
      setPipelineState(step.state);

      // Animate progress within step
      let prog = 0;
      const interval = setInterval(() => {
        prog += 0.05;
        if (prog >= 1) {
          prog = 1;
          clearInterval(interval);
          currentStep++;
          setTimeout(runStep, 200);
        }
        setProgress({
          state: step.state,
          step: currentStep + 1,
          totalSteps: 4,
          stepLabel: step.label,
          progress: prog,
          clipsDone: 0,
          clipsTotal: 0,
        });
      }, step.duration / 20);
    };

    runStep();
  }, [sourceFile, setPipelineState, setProgress, setMoments]);

  return (
    <div className="flex flex-col gap-5">
      <FileDropZone />
      <ClipSettings />
      <Button
        size="lg"
        onClick={handleGenerate}
        disabled={!sourceFile}
        className="gap-2 w-full"
      >
        <Sparkles className="h-4 w-4" />
        Generate Clips
      </Button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Stage 2: Processing                                                */
/* ------------------------------------------------------------------ */

function ProcessingStage() {
  const progress = useClipperStore((s) => s.progress);
  const pipelineState = useClipperStore((s) => s.pipelineState);

  const currentStepIndex = getStepIndex(pipelineState);
  const overallProgress = progress
    ? ((progress.step - 1 + progress.progress) / progress.totalSteps) * 100
    : 0;

  return (
    <div className="flex flex-col gap-6 py-4">
      {/* Step indicator */}
      <div className="text-center">
        <p className="text-sm font-medium text-foreground">
          Step {progress?.step || 1} of {progress?.totalSteps || 4}:{" "}
          {progress?.stepLabel || "Preparing..."}
        </p>
      </div>

      {/* Overall progress bar */}
      <div className="flex flex-col gap-2">
        <Progress value={overallProgress} className="h-3" />
        <p className="text-xs text-muted-foreground text-center tabular-nums">
          {Math.round(overallProgress)}%
        </p>
      </div>

      {/* Step list */}
      <div className="flex flex-col gap-2.5 px-4">
        {PIPELINE_STEPS.map((step, idx) => {
          const isComplete = currentStepIndex > idx;
          const isCurrent = currentStepIndex === idx;
          const isPending = currentStepIndex < idx;

          return (
            <div
              key={step.state}
              className={cn(
                "flex items-center gap-3 text-sm transition-colors",
                isComplete && "text-foreground",
                isCurrent && "text-foreground font-medium",
                isPending && "text-muted-foreground/50",
              )}
            >
              {isComplete && (
                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
              )}
              {isCurrent && (
                <Loader2 className="h-4 w-4 text-primary shrink-0 animate-spin" />
              )}
              {isPending && (
                <div className="h-4 w-4 rounded-full border border-muted-foreground/30 shrink-0" />
              )}
              <span>{step.label}</span>
            </div>
          );
        })}
      </div>

      {/* Subtle animation hint */}
      <p className="text-[11px] text-muted-foreground/60 text-center">
        This may take a few minutes depending on video length.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Stage 3: Review & Export                                           */
/* ------------------------------------------------------------------ */

function ReviewStage() {
  const moments = useClipperStore((s) => s.moments);
  const selectedMomentIds = useClipperStore((s) => s.selectedMomentIds);
  const setPipelineState = useClipperStore((s) => s.setPipelineState);
  const close = useClipperStore((s) => s.close);

  const selectedCount = selectedMomentIds.size;

  const handleExport = useCallback(() => {
    // In production, this would trigger actual export
    // For now, just close the dialog
    close();
  }, [close]);

  const handleRerun = useCallback(() => {
    setPipelineState("idle");
    useClipperStore.getState().setProgress(null);
  }, [setPipelineState]);

  return (
    <div className="flex flex-col gap-4">
      {/* Action bar */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRerun}
          className="text-xs gap-1.5"
        >
          <Sparkles className="h-3 w-3" />
          Re-generate
        </Button>
        <Button
          size="sm"
          onClick={handleExport}
          disabled={selectedCount === 0}
          className="gap-1.5"
        >
          <Download className="h-3.5 w-3.5" />
          Export {selectedCount > 0 ? `${selectedCount} Clips` : "Selected"}
        </Button>
      </div>

      {/* Clip grid */}
      <div className="max-h-[55vh] overflow-y-auto scrollbar-thin pr-1">
        <ClipPreviewGrid />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Error stage                                                        */
/* ------------------------------------------------------------------ */

function ErrorStage() {
  const error = useClipperStore((s) => s.error);
  const setPipelineState = useClipperStore((s) => s.setPipelineState);
  const setError = useClipperStore((s) => s.setError);

  return (
    <div className="flex flex-col items-center gap-4 py-8">
      <div className="flex items-center justify-center h-14 w-14 rounded-full bg-destructive/10">
        <AlertCircle className="h-7 w-7 text-destructive" />
      </div>
      <div className="text-center">
        <p className="text-sm font-medium">Something went wrong</p>
        <p className="text-xs text-muted-foreground mt-1 max-w-sm">
          {error || "An unexpected error occurred during processing."}
        </p>
      </div>
      <Button
        variant="outline"
        onClick={() => {
          setError(null);
          setPipelineState("idle");
        }}
        className="gap-2"
      >
        Try Again
      </Button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Mock data generator (for demo / until backend is wired)            */
/* ------------------------------------------------------------------ */

function generateMockMoments() {
  const titles = [
    "Why I quit my 9-5 job",
    "The #1 trick nobody talks about",
    "This changed everything for me",
    "Stop doing this immediately",
    "3 things I wish I knew sooner",
    "The secret to going viral",
    "I can't believe this worked",
    "Watch this before it's too late",
    "How I gained 100k followers",
    "The biggest mistake beginners make",
    "This hack saves 10 hours a week",
    "Nobody is talking about this",
    "The truth about content creation",
    "Why most people fail at this",
    "One simple trick that changed my life",
    "The real reason you're not growing",
  ];

  const reasons = [
    "Strong emotional hook with personal story arc",
    "Contrarian opinion that sparks curiosity",
    "Transformation narrative with clear before/after",
    "Urgent call-to-action with scarcity framing",
    "Listicle format with high retention pattern",
    "Pattern interrupt with unexpected revelation",
    "Relatable struggle that builds community",
    "Actionable advice with immediate value",
  ];

  const hashtagPool = [
    "viral",
    "fyp",
    "trending",
    "growthhack",
    "contentcreator",
    "motivation",
    "entrepreneur",
    "tips",
    "hack",
    "mindset",
    "success",
    "creator",
    "socialmedia",
    "marketing",
  ];

  const count = 8 + Math.floor(Math.random() * 24);
  const moments = [];

  for (let i = 0; i < count; i++) {
    const startTime = Math.floor(Math.random() * 3600);
    const duration = 15 + Math.floor(Math.random() * 45);
    const score = 50 + Math.floor(Math.random() * 50);
    const numHashtags = 2 + Math.floor(Math.random() * 4);
    const shuffled = [...hashtagPool].sort(() => Math.random() - 0.5);

    moments.push({
      id: `moment-${i}`,
      startTime,
      endTime: startTime + duration,
      title: titles[i % titles.length],
      reason: reasons[i % reasons.length],
      score,
      transcript:
        "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
      hashtags: shuffled.slice(0, numHashtags),
    });
  }

  // Sort by score descending
  moments.sort((a, b) => b.score - a.score);

  return moments;
}

/* ------------------------------------------------------------------ */
/*  Main panel component                                               */
/* ------------------------------------------------------------------ */

export function ClipperPanel() {
  const isOpen = useClipperStore((s) => s.isOpen);
  const close = useClipperStore((s) => s.close);
  const pipelineState = useClipperStore((s) => s.pipelineState);
  const moments = useClipperStore((s) => s.moments);

  const isProcessing = [
    "uploading",
    "transcribing",
    "analyzing",
    "generating",
    "exporting",
  ].includes(pipelineState);

  const isDone = pipelineState === "done";
  const isError = pipelineState === "error";
  const isIdle = pipelineState === "idle";

  const titleSuffix = isDone
    ? ` \u2014 ${moments.length} clips found`
    : "";

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open && !isProcessing) close();
      }}
    >
      <DialogContent
        className={cn(
          "max-h-[90vh] overflow-y-auto",
          isDone ? "max-w-4xl" : "max-w-2xl",
        )}
      >
        {/* Header */}
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scissors className="h-5 w-5 text-primary" />
            Auto Clip Generator{titleSuffix}
          </DialogTitle>
          <DialogDescription>
            {isIdle &&
              "Upload a long video and automatically generate short, viral-ready clips."}
            {isProcessing &&
              "Processing your video. Please wait..."}
            {isDone &&
              "Review your clips and export the ones you like."}
            {isError && "An error occurred during processing."}
          </DialogDescription>
        </DialogHeader>

        <div className="p-6 pt-0">
          {isIdle && <UploadStage />}
          {isProcessing && <ProcessingStage />}
          {isDone && <ReviewStage />}
          {isError && <ErrorStage />}
        </div>
      </DialogContent>
    </Dialog>
  );
}
