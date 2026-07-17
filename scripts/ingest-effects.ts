// Effects Store ingest — normalize the curated pack into web-ready files +
// animated previews + a catalog the app + agent consume.
//
// Run locally (assets are huge + unlicensed-for-redistribution until curated):
//   npx tsx scripts/ingest-effects.ts
//
// Auto-walks the pack, classifies each file by its folder (category + how to
// composite: black-screen overlays → "screen", animated backgrounds → "normal",
// SFX → audio), normalizes with ffmpeg (cap 1080p, drop overlay audio, loudnorm
// SFX), makes a 2s webp preview, and writes catalog.generated.json. Prefers HD
// over 4K; skips Adobe presets, green-screen (no chroma yet), character stills,
// and junk compilations.
//
// Outputs to OUT_DIR (outside git): files/<presetId>.<ext>, previews/<presetId>.<ext>,
// catalog.generated.json → rsync files/+previews/ to /data/storage/effects on the
// server; copy catalog into apps/web/src/lib/effects/catalog.json.

import { spawnSync } from "node:child_process";
import { mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

const SRC = "/home/ishaan/Downloads/ASSETS";
const OUT_DIR = "/home/ishaan/Downloads/effects-staging";
const FILES_DIR = join(OUT_DIR, "files");
const PREVIEW_DIR = join(OUT_DIR, "previews");
const LICENSE = "starter-pack (intro-hd.net) — rights unverified, replace before promotion";

type Blend = "screen" | "alpha" | "normal";
type Category = "overlay" | "transition" | "background" | "sfx";
type Kind = "video" | "audio" | "image";

type Classification = {
  category: Category;
  kind: Kind;
  blend: Blend;
  descriptionFor: (name: string) => string;
  useWhen: string[];
};

// Classify by lowercased relative path. Returns null to SKIP the file.
function classify(rel: string): Classification | null {
  const p = rel.toLowerCase();
  if (p.includes("/4k/")) return null; // prefer HD — skip the 4K duplicates
  if (/\.(ffx|prfpset|aep|url|ini|aep)$/i.test(p)) return null; // Adobe / junk
  if (p.includes("green screen")) return null; // no in-browser chroma yet
  if (p.includes("download it") || p.includes("scribble")) return null; // promo compilation
  if (p.includes("/characters/")) return null; // a specific person, not generic

  if (p.endsWith(".mp3")) {
    return {
      category: "sfx",
      kind: "audio",
      blend: "normal",
      useWhen: sfxTags(p),
      descriptionFor: (n) =>
        `Sound effect — ${n.toLowerCase()}. Fire it on a cut, beat, or reveal.`,
    };
  }
  if (!p.endsWith(".mp4")) return null; // (png graphics handled later if wanted)

  if (p.includes("film burn"))
    return {
      category: "overlay",
      kind: "video",
      blend: "screen",
      useWhen: ["warm", "vintage", "analog", "film", "retro", "grain", "transition"],
      descriptionFor: () =>
        "Warm analog film-burn overlay — orange light bleeds across the frame (screen blend).",
    };
  if (p.includes("light leak"))
    return {
      category: "overlay",
      kind: "video",
      blend: "screen",
      useWhen: ["warm", "dreamy", "soft", "glow", "leak", "atmospheric", "scene-open"],
      descriptionFor: () =>
        "Soft light-leak overlay — a warm glow drifts across the scene (screen blend).",
    };
  if (p.includes("bokeh"))
    return {
      category: "overlay",
      kind: "video",
      blend: "screen",
      useWhen: ["dreamy", "soft", "particles", "depth", "romantic", "ambient", "bokeh"],
      descriptionFor: () =>
        "Dreamy out-of-focus bokeh particles drifting over the scene (screen blend).",
    };
  if (p.includes("flames transition"))
    return {
      category: "transition",
      kind: "video",
      blend: "screen",
      useWhen: ["fire", "flames", "dramatic", "transition", "intense", "energy"],
      descriptionFor: () =>
        "Fire sweeps across the frame — a dramatic scene-to-scene transition (screen blend).",
    };
  if (p.includes("flash"))
    return {
      category: "transition",
      kind: "video",
      blend: "screen",
      useWhen: ["impact", "flash", "punch", "beat", "transition", "energy"],
      descriptionFor: () =>
        "A quick light flash — a punchy transition hit between cuts (screen blend).",
    };
  if (p.includes("breaking glass"))
    return {
      category: "overlay",
      kind: "video",
      blend: "screen",
      useWhen: ["shatter", "glass", "impact", "break", "dramatic"],
      descriptionFor: () => "Shattering glass overlay — a hard impact effect (screen blend).",
    };
  if (p.includes("neon"))
    return {
      category: "overlay",
      kind: "video",
      blend: "screen",
      useWhen: ["neon", "glow", "vibrant", "night", "energy"],
      descriptionFor: () => "Neon light overlay — glowing accents over the scene (screen blend).",
    };
  // Animated backgrounds (Shadow Grid / Vibrant Flow / Flames BG, or anything "BG").
  if (
    p.includes("animated background") ||
    p.includes("shadow grid") ||
    p.includes("vibrant flow") ||
    /\bbg\b/.test(p)
  )
    return {
      category: "background",
      kind: "video",
      blend: "normal",
      useWhen: bgTags(p),
      descriptionFor: (n) => `Animated full-frame background — ${n.toLowerCase()}.`,
    };
  return null;
}

function sfxTags(p: string): string[] {
  const t = ["sfx"];
  if (p.includes("whoosh") || p.includes("swoosh")) t.push("whoosh", "transition", "cut");
  if (p.includes("riser")) t.push("riser", "build", "tension", "reveal");
  if (p.includes("click") || p.includes("tap") || p.includes("mouse")) t.push("click", "tap", "ui");
  if (p.includes("shutter") || p.includes("camera")) t.push("shutter", "photo", "snap");
  if (p.includes("distortion")) t.push("distortion", "glitch", "harsh");
  if (p.includes("typing")) t.push("typing", "keyboard");
  if (p.includes("gear")) t.push("mechanical", "gear");
  return t;
}

function bgTags(p: string): string[] {
  const t = ["backdrop", "abstract", "modern"];
  if (p.includes("shadow grid")) t.push("grid", "techy", "minimal", "corporate");
  if (p.includes("vibrant flow")) t.push("colorful", "gradient", "energetic", "vivid");
  if (p.includes("flames")) t.push("fire", "warm", "dramatic");
  if (p.includes("/black/") || p.includes("black bg")) t.push("dark");
  if (p.includes("/white/") || p.includes("white bg")) t.push("light", "clean");
  return t;
}

// Human name from filename: drop extension + "(HD)"/"(4K)" + tidy whitespace.
function niceName(fileName: string): string {
  return fileName
    .replace(/\.[^.]+$/, "")
    .replace(/\((?:hd|4k)\)/gi, "")
    .replace(/[_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

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

function walk(dir: string, out: string[]): void {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
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
  const all: string[] = [];
  walk(SRC, all);

  const catalog: CatalogEntry[] = [];
  const usedIds = new Set<string>();
  let skipped = 0;
  let failed = 0;

  for (const abs of all.sort()) {
    const rel = relative(SRC, abs);
    const cls = classify(rel);
    if (!cls) {
      skipped += 1;
      continue;
    }
    const name = niceName(abs.split("/").pop() as string);
    let presetId = slug(name);
    // Prefix by category-ish folder hint on collision so ids stay unique + readable.
    if (usedIds.has(presetId)) {
      const hint = slug(rel.split("/").slice(-3, -1).join("-")).slice(0, 24);
      presetId = slug(`${hint}-${name}`);
    }
    let n = 2;
    let base = presetId;
    while (usedIds.has(presetId)) presetId = `${base}-${n++}`;
    usedIds.add(presetId);

    if (cls.kind === "video") {
      const outFile = join(FILES_DIR, `${presetId}.mp4`);
      const outPrev = join(PREVIEW_DIR, `${presetId}.webp`);
      const v = run("ffmpeg", [
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
      if (!v.ok) {
        console.warn(`FAIL ${presetId}: ${v.out.slice(-160)}`);
        failed += 1;
        continue;
      }
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
        presetId,
        name,
        description: cls.descriptionFor(name),
        category: cls.category,
        kind: "video",
        useWhen: cls.useWhen,
        compositing: {
          blend: cls.blend,
          defaultOpacity: cls.blend === "screen" ? 0.85 : 1,
          loop: true,
          hasAudio: false,
        },
        durationSeconds: probeDuration(outFile),
        ext: "mp4",
        previewExt: "webp",
        license: LICENSE,
      });
    } else if (cls.kind === "audio") {
      const outFile = join(FILES_DIR, `${presetId}.mp3`);
      const outPrev = join(PREVIEW_DIR, `${presetId}.png`);
      const a = run("ffmpeg", [
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
      if (!a.ok) {
        console.warn(`FAIL ${presetId}: ${a.out.slice(-160)}`);
        failed += 1;
        continue;
      }
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
        presetId,
        name,
        description: cls.descriptionFor(name),
        category: cls.category,
        kind: "audio",
        useWhen: cls.useWhen,
        compositing: { blend: "normal", hasAudio: true },
        durationSeconds: probeDuration(outFile),
        ext: "mp3",
        previewExt: "png",
        license: LICENSE,
      });
    }
    if (catalog.length % 10 === 0) console.log(`  …${catalog.length} done`);
  }

  writeFileSync(join(OUT_DIR, "catalog.generated.json"), `${JSON.stringify(catalog, null, 2)}\n`);
  const byCat = catalog.reduce<Record<string, number>>((acc, e) => {
    acc[e.category] = (acc[e.category] ?? 0) + 1;
    return acc;
  }, {});
  console.log(`\n=== INGEST COMPLETE ===`);
  console.log(`catalog entries: ${catalog.length}  (skipped ${skipped}, failed ${failed})`);
  console.log(`by category: ${JSON.stringify(byCat)}`);
  console.log(`staged → ${OUT_DIR}`);
}

main();
