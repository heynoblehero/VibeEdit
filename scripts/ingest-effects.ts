// Effects Store ingest — normalize a curated set of pack assets into web-ready
// files + animated previews, and emit a catalog the app + agent consume.
//
// Run locally (assets are huge and unlicensed-for-redistribution until curated):
//   npx tsx scripts/ingest-effects.ts
//
// Outputs to OUT_DIR (outside git): files/<presetId>.<ext>, previews/<presetId>.webp|png,
// and catalog.generated.json. The files/ + previews/ dirs get rsync'd to the
// server's persistent volume (/data/effects); catalog.generated.json is copied
// into apps/web/src/lib/effects/catalog.ts.
//
// Compositing is hand-assigned per curated item (auto-detection is a later
// scaling step): pack overlays (film burn / light leak / bokeh / flash / flames)
// are black-background → "screen"; animated backgrounds are "normal"; SFX audio.

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const SRC = "/home/ishaan/Downloads/ASSETS";
const OUT_DIR = "/home/ishaan/Downloads/effects-staging";
const FILES_DIR = join(OUT_DIR, "files");
const PREVIEW_DIR = join(OUT_DIR, "previews");

type Blend = "screen" | "alpha" | "normal";
type Category = "overlay" | "background" | "sfx";
type Kind = "video" | "audio" | "image";

type SeedItem = {
  presetId: string;
  name: string;
  description: string;
  category: Category;
  kind: Kind;
  blend: Blend;
  useWhen: string[];
  src: string; // relative to SRC
};

// Curated seed — HD versions (lighter to transcode than 4K). License: the pack is
// "free off the net" (intro-hd.net); ships as a STARTER set, unverified rights.
const LICENSE = "starter-pack (intro-hd.net) — rights unverified, replace before promotion";

