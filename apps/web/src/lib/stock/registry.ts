// Stock asset registry — metadata only.
// Actual files live under apps/web/public/stock/{kind}/<slug>.<ext>
// In production: pre-download CC0 assets and place them in /public/stock/.
// For local dev, this registry stands as the catalog and the agent can list it.

import { existsSync } from "node:fs";
import { resolve } from "node:path";

export type StockKind = "sfx" | "broll" | "character" | "music";

export type StockAsset = {
  slug: string;
  kind: StockKind;
  name: string;
  tags: string[];
  durationSeconds?: number;
  licence: string;
  url: string; // public served path
  credit?: string;
  // Music-only metadata. Mood tags drive auto-selection.
  mood?: string[];
  bpm?: number;
  loopable?: boolean;
};

export const STOCK_REGISTRY: StockAsset[] = [
  // SFX — Kenney.nl CC0 sound packs (interface / impact / sci-fi / RPG audio).
  // Public domain, no attribution required. Files are .ogg.
  {
    slug: "whoosh-fast",
    kind: "sfx",
    name: "Whoosh fast",
    tags: ["whoosh", "transition", "swoosh", "fast"],
    durationSeconds: 0.5,
    licence: "CC0",
    url: "/stock/sfx/whoosh-fast.ogg",
  },
  {
    slug: "glass-crack",
    kind: "sfx",
    name: "Glass crack",
    tags: ["impact", "break", "smash", "comic"],
    durationSeconds: 0.7,
    licence: "CC0",
    url: "/stock/sfx/glass-crack.ogg",
  },
  {
    slug: "riser-dramatic",
    kind: "sfx",
    name: "Dramatic riser",
    tags: ["riser", "build", "tension", "dramatic"],
    durationSeconds: 3.5,
    licence: "CC0",
    url: "/stock/sfx/riser-dramatic.ogg",
  },
  {
    slug: "sub-bass-hit",
    kind: "sfx",
    name: "Sub-bass hit",
    tags: ["impact", "bass", "drop", "hit"],
    durationSeconds: 1.0,
    licence: "CC0",
    url: "/stock/sfx/sub-bass-hit.ogg",
  },
  {
    slug: "retro-chime",
    kind: "sfx",
    name: "Retro chime",
    tags: ["chime", "ui", "retro", "ping"],
    durationSeconds: 0.6,
    licence: "CC0",
    url: "/stock/sfx/retro-chime.ogg",
  },
  {
    slug: "shutter-click",
    kind: "sfx",
    name: "Shutter click",
    tags: ["camera", "shutter", "click", "stamp"],
    durationSeconds: 0.3,
    licence: "CC0",
    url: "/stock/sfx/shutter-click.ogg",
  },
  {
    slug: "scanline-buzz",
    kind: "sfx",
    name: "Scanline buzz",
    tags: ["glitch", "scifi", "buzz", "tv"],
    durationSeconds: 1.4,
    licence: "CC0",
    url: "/stock/sfx/scanline-buzz.ogg",
  },
  {
    slug: "page-flip",
    kind: "sfx",
    name: "Page flip",
    tags: ["paper", "history", "flip", "book"],
    durationSeconds: 0.5,
    licence: "CC0",
    url: "/stock/sfx/page-flip.ogg",
  },

  // B-roll (Pexels CC0 archetypes)
  {
    slug: "neon-city-aerial",
    kind: "broll",
    name: "Neon city aerial",
    tags: ["city", "neon", "night", "aerial", "tech"],
    durationSeconds: 12,
    licence: "Pexels",
    url: "/stock/broll/neon-city-aerial.mp4",
    credit: "Pexels",
  },
  {
    slug: "money-rain",
    kind: "broll",
    name: "Money rain",
    tags: ["money", "cash", "finance", "wealth"],
    durationSeconds: 8,
    licence: "Pexels",
    url: "/stock/broll/money-rain.mp4",
    credit: "Pexels",
  },
  {
    slug: "glitch-overlay",
    kind: "broll",
    name: "Glitch overlay",
    tags: ["glitch", "overlay", "vhs", "distortion"],
    durationSeconds: 5,
    licence: "Pexels",
    url: "/stock/broll/glitch-overlay.mp4",
    credit: "Pexels",
  },
  {
    slug: "particles-purple",
    kind: "broll",
    name: "Purple particles",
    tags: ["particles", "purple", "mystic", "loop"],
    durationSeconds: 10,
    licence: "Pexels",
    url: "/stock/broll/particles-purple.mp4",
    credit: "Pexels",
  },
  {
    slug: "starfield-slow",
    kind: "broll",
    name: "Slow starfield",
    tags: ["space", "stars", "scifi", "slow"],
    durationSeconds: 15,
    licence: "Pexels",
    url: "/stock/broll/starfield-slow.mp4",
    credit: "Pexels",
  },
  {
    slug: "parchment-burn",
    kind: "broll",
    name: "Parchment burn",
    tags: ["paper", "history", "fire", "old"],
    durationSeconds: 7,
    licence: "Pexels",
    url: "/stock/broll/parchment-burn.mp4",
    credit: "Pexels",
  },
  {
    slug: "rain-window",
    kind: "broll",
    name: "Rain on window",
    tags: ["rain", "calm", "sleep", "ambient"],
    durationSeconds: 20,
    licence: "Pexels",
    url: "/stock/broll/rain-window.mp4",
    credit: "Pexels",
  },

  // Music beds (CC0 placeholders — replace files when commissioned/sourced).
  // Each is mood-tagged so the agent can pick by composition vibe.
  {
    slug: "music-comic-pulse",
    kind: "music",
    name: "Comic Pulse",
    tags: ["loop", "energetic", "comic", "hook"],
    mood: ["energetic", "punchy", "playful"],
    bpm: 128,
    loopable: true,
    durationSeconds: 30,
    licence: "CC0",
    url: "/stock/music/comic-pulse.mp3",
  },
  {
    slug: "music-anime-rush",
    kind: "music",
    name: "Anime Rush",
    tags: ["loop", "energetic", "electronic", "anime"],
    mood: ["energetic", "intense", "playful"],
    bpm: 140,
    loopable: true,
    durationSeconds: 30,
    licence: "CC0",
    url: "/stock/music/anime-rush.mp3",
  },
  {
    slug: "music-history-drone",
    kind: "music",
    name: "History Drone",
    tags: ["ambient", "history", "tension", "slow"],
    mood: ["solemn", "mysterious", "calm"],
    bpm: 70,
    loopable: true,
    durationSeconds: 45,
    licence: "CC0",
    url: "/stock/music/history-drone.mp3",
  },
  {
    slug: "music-finance-pulse",
    kind: "music",
    name: "Finance Pulse",
    tags: ["loop", "modern", "techno", "finance"],
    mood: ["confident", "modern", "punchy"],
    bpm: 124,
    loopable: true,
    durationSeconds: 30,
    licence: "CC0",
    url: "/stock/music/finance-pulse.mp3",
  },
  {
    slug: "music-sleep-pad",
    kind: "music",
    name: "Sleep Pad",
    tags: ["ambient", "soft", "sleep", "calm"],
    mood: ["calm", "peaceful", "warm"],
    bpm: 55,
    loopable: true,
    durationSeconds: 60,
    licence: "CC0",
    url: "/stock/music/sleep-pad.mp3",
  },
  {
    slug: "music-scary-rumble",
    kind: "music",
    name: "Scary Rumble",
    tags: ["ambient", "horror", "tension", "low"],
    mood: ["ominous", "tense", "dark"],
    bpm: 60,
    loopable: true,
    durationSeconds: 45,
    licence: "CC0",
    url: "/stock/music/scary-rumble.mp3",
  },
  {
    slug: "music-tech-driver",
    kind: "music",
    name: "Tech Driver",
    tags: ["loop", "modern", "tech", "driving"],
    mood: ["focused", "modern", "confident"],
    bpm: 118,
    loopable: true,
    durationSeconds: 30,
    licence: "CC0",
    url: "/stock/music/tech-driver.mp3",
  },
  {
    slug: "music-scifi-pulse",
    kind: "music",
    name: "Sci-fi Pulse",
    tags: ["ambient", "scifi", "mystery", "pulse"],
    mood: ["mysterious", "tense", "modern"],
    bpm: 90,
    loopable: true,
    durationSeconds: 40,
    licence: "CC0",
    url: "/stock/music/scifi-pulse.mp3",
  },

  // Character illustrations (placeholder — generate or commission)
  {
    slug: "host-analyst",
    kind: "character",
    name: "The Analyst",
    tags: ["host", "professional", "finance", "tech"],
    licence: "Self-created",
    url: "/stock/character/host-analyst.png",
  },
  {
    slug: "host-narrator",
    kind: "character",
    name: "The Narrator",
    tags: ["host", "storyteller", "history", "sleep"],
    licence: "Self-created",
    url: "/stock/character/host-narrator.png",
  },
  {
    slug: "host-investigator",
    kind: "character",
    name: "The Investigator",
    tags: ["host", "mystery", "scary", "scifi"],
    licence: "Self-created",
    url: "/stock/character/host-investigator.png",
  },
];

