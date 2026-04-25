import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { renderMedia, selectComposition } from "@remotion/renderer";
import {
  type Project,
  type RenderPresetId,
  getRenderPreset,
} from "@/lib/scene-schema";
import { getRemotionBundle } from "./remotion-bundle";
import { inlineUrl } from "./inline-assets";

export type JobState = "queued" | "rendering" | "done" | "failed";

export interface RenderJob {
  id: string;
  projectName: string;
  presetId: RenderPresetId;
  state: JobState;
  progress: number;
  renderedFrames: number;
  totalFrames: number;
  stage: string;
  error: string | null;
  outputPath: string | null;
  sizeBytes: number | null;
  createdAt: number;
  subscribers: Set<(evt: string) => void>;
  input: StartJobInput;
}

export interface StartJobInput {
  project: Project;
  characters: Record<string, string>;
  sfx: Record<string, string>;
  origin: string;
  presetId: RenderPresetId;
}

const jobs = new Map<string, RenderJob>();
const queue: string[] = [];
let running: string | null = null;

function emit(job: RenderJob, event: Record<string, unknown>) {
  const payload = `data: ${JSON.stringify(event)}\n\n`;
  for (const sub of job.subscribers) {
    try {
      sub(payload);
    } catch {
      // subscriber disconnected — ignored
    }
  }
}

function jobSnapshot(job: RenderJob) {
  return {
    id: job.id,
    projectName: job.projectName,
    presetId: job.presetId,
    state: job.state,
    progress: job.progress,
    renderedFrames: job.renderedFrames,
    totalFrames: job.totalFrames,
    stage: job.stage,
    error: job.error,
    sizeBytes: job.sizeBytes,
    createdAt: job.createdAt,
  };
}

export function subscribe(jobId: string, send: (evt: string) => void): () => void {
  const job = jobs.get(jobId);
  if (!job) {
    send(`data: ${JSON.stringify({ type: "error", error: "unknown job" })}\n\n`);
    return () => {};
  }
  send(
    `data: ${JSON.stringify({ type: "snapshot", ...jobSnapshot(job) })}\n\n`,
  );
  job.subscribers.add(send);
  return () => {
    job.subscribers.delete(send);
  };
}

export function getJob(jobId: string): RenderJob | undefined {
  return jobs.get(jobId);
}

export function listJobs(): Array<ReturnType<typeof jobSnapshot>> {
  return Array.from(jobs.values())
    .sort((a, b) => a.createdAt - b.createdAt)
    .map(jobSnapshot);
}

export function consumeJobOutput(jobId: string): { path: string; size: number; extension: string } | null {
  const job = jobs.get(jobId);
  if (!job || job.state !== "done" || !job.outputPath) return null;
  const extension = getRenderPreset(job.presetId).extension;
  const result = { path: job.outputPath, size: job.sizeBytes ?? 0, extension };
  jobs.delete(jobId);
  return result;
}

export function startRenderJob(input: StartJobInput): RenderJob {
  const id = randomUUID();
  const job: RenderJob = {
    id,
    projectName: input.project.name,
    presetId: input.presetId,
    state: "queued",
    progress: 0,
    renderedFrames: 0,
    totalFrames: 0,
    stage: "queued",
    error: null,
    outputPath: null,
    sizeBytes: null,
    createdAt: Date.now(),
    subscribers: new Set(),
    input,
  };
  jobs.set(id, job);
  queue.push(id);
  schedule();
  return job;
}

function schedule(): void {
  if (running) return;
  const next = queue.shift();
  if (!next) return;
  running = next;
  const job = jobs.get(next);
  if (!job) {
    running = null;
    schedule();
    return;
  }
  runJob(job)
    .catch((err) => {
      job.state = "failed";
      job.error = err instanceof Error ? err.message : String(err);
      emit(job, { type: "failed", error: job.error });
    })
    .finally(() => {
      running = null;
      schedule();
    });
}