const SEED: SeedItem[] = [
  // --- Overlays (black-screen → screen blend) ---
  {
    presetId: "film-burn-01",
    name: "Film Burn 01",
    description: "Warm analog film burn — orange light bleeds across the frame.",
    category: "overlay",
    kind: "video",
    blend: "screen",
    useWhen: ["warm", "vintage", "analog", "transition", "retro", "grain"],
    src: "Pro Edit Pack/Film Burns( @Afters_effect )/HD/Film Burn 1 (HD).mp4",
  },
  {
    presetId: "film-burn-07",
    name: "Film Burn 07",
    description: "Intense film burn flare — strong orange/red bloom, good for hard cuts.",
    category: "overlay",
    kind: "video",
    blend: "screen",
    useWhen: ["warm", "vintage", "flare", "transition", "impact", "retro"],
    src: "Pro Edit Pack/Film Burns( @Afters_effect )/HD/Film Burn 7 (HD).mp4",
  },
  {
    presetId: "light-leak-short-01",
    name: "Light Leak (short)",
    description: "Quick soft light leak sweep — subtle warm glow across a scene.",
    category: "overlay",
    kind: "video",
    blend: "screen",
    useWhen: ["warm", "dreamy", "soft", "scene-open", "subtle", "glow"],
    src: "Pro Edit Pack/Light Leaks( @Afters_effect )/HD/Short/Light Leak Short 1 (HD).mp4",
  },
  {
    presetId: "light-leak-long-01",
    name: "Light Leak (long)",
    description: "Slow drifting light leak — atmospheric warm haze for longer holds.",
    category: "overlay",
    kind: "video",
    blend: "screen",
    useWhen: ["warm", "dreamy", "atmospheric", "ambient", "hold", "glow"],
    src: "Pro Edit Pack/Light Leaks( @Afters_effect )/HD/Long/Light Leak Long 10 (HD).mp4",
  },
  {
    presetId: "bokeh-01",
    name: "Bokeh Particles",
    description: "Soft out-of-focus light dots drifting — dreamy depth over any scene.",
    category: "overlay",
    kind: "video",
    blend: "screen",
    useWhen: ["dreamy", "soft", "particles", "romantic", "ambient", "depth"],
    src: "Pro Edit Pack/Bokeh( @Afters_effect )/HD/Short/Bokeh Short 1 (HD).mp4",
  },
  {
    presetId: "flash-01",
    name: "Light Flash",
    description: "Quick white light flash — punchy transition hit between cuts.",
    category: "overlay",
    kind: "video",
    blend: "screen",
    useWhen: ["impact", "transition", "punch", "beat", "energy", "hit"],
    src: "Pro Edit Pack/Flashes( @Afters_effect )/HD/Flash 1 (HD).mp4",
  },
  {
    presetId: "flames-transition-01",
    name: "Blue Flames Transition",
    description: "Blue fire sweeps upward across the frame — dramatic scene transition.",
    category: "overlay",
    kind: "video",
    blend: "screen",
    useWhen: ["fire", "dramatic", "transition", "intense", "energy", "cool"],
    src: "Pro Edit Pack/Flames Transitions( @Afters_effect )/HD/Blue Flames UP (HD).mp4",
  },
  // --- Animated backgrounds (full-frame → normal) ---
  {
    presetId: "bg-vibrant-flow-01",
    name: "Vibrant Flow BG",
    description: "Smooth flowing gradient of vivid color — a lively full-frame backdrop.",
    category: "background",
    kind: "video",
    blend: "normal",
    useWhen: ["colorful", "gradient", "modern", "backdrop", "energetic", "abstract"],
    src: "Pro Edit Pack/Animated Backgrounds( @Afters_effect )/2 Vibrant Flow/HD/BG 1 (HD).mp4",
  },
  {
    presetId: "bg-shadow-grid-black-01",
    name: "Shadow Grid BG (dark)",
    description: "Subtle animated grid of shifting shadows on black — clean techy backdrop.",
    category: "background",
    kind: "video",
    blend: "normal",
    useWhen: ["dark", "grid", "techy", "minimal", "backdrop", "corporate"],
    src: "Pro Edit Pack/Animated Backgrounds( @Afters_effect )/1 Shadow Grid/HD/Black/Black BG 1 (HD).mp4",
  },
  // --- SFX (audio) ---
  {
    presetId: "sfx-swoosh-01",
    name: "Swoosh",
    description: "Fast whoosh — pairs with a cut, wipe, or fast motion.",
    category: "sfx",
    kind: "audio",
    blend: "normal",
    useWhen: ["whoosh", "transition", "cut", "fast", "swipe"],
    src: "Issac Pack/SFX/swoosh-2-359826.mp3",
  },
  {
    presetId: "sfx-riser-01",
    name: "Riser (metallic)",
    description: "Building metallic riser — tension before a reveal or drop.",
    category: "sfx",
    kind: "audio",
    blend: "normal",
    useWhen: ["riser", "build", "tension", "reveal", "dramatic"],
    src: "Issac Pack/SFX/SFX - Riser Metallic (Transition).mp3",
  },
  {
    presetId: "sfx-camera-shutter-01",
    name: "Camera Shutter",
    description: "Camera shutter click — punctuates a freeze-frame or photo moment.",
    category: "sfx",
    kind: "audio",
    blend: "normal",
    useWhen: ["shutter", "photo", "freeze", "snap", "click"],
    src: "Issac Pack/SFX/camera-shutter-314056.mp3",
  },
  {
    presetId: "sfx-click-01",
    name: "UI Click",
    description: "Crisp click/tap — for UI reveals, taps, or beat accents.",
    category: "sfx",
    kind: "audio",
    blend: "normal",
    useWhen: ["click", "tap", "ui", "accent", "pop"],
    src: "Issac Pack/SFX/click-234708.mp3",
  },
];

function run(bin: string, args: string[]): { ok: boolean; out: string } {
  const r = spawnSync(bin, args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  return { ok: r.status === 0, out: `${r.stdout ?? ""}${r.stderr ?? ""}` };
}

function probeDuration(path: string): number | undefined {
  const r = run("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "csv=p=0",
    path,
  ]);
  const value = Number.parseFloat(r.out.trim());
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : undefined;
}

type CatalogEntry = {
  presetId: string;
  name: string;
  description: string;
  category: Category;
  kind: Kind;
  useWhen: string[];
  compositing: { blend: Blend; defaultOpacity?: number; loop?: boolean; hasAudio?: boolean };
  durationSeconds?: number;
  ext: string;
  previewExt: "webp" | "png";
  license: string;
};

