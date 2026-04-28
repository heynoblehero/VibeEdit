import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { renderStill, selectComposition } from "@remotion/renderer";
import type { Project, Scene } from "@/lib/scene-schema";
import { sceneDurationFrames } from "@/lib/scene-schema";
import { getRemotionBundle } from "./remotion-bundle";
import { inlineUrl } from "./inline-assets";

/**
 * Render a single scene to a still PNG via Remotion's renderStill.
 *
 * Used by the agent's renderPreviewFrame tool for self-verification:
 * after a burst of edits, the agent renders the affected scene at
 * mid-duration and the route attaches the PNG as a multimodal image
 * block in the next conversation turn. Closes the trust gap — Claude
 * literally sees what the user sees instead of inferring from JSON.
 *
 * Why a one-scene composition instead of seeking inside the full
 * project: rendering one scene at one frame is ~1s; rendering the
 * full project to seek to second 28 is ~5s and costs more memory.
 * The agent rarely needs cross-scene context for a self-check.
 */
export interface StillResult {
  /** base64-encoded PNG bytes (no data: prefix). */
  base64: string;
  width: number;
  height: number;
  /** Which frame within the scene we sampled. */
  frame: number;
}

interface RenderStillOptions {
  project: Project;
  sceneId: string;
  /** Frame within the scene (0-based). Defaults to scene midpoint. */
  frameOffset?: number;
  characters: Record<string, string>;
  sfx: Record<string, string>;
  origin: string;
  /** Scale factor for the output PNG. 0.5 = half-resolution = 4× faster
   *  and 4× smaller payload to the model. Default 0.5 for screenshots. */
  scale?: number;
}

export async function renderSceneStill(
  opts: RenderStillOptions,
): Promise<StillResult> {
  const { project, sceneId, characters, sfx, origin } = opts;
  const scale = opts.scale ?? 0.5;
  const scene = project.scenes.find((s) => s.id === sceneId);
  if (!scene) throw new Error(`scene ${sceneId} not in project`);

  // Inline every URL the same way render-jobs.ts does so absolute /uploads
  // and /voiceovers paths resolve from the bundle.
  const inlinedScene: Scene = {
    ...scene,
    voiceover: scene.voiceover
      ? { ...scene.voiceover, audioUrl: inlineUrl(scene.voiceover.audioUrl, origin) }
      : scene.voiceover,
    background: {
      ...scene.background,
      imageUrl: scene.background.imageUrl
        ? inlineUrl(scene.background.imageUrl, origin)
        : scene.background.imageUrl,
      videoUrl: scene.background.videoUrl
        ? inlineUrl(scene.background.videoUrl, origin)
        : scene.background.videoUrl,
    },
    broll: scene.broll?.map((b) => ({
      ...b,
      url: inlineUrl(b.url, origin),
      thumbUrl: b.thumbUrl ? inlineUrl(b.thumbUrl, origin) : b.thumbUrl,
    })),
  };

  const inlinedCharacters = Object.fromEntries(
    Object.entries(characters).map(([k, v]) => [k, inlineUrl(v, origin)]),
  );
  const inlinedSfx = Object.fromEntries(
    Object.entries(sfx).map(([k, v]) => [k, inlineUrl(v, origin)]),
  );

  const inputProps = {
    scenes: [inlinedScene],
    fps: project.fps,
    width: project.width,
    height: project.height,
    characters: inlinedCharacters,
    sfx: inlinedSfx,
    music: undefined, // music is silent on a still
    captionStyle: project.captionStyle,
    cuts: undefined, // single-scene render has no cuts
    audioMix: undefined,
    tracks: undefined,
  };

  const sceneFrames = Math.max(1, sceneDurationFrames(scene, project.fps));
  const frameOffset = Math.max(
    0,
    Math.min(
      sceneFrames - 1,
      typeof opts.frameOffset === "number"
        ? Math.round(opts.frameOffset)
        : Math.floor(sceneFrames / 2),
    ),
  );

  const serveUrl = await getRemotionBundle();
  const composition = await selectComposition({
    serveUrl,
    id: "VibeEditVideo",
    inputProps,
  });

  const outPath = path.join(
    os.tmpdir(),
    `vibeedit-still-${randomUUID()}.png`,
  );

  try {
    await renderStill({
      composition,
      serveUrl,
      output: outPath,
      inputProps,
      frame: frameOffset,
      scale,
      jpegQuality: 90,
    });

    const bytes = await fs.promises.readFile(outPath);
    return {
      base64: bytes.toString("base64"),
      width: Math.round(composition.width * scale),
      height: Math.round(composition.height * scale),
      frame: frameOffset,
    };
  } finally {
    fs.promises.unlink(outPath).catch(() => {});
  }
}
