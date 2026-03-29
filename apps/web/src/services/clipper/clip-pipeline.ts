import type {
  ClipMoment,
  ClipJob,
  ClipperSettings,
  PipelineProgress,
} from "@/types/clipper";
import type { TranscriptionSegment } from "@/types/transcription";
import { transcriptionService } from "@/services/transcription/service";
import { detectViralMoments } from "./moment-detector";
import { buildClipTimeline } from "./clip-builder";
import { exportClips } from "./batch-exporter";
import {
  Input,
  ALL_FORMATS,
  BlobSource,
  AudioBufferSink,
} from "mediabunny";

/**
 * Extract audio from a video file as a mono Float32Array suitable for Whisper transcription.
 * Uses mediabunny to demux and decode the audio track, then mixes down to mono.
 */
async function extractAudioFromVideo(
  videoFile: File,
): Promise<Float32Array> {
  const input = new Input({
    source: new BlobSource(videoFile),
    formats: ALL_FORMATS,
  });

  try {
    const audioTrack = await input.getPrimaryAudioTrack();
    if (!audioTrack) {
      throw new Error("No audio track found in the video file");
    }

    const sink = new AudioBufferSink(audioTrack);
    const chunks: AudioBuffer[] = [];
    let totalSamples = 0;

    for await (const { buffer } of sink.buffers(0)) {
      chunks.push(buffer);
      totalSamples += buffer.length;
    }

    if (chunks.length === 0) {
      throw new Error("No audio samples could be decoded from the video");
    }

    // Mix down to mono Float32Array
    const numChannels = chunks[0].numberOfChannels;
    const mono = new Float32Array(totalSamples);
    let offset = 0;

    for (const chunk of chunks) {
      const length = chunk.length;
      for (let i = 0; i < length; i++) {
        let sum = 0;
        for (let ch = 0; ch < numChannels; ch++) {
          sum += chunk.getChannelData(ch)[i];
        }
        mono[offset + i] = sum / numChannels;
      }
      offset += length;
    }

    return mono;
  } finally {
    input.dispose();
  }
}

/**
 * ClipPipeline orchestrates the full auto-clip workflow:
 *   1. Extract audio from video
 *   2. Transcribe audio using Whisper
 *   3. Analyze transcript with Claude to find viral moments
 *   4. Build timeline elements for each clip
 *   5. Export all clips to the target platforms
 */
export class ClipPipeline {
  private cancelled = false;
  private currentAbortController: AbortController | null = null;

