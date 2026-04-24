import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import crypto from "node:crypto";
import { renderStill, selectComposition } from "@remotion/renderer";
import type { Scene } from "@/lib/scene-schema";
import { getRemotionBundle } from "./remotion-bundle";

const cacheDir = path.join(os.tmpdir(), "vibeedit-thumbs");
try {
  fs.mkdirSync(cacheDir, { recursive: true });
} catch {
  // dir exists
}

export interface ThumbnailInput {
  scene: Scene;
  width: number;
  height: number;
  fps: number;
  characters: Record<string, string>;
  sfx: Record<string, string>;
  orientation: "landscape" | "portrait";
  frame?: number;
  scale?: number;
}

export function thumbnailKey(input: ThumbnailInput): string {
  const relevantScene = {
    ...input.scene,
    broll: undefined,
    sfxId: undefined,
  };
  const payload = JSON.stringify({
    s: relevantScene,
    w: input.width,
    h: input.height,
    fps: input.fps,
    chars: input.characters,
    orientation: input.orientation,
    frame: input.frame ?? null,
    scale: input.scale ?? null,
  });
  return crypto.createHash("sha1").update(payload).digest("hex").slice(0, 20);
}

export async function getThumbnail(
  input: ThumbnailInput,
): Promise<{ path: string; buffer: Buffer }> {
  const key = thumbnailKey(input);
  const outPath = path.join(cacheDir, `${key}.jpg`);

  try {
    const buffer = await fs.promises.readFile(outPath);
    return { path: outPath, buffer };
  } catch {
    // cache miss — render below
  }

  const serveUrl = await getRemotionBundle();

  const inputProps = {
    scenes: [input.scene],
    fps: input.fps,
    width: input.width,
    height: input.height,
    characters: input.characters,
    sfx: input.sfx,
  };

  const composition = await selectComposition({
    serveUrl,
    id: "VibeEditVideo",
    inputProps,
  });

  const targetFrame =
    typeof input.frame === "number"
      ? Math.min(
          composition.durationInFrames - 1,
          Math.max(0, Math.round(input.frame)),
        )
      : Math.min(18, Math.max(0, composition.durationInFrames - 1));

  await renderStill({
    composition,
    serveUrl,
    output: outPath,
    inputProps,
    imageFormat: "jpeg",
    jpegQuality: 82,
    frame: targetFrame,
    scale: input.scale ?? 0.25,
    overwrite: true,
  });

  const buffer = await fs.promises.readFile(outPath);
  return { path: outPath, buffer };
}
