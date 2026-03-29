import type {
  ClipJob,
  ClipResult,
  ClipPlatform,
  PipelineProgress,
} from "@/types/clipper";
import { PLATFORM_SPECS } from "@/types/clipper";
import type { MediaAsset } from "@/types/assets";
import type { TimelineTrack, VideoTrack, TextTrack } from "@/types/timeline";
import { buildScene } from "@/services/renderer/scene-builder";
import { SceneExporter } from "@/services/renderer/scene-exporter";
import {
  createTimelineAudioBuffer,
  createAudioContext,
} from "@/lib/media/audio";

/**
 * Builds minimal timeline tracks from a ClipJob's elements.
 * These are synthetic tracks used only for the scene builder.
 */
function buildClipTracks(job: ClipJob): TimelineTrack[] {
  const videoTrack: VideoTrack = {
    id: `clip-video-${job.id}`,
    name: "Clip Video",
    type: "video",
    isMain: true,
    muted: false,
    hidden: false,
    elements: [
      {
        id: `video-el-${job.id}`,
        ...job.videoElement,
      },
    ],
  };

  const textTrack: TextTrack = {
    id: `clip-text-${job.id}`,
    name: "Clip Captions",
    type: "text",
    hidden: false,
    elements: job.textElements.map((el, i) => ({
      id: `text-el-${job.id}-${i}`,
      ...el,
    })),
  };

  const tracks: TimelineTrack[] = [videoTrack];
  if (textTrack.elements.length > 0) {
    tracks.push(textTrack);
  }

  return tracks;
}

/**
 * Export a single clip for a single platform.
 */
async function exportSingleClip({
  job,
  platform,
  sourceMedia,
  onExportProgress,
}: {
  job: ClipJob;
  platform: ClipPlatform;
  sourceMedia: MediaAsset;
  onExportProgress: (progress: number) => void;
}): Promise<ClipResult> {
  const specs = PLATFORM_SPECS[platform];
  const clipDuration = job.moment.endTime - job.moment.startTime;
  const tracks = buildClipTracks(job);
  const canvasSize = { width: specs.width, height: specs.height };

  // Build audio buffer for the clip time range
  let audioBuffer: AudioBuffer | null = null;
  try {
    const audioContext = createAudioContext({ sampleRate: 44100 });
    audioBuffer = await createTimelineAudioBuffer({
      tracks,
      mediaAssets: [sourceMedia],
      duration: clipDuration,
      audioContext,
    });
  } catch (err) {
    console.warn("Failed to extract audio for clip:", err);
  }

  // Build the render scene
  const scene = buildScene({
    tracks,
    mediaAssets: [sourceMedia],
    duration: clipDuration,
    canvasSize,
    background: { type: "color", color: "#000000" },
  });

  // Set up the exporter
  const exporter = new SceneExporter({
    width: specs.width,
    height: specs.height,
    fps: 30,
    format: "mp4",
    quality: "high",
    shouldIncludeAudio: !!audioBuffer,
    audioBuffer: audioBuffer || undefined,
  });

  exporter.on("progress", (progress) => {
    onExportProgress(progress);
  });

  const buffer = await exporter.export({ rootNode: scene });

  if (!buffer) {
    throw new Error("Export produced no output");
  }

  const blob = new Blob([buffer], { type: "video/mp4" });
  const safeTitle = job.moment.title
    .replace(/[<>:"/\\|?*]/g, "-")
    .replace(/\s+/g, "_")
    .slice(0, 60);

  return {
    platform,
    blob,
    width: specs.width,
    height: specs.height,
    duration: clipDuration,
    filename: `${safeTitle}_${platform}.mp4`,
  };
}

/**
 * Exports multiple clips across their target platforms.
 *
 * Processes each ClipJob sequentially. Within each job, exports to
 * each requested platform. Failures on individual clips don't abort
 * the entire batch -- instead, the job is marked as "error" and
 * processing continues.
 */
export async function exportClips({
  clips,
  sourceFile,
  onProgress,
}: {
  clips: ClipJob[];
  sourceFile: File;
  onProgress: (progress: PipelineProgress) => void;
}): Promise<ClipJob[]> {
  // Build a MediaAsset wrapper for the source video
  const sourceMedia: MediaAsset = {
    id: "source-video",
    name: sourceFile.name,
    type: "video",
    file: sourceFile,
    url: URL.createObjectURL(sourceFile),
  };

  const totalPlatformExports = clips.reduce(
    (sum, job) => sum + job.platforms.length,
    0,
  );
  let completedExports = 0;

  const results: ClipJob[] = [];

  for (let clipIndex = 0; clipIndex < clips.length; clipIndex++) {
    const job = { ...clips[clipIndex] };
    job.status = "exporting";
    job.results = [];

    onProgress({
      state: "exporting",
      step: 5,
      totalSteps: 6,
      stepLabel: `Exporting clip ${clipIndex + 1} of ${clips.length}: "${job.moment.title}"`,
      progress: totalPlatformExports > 0 ? completedExports / totalPlatformExports : 0,
      clipsDone: clipIndex,
      clipsTotal: clips.length,
    });

    let jobHasError = false;

    for (const platform of job.platforms) {
      try {
        const result = await exportSingleClip({
          job,
          platform,
          sourceMedia,
          onExportProgress: (frameProgress) => {
            const overallProgress =
              totalPlatformExports > 0
                ? (completedExports + frameProgress) / totalPlatformExports
                : 0;

            onProgress({
              state: "exporting",
              step: 5,
              totalSteps: 6,
              stepLabel: `Exporting clip ${clipIndex + 1}/${clips.length} for ${PLATFORM_SPECS[platform].label}`,
              progress: overallProgress,
              clipsDone: clipIndex,
              clipsTotal: clips.length,
            });
          },
        });

        job.results.push(result);
      } catch (err) {
        console.error(
          `Failed to export clip "${job.moment.title}" for ${platform}:`,
          err,
        );
        jobHasError = true;
        job.error = err instanceof Error ? err.message : "Export failed";
      }

      completedExports++;
    }

    job.status = jobHasError && job.results.length === 0 ? "error" : "done";
    results.push(job);
  }

  // Clean up the object URL
  if (sourceMedia.url) {
    URL.revokeObjectURL(sourceMedia.url);
  }

  return results;
}