async function runJob(job: RenderJob): Promise<void> {
  const { project, origin, presetId } = job.input;
  const preset = getRenderPreset(presetId);

  const characters = Object.fromEntries(
    Object.entries(job.input.characters ?? {}).map(([k, v]) => [k, inlineUrl(v, origin)]),
  );
  const sfx = Object.fromEntries(
    Object.entries(job.input.sfx ?? {}).map(([k, v]) => [k, inlineUrl(v, origin)]),
  );
  const scenes = project.scenes.map((s) => ({
    ...s,
    voiceover: s.voiceover
      ? { ...s.voiceover, audioUrl: inlineUrl(s.voiceover.audioUrl, origin) }
      : s.voiceover,
    background: {
      ...s.background,
      imageUrl: s.background.imageUrl
        ? inlineUrl(s.background.imageUrl, origin)
        : s.background.imageUrl,
      videoUrl: s.background.videoUrl
        ? inlineUrl(s.background.videoUrl, origin)
        : s.background.videoUrl,
    },
    broll: s.broll?.map((b) => ({
      ...b,
      url: inlineUrl(b.url, origin),
      thumbUrl: b.thumbUrl ? inlineUrl(b.thumbUrl, origin) : b.thumbUrl,
    })),
  }));

  const music = project.music
    ? { ...project.music, url: inlineUrl(project.music.url, origin) }
    : undefined;

  const inputProps = {
    scenes,
    fps: project.fps,
    width: project.width,
    height: project.height,
    characters,
    sfx,
    music,
    captionStyle: project.captionStyle,
  };

  job.state = "rendering";
  // Preflight: HEAD every URL the renderer will fetch. Catches broken
  // imageUrls / audioUrls / videoUrls before we waste 60+ seconds inside
  // renderMedia waiting for the timeout. Inline (data:) URLs are skipped.
  job.stage = "preflight";
  emit(job, { type: "stage", stage: "preflight" });
  const urlsToCheck = new Set<string>();
  for (const s of scenes) {
    if (s.background.imageUrl?.startsWith("http")) urlsToCheck.add(s.background.imageUrl);
    if (s.background.videoUrl?.startsWith("http")) urlsToCheck.add(s.background.videoUrl);
    if (s.voiceover?.audioUrl?.startsWith("http")) urlsToCheck.add(s.voiceover.audioUrl);
    if (s.sceneSfxUrl?.startsWith("http")) urlsToCheck.add(s.sceneSfxUrl);
    if (s.montageUrls) for (const u of s.montageUrls) if (u.startsWith("http")) urlsToCheck.add(u);
    if (s.splitLeftUrl?.startsWith("http")) urlsToCheck.add(s.splitLeftUrl);
    if (s.splitRightUrl?.startsWith("http")) urlsToCheck.add(s.splitRightUrl);
  }
  if (music?.url?.startsWith("http")) urlsToCheck.add(music.url);
  const failures: Array<{ url: string; status: number | string }> = [];
  await Promise.all(
    [...urlsToCheck].map(async (u) => {
      try {
        const res = await fetch(u, { method: "HEAD" });
        if (!res.ok) failures.push({ url: u, status: res.status });
      } catch (e) {
        failures.push({ url: u, status: e instanceof Error ? e.message : "fetch failed" });
      }
    }),
  );
  if (failures.length > 0) {
    const summary = failures
      .slice(0, 8)
      .map((f) => `  · ${f.status} ${f.url.slice(0, 100)}`)
      .join("\n");
    throw new Error(
      `Preflight failed — ${failures.length} unreachable URL${failures.length === 1 ? "" : "s"}:\n${summary}\n\nFix or remove these scenes before rendering.`,
    );
  }

  job.stage = "bundling";
  emit(job, { type: "stage", stage: "bundling" });

  const serveUrl = await getRemotionBundle();

  job.stage = "selecting-composition";
  emit(job, { type: "stage", stage: "selecting-composition" });

  const composition = await selectComposition({
    serveUrl,
    id: "VibeEditVideo",
    inputProps,
  });
  job.totalFrames = composition.durationInFrames;
  emit(job, {
    type: "composition",
    totalFrames: composition.durationInFrames,
    fps: composition.fps,
    width: composition.width,
    height: composition.height,
  });

  job.stage = "rendering";
  emit(job, { type: "stage", stage: "rendering" });

  const outPath = path.join(os.tmpdir(), `vibeedit-${job.id}.${preset.extension}`);

  await renderMedia({
    composition,
    serveUrl,
    codec: preset.codec,
    outputLocation: outPath,
    inputProps,
    scale: preset.scale,
    // Visibly sharper finals: lower CRF (perceptually-lossless region) and
    // higher audio bitrate so platform re-encodes don't gut quality.
    crf: 18,
    jpegQuality: 95,
    audioBitrate: "192k",
    x264Preset: "slow",
    onProgress: ({ progress, renderedFrames, stitchStage }) => {
      job.progress = progress;
      job.renderedFrames = renderedFrames;
      job.stage = stitchStage;
      emit(job, {
        type: "progress",
        progress,
        renderedFrames,
        totalFrames: job.totalFrames,
        stage: stitchStage,
      });
    },
  });

  const stat = await fs.promises.stat(outPath);
  job.outputPath = outPath;
  job.sizeBytes = stat.size;
  job.state = "done";
  job.progress = 1;
  emit(job, { type: "done", sizeBytes: stat.size, extension: preset.extension });
}
