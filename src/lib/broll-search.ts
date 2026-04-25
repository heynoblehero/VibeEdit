import type { BRollKind, BRollSource } from "./scene-schema";

export interface SearchResult {
  id: string;
  source: BRollSource;
  sourceId: string;
  kind: BRollKind;
  url: string;
  thumbUrl: string;
  width: number;
  height: number;
  duration?: number;
  attribution?: string;
}

async function searchPexelsVideos(query: string, apiKey: string, perPage = 6): Promise<SearchResult[]> {
  const res = await fetch(
    `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=${perPage}&orientation=landscape`,
    { headers: { Authorization: apiKey } },
  );
  if (!res.ok) return [];
  const data = await res.json();
  const videos = (data.videos ?? []) as Array<{
    id: number;
    duration: number;
    width: number;
    height: number;
    image: string;
    user?: { name: string };
    video_files: Array<{ link: string; quality: string; width: number; height: number; file_type: string }>;
  }>;
  return videos.flatMap((v) => {
    const file =
      v.video_files.find((f) => f.quality === "hd" && f.width <= 1920) ??
      v.video_files.find((f) => f.quality === "sd") ??
      v.video_files[0];
    if (!file) return [];
    return [{
      id: `pexels-v-${v.id}`,
      source: "pexels" as const,
      sourceId: String(v.id),
      kind: "clip" as const,
      url: file.link,
      thumbUrl: v.image,
      width: v.width,
      height: v.height,
      duration: v.duration,
      attribution: v.user?.name ? `Pexels / ${v.user.name}` : "Pexels",
    }];
  });
}

async function searchPexelsPhotos(query: string, apiKey: string, perPage = 6): Promise<SearchResult[]> {
  const res = await fetch(
    `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${perPage}&orientation=landscape`,
    { headers: { Authorization: apiKey } },
  );
  if (!res.ok) return [];
  const data = await res.json();
  const photos = (data.photos ?? []) as Array<{
    id: number;
    width: number;
    height: number;
    src: { large2x: string; large: string; medium: string };
    photographer?: string;
  }>;
  return photos.map((p) => ({
    id: `pexels-p-${p.id}`,
    source: "pexels" as const,
    sourceId: String(p.id),
    kind: "image" as const,
    url: p.src.large2x ?? p.src.large,
    thumbUrl: p.src.medium,
    width: p.width,
    height: p.height,
    attribution: p.photographer ? `Pexels / ${p.photographer}` : "Pexels",
  }));
}

async function searchPixabay(query: string, apiKey: string, perPage = 6): Promise<SearchResult[]> {
  const res = await fetch(
    `https://pixabay.com/api/?key=${apiKey}&q=${encodeURIComponent(query)}&per_page=${perPage}&safesearch=true&image_type=photo`,
  );
  if (!res.ok) return [];
  const data = await res.json();
  const hits = (data.hits ?? []) as Array<{
    id: number;
    webformatURL: string;
    largeImageURL: string;
    previewURL: string;
    imageWidth: number;
    imageHeight: number;
    user?: string;
  }>;
  return hits.map((h) => ({
    id: `pixabay-${h.id}`,
    source: "pixabay" as const,
    sourceId: String(h.id),
    kind: "image" as const,
    url: h.largeImageURL ?? h.webformatURL,
    thumbUrl: h.previewURL ?? h.webformatURL,
    width: h.imageWidth,
    height: h.imageHeight,
    attribution: h.user ? `Pixabay / ${h.user}` : "Pixabay",
  }));
}

async function searchTenor(query: string, apiKey: string, perPage = 6): Promise<SearchResult[]> {
  const res = await fetch(
    `https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(query)}&key=${apiKey}&limit=${perPage}&media_filter=gif,tinygif`,
  );
  if (!res.ok) return [];
  const data = await res.json();
  const results = (data.results ?? []) as Array<{
    id: string;
    media_formats: {
      gif?: { url: string; dims: [number, number] };
      tinygif?: { url: string; dims: [number, number] };
    };
    title?: string;
  }>;
  return results.flatMap((r) => {
    const gif = r.media_formats.gif;
    const tiny = r.media_formats.tinygif;
    if (!gif) return [];
    return [{
      id: `tenor-${r.id}`,
      source: "tenor" as const,
      sourceId: r.id,
      kind: "gif" as const,
      url: gif.url,
      thumbUrl: tiny?.url ?? gif.url,
      width: gif.dims?.[0] ?? 480,
      height: gif.dims?.[1] ?? 360,
      attribution: "Tenor",
    }];
  });
}

export interface SearchBundle {
  clips: SearchResult[];
  images: SearchResult[];
  gifs: SearchResult[];
}

export async function searchAllSources(query: string): Promise<SearchBundle> {
  // applyStoredKeys lives in src/lib/server/runtime-keys.ts but broll-search
  // can be imported from server-only routes — we do the dynamic import so
  // client bundles don't drag in node:fs.
  const { applyStoredKeys } = await import("./server/runtime-keys");
  applyStoredKeys();
  const pexKey = process.env.PEXELS_API_KEY;
  const pixKey = process.env.PIXABAY_API_KEY;
  const tenKey = process.env.TENOR_API_KEY;

  const [pexVids, pexPhotos, pixPhotos, tenorGifs] = await Promise.all([
    pexKey ? searchPexelsVideos(query, pexKey).catch(() => []) : Promise.resolve([]),
    pexKey ? searchPexelsPhotos(query, pexKey).catch(() => []) : Promise.resolve([]),
    pixKey ? searchPixabay(query, pixKey).catch(() => []) : Promise.resolve([]),
    tenKey ? searchTenor(query, tenKey).catch(() => []) : Promise.resolve([]),
  ]);

  return {
    clips: pexVids,
    images: [...pexPhotos, ...pixPhotos],
    gifs: tenorGifs,
  };
}