function main() {
  for (const dir of [FILES_DIR, PREVIEW_DIR]) mkdirSync(dir, { recursive: true });
  const catalog: CatalogEntry[] = [];
  const skipped: string[] = [];

  for (const item of SEED) {
    const abs = resolve(SRC, item.src);
    if (!existsSync(abs)) {
      console.warn(`SKIP (missing): ${item.presetId} ← ${item.src}`);
      skipped.push(item.presetId);
      continue;
    }
    console.log(`\n▶ ${item.presetId}  (${item.category}/${item.kind})`);

    if (item.kind === "video") {
      const outFile = join(FILES_DIR, `${item.presetId}.mp4`);
      const outPrev = join(PREVIEW_DIR, `${item.presetId}.webp`);
      // Normalize: cap at 1080p, drop audio (overlays are muted), web-friendly.
      const v1 = run("ffmpeg", [
        "-y",
        "-i",
        abs,
        "-vf",
        "scale='min(1920,iw)':-2:flags=lanczos",
        "-an",
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        "-crf",
        "24",
        "-preset",
        "veryfast",
        "-movflags",
        "+faststart",
        outFile,
      ]);
      if (!v1.ok) {
        console.warn(`  ffmpeg normalize FAILED: ${v1.out.slice(-300)}`);
        skipped.push(item.presetId);
        continue;
      }
      // Animated preview: up to 2s loop from the start (no input seek — short
      // clips overshoot it), small, 15fps webp.
      run("ffmpeg", [
        "-y",
        "-t",
        "2",
        "-i",
        outFile,
        "-vf",
        "scale=480:-2:flags=lanczos,fps=15",
        "-an",
        "-c:v",
        "libwebp",
        "-loop",
        "0",
        "-q:v",
        "55",
        outPrev,
      ]);
      catalog.push({
        presetId: item.presetId,
        name: item.name,
        description: item.description,
        category: item.category,
        kind: item.kind,
        useWhen: item.useWhen,
        compositing: {
          blend: item.blend,
          defaultOpacity: item.blend === "screen" ? 0.85 : 1,
          loop: true,
          hasAudio: false,
        },
        durationSeconds: probeDuration(outFile),
        ext: "mp4",
        previewExt: "webp",
        license: LICENSE,
      });
    } else if (item.kind === "audio") {
      const outFile = join(FILES_DIR, `${item.presetId}.mp3`);
      const outPrev = join(PREVIEW_DIR, `${item.presetId}.png`);
      const a1 = run("ffmpeg", [
        "-y",
        "-i",
        abs,
        "-af",
        "loudnorm=I=-16:TP=-1.5:LRA=11",
        "-c:a",
        "libmp3lame",
        "-b:a",
        "192k",
        outFile,
      ]);
      if (!a1.ok) {
        console.warn(`  ffmpeg audio FAILED: ${a1.out.slice(-300)}`);
        skipped.push(item.presetId);
        continue;
      }
      // Waveform preview image (lime on transparent).
      run("ffmpeg", [
        "-y",
        "-i",
        outFile,
        "-filter_complex",
        "showwavespic=s=480x120:colors=#d4ff3a",
        "-frames:v",
        "1",
        outPrev,
      ]);
      catalog.push({
        presetId: item.presetId,
        name: item.name,
        description: item.description,
        category: item.category,
        kind: item.kind,
        useWhen: item.useWhen,
        compositing: { blend: "normal", hasAudio: true },
        durationSeconds: probeDuration(outFile),
        ext: "mp3",
        previewExt: "png",
        license: LICENSE,
      });
    }
    console.log(`  ✓ done`);
  }

  writeFileSync(join(OUT_DIR, "catalog.generated.json"), `${JSON.stringify(catalog, null, 2)}\n`);
  console.log(`\n=== INGEST COMPLETE ===`);
  console.log(`catalog entries: ${catalog.length}   skipped: ${skipped.length}`);
  if (skipped.length) console.log(`skipped: ${skipped.join(", ")}`);
  console.log(`staged → ${OUT_DIR}`);
}

main();