// The registry lists archetypes for every kind, but only assets whose files
// have actually been placed under public/stock/ can be served. Surfacing a
// phantom entry to the agent is how compositions end up referencing a URL that
// 404s at preview/render time — e.g. an SFX track that never plays, leaving the
// video silent. Filter to assets that exist on disk so find_stock (and the
// public stock API) only ever hand out playable URLs.
function assetFileExists(asset: StockAsset): boolean {
  const rel = asset.url.replace(/^\/+/, "").split(/[?#]/)[0];
  const abs = resolve(process.cwd(), "public", rel);
  return existsSync(abs);
}

let availableCache: StockAsset[] | null = null;
function availableStock(): StockAsset[] {
  if (availableCache) return availableCache;
  availableCache = STOCK_REGISTRY.filter(assetFileExists);
  return availableCache;
}

export function searchStock(query: string, kind?: StockKind): StockAsset[] {
  const registry = availableStock();
  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .filter((s) => s.length >= 2);
  if (terms.length === 0) {
    return kind ? registry.filter((a) => a.kind === kind) : registry;
  }
  const scored = registry
    .filter((a) => !kind || a.kind === kind)
    .map((asset) => {
      const moodList = asset.mood || [];
      const hay = (
        asset.name +
        " " +
        asset.tags.join(" ") +
        " " +
        moodList.join(" ")
      ).toLowerCase();
      let score = 0;
      for (const term of terms) {
        if (hay.includes(term)) score += 1;
        if (asset.tags.includes(term)) score += 2;
        if (moodList.includes(term)) score += 3;
      }
      return { asset, score };
    });
  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((s) => s.asset);
}

export function getStockBySlug(slug: string): StockAsset | null {
  return STOCK_REGISTRY.find((a) => a.slug === slug) || null;
}