  /**
   * Run the full auto-clip pipeline.
   */
  async run({
    videoFile,
    settings,
    onProgress,
  }: {
    videoFile: File;
    settings: ClipperSettings;
    onProgress: (progress: PipelineProgress) => void;
  }): Promise<{
    moments: ClipMoment[];
    jobs: ClipJob[];
  }> {
    this.cancelled = false;
    this.currentAbortController = new AbortController();

    // ── Step 1: Extract audio ─────────────────────────────────
    onProgress({
      state: "uploading",
      step: 1,
      totalSteps: 6,
      stepLabel: "Extracting audio from video...",
      progress: 0,
      clipsDone: 0,
      clipsTotal: 0,
    });

    this.throwIfCancelled();

    let audioData: Float32Array;
    try {
      audioData = await extractAudioFromVideo(videoFile);
    } catch (err) {
      throw new Error(
        `Failed to extract audio: ${err instanceof Error ? err.message : "Unknown error"}`,
      );
    }

    onProgress({
      state: "uploading",
      step: 1,
      totalSteps: 6,
      stepLabel: "Audio extraction complete",
      progress: 1,
      clipsDone: 0,
      clipsTotal: 0,
    });

    // ── Step 2: Transcribe ────────────────────────────────────
    this.throwIfCancelled();

    onProgress({
      state: "transcribing",
      step: 2,
      totalSteps: 6,
      stepLabel: "Transcribing audio...",
      progress: 0,
      clipsDone: 0,
      clipsTotal: 0,
    });

    let segments: TranscriptionSegment[];
    try {
      const result = await transcriptionService.transcribe({
        audioData,
        language: "auto",
        onProgress: (tp) => {
          onProgress({
            state: "transcribing",
            step: 2,
            totalSteps: 6,
            stepLabel: tp.message || "Transcribing...",
            progress: tp.progress,
            clipsDone: 0,
            clipsTotal: 0,
          });
        },
      });
      segments = result.segments;
    } catch (err) {
      throw new Error(
        `Transcription failed: ${err instanceof Error ? err.message : "Unknown error"}`,
      );
    }

    if (segments.length === 0) {
      throw new Error("No speech was detected in the video");
    }

    onProgress({
      state: "transcribing",
      step: 2,
      totalSteps: 6,
      stepLabel: `Transcription complete (${segments.length} segments)`,
      progress: 1,
      clipsDone: 0,
      clipsTotal: 0,
    });

    // ── Step 3: Analyze with Claude ───────────────────────────
    this.throwIfCancelled();

    onProgress({
      state: "analyzing",
      step: 3,
      totalSteps: 6,
      stepLabel: "AI is finding viral moments...",
      progress: 0,
      clipsDone: 0,
      clipsTotal: 0,
    });

    let moments: ClipMoment[];
    try {
      moments = await detectViralMoments({
        transcript: segments,
        settings,
      });
    } catch (err) {
      throw new Error(
        `AI analysis failed: ${err instanceof Error ? err.message : "Unknown error"}`,
      );
    }

    if (moments.length === 0) {
      throw new Error("No viral moments were detected in the transcript");
    }

    onProgress({
      state: "analyzing",
      step: 3,
      totalSteps: 6,
      stepLabel: `Found ${moments.length} viral moments`,
      progress: 1,
      clipsDone: 0,
      clipsTotal: moments.length,
    });

    // ── Step 4: Build clip timelines ──────────────────────────
    this.throwIfCancelled();

    onProgress({
      state: "generating",
      step: 4,
      totalSteps: 6,
      stepLabel: "Building clip timelines...",
      progress: 0,
      clipsDone: 0,
      clipsTotal: moments.length,
    });

    // We use a synthetic media ID that the batch exporter will map to the source file
    const sourceMediaId = "source-video";

    const jobs: ClipJob[] = moments.map((moment, index) => {
      const { videoElement, textElements } = buildClipTimeline({
        moment,
        sourceMediaId,
        captionStyle: settings.captionStyle,
        addHookText: settings.addHookText,
        segments,
      });

      onProgress({
        state: "generating",
        step: 4,
        totalSteps: 6,
        stepLabel: `Building clip ${index + 1} of ${moments.length}`,
        progress: (index + 1) / moments.length,
        clipsDone: 0,
        clipsTotal: moments.length,
      });

      return {
        id: crypto.randomUUID(),
        moment,
        platforms: settings.platforms,
        captionStyle: settings.captionStyle,
        status: "pending" as const,
        results: [],
        videoElement,
        textElements,
      };
    });

    // ── Step 5: Export clips ──────────────────────────────────
    this.throwIfCancelled();

    let exportedJobs: ClipJob[];
    try {
      exportedJobs = await exportClips({
        clips: jobs,
        sourceFile: videoFile,
        onProgress,
      });
    } catch (err) {
      throw new Error(
        `Export failed: ${err instanceof Error ? err.message : "Unknown error"}`,
      );
    }

    // ── Step 6: Done ──────────────────────────────────────────
    const completedCount = exportedJobs.filter(
      (j) => j.status === "done",
    ).length;

    onProgress({
      state: "done",
      step: 6,
      totalSteps: 6,
      stepLabel: `Done! ${completedCount} of ${exportedJobs.length} clips exported`,
      progress: 1,
      clipsDone: completedCount,
      clipsTotal: exportedJobs.length,
    });

    return {
      moments,
      jobs: exportedJobs,
    };
  }

  /**
   * Cancel the running pipeline.
   */
  cancel(): void {
    this.cancelled = true;
    this.currentAbortController?.abort();
    transcriptionService.cancel();
  }

  private throwIfCancelled(): void {
    if (this.cancelled) {
      throw new Error("Pipeline cancelled");
    }
  }
}
