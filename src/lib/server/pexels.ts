import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import { publicUrlFor, storageDir } from "./runtime-storage";

/**
 * Pexels stock client.
 *
 * Pexels offers a free API (https://www.pexels.com/api/) that covers
 * both photos AND videos under one key. Pixabay would add audio but
 * v1 is photos+video only — voiceover comes from TTS, music is
 * user-uploaded.
 *
 * Each search downloads the chosen asset bytes into runtime-storage's
 * uploads/ subdir (persistent across dokku redeploys) and returns the
 * `/uploads/<hash>.<ext>` URL. The renderer's preflight HEAD is then
 * a local hop, no third-party CDN dependency at render time.
 *
 * Caching: by query+kind+pexels-id hash. A repeated search for the
 * same term returns the cached file instead of re-downloading.
 */

interface PexelsPhoto {
	id: number;
	width: number;
	height: number;
	url: string;
	src: {
		original: string;
		large: string;
		medium: string;
		small: string;
		tiny: string;
	};
	photographer: string;
	alt: string;
}

interface PexelsVideoFile {
	link: string;
	width: number;
	height: number;
	quality: string;
	file_type: string;
}

interface PexelsVideo {
	id: number;
	width: number;
	height: number;
	url: string;
	image: string;
	video_files: PexelsVideoFile[];
	user: { name: string };
}

interface PexelsPhotoSearchResponse {
	page: number;
	per_page: number;
	total_results: number;
	photos: PexelsPhoto[];
}

interface PexelsVideoSearchResponse {
	page: number;
	per_page: number;
	total_results: number;
	videos: PexelsVideo[];
}

export type StockKind = "photo" | "video";

export interface StockResult {
	url: string; // local /uploads/... URL
	thumbUrl?: string;
	width: number;
	height: number;
	credit: string;
	pexelsUrl: string;
	pexelsId: number;
	kind: StockKind;
}

const API_BASE = "https://api.pexels.com";

function getKey(): string {
	const key = process.env.PEXELS_API_KEY;
	if (!key) {
		throw new Error(
			"PEXELS_API_KEY is missing. Get a free key at https://www.pexels.com/api/ and set it in .env.local.",
		);
	}
	return key;
}

/**
 * Search Pexels for photos OR videos and download the chosen results
 * into runtime-storage. Returns local URLs ready to drop into a scene.
 */
export async function searchStock(input: {
	query: string;
	kind: StockKind;
	count: number;
	orientation?: "landscape" | "portrait" | "square";
}): Promise<StockResult[]> {
	const { query, kind } = input;
	const count = Math.max(1, Math.min(6, input.count));
	const key = getKey();

	const orientation = input.orientation ?? "landscape";
	const url =
		kind === "photo"
			? `${API_BASE}/v1/search?query=${encodeURIComponent(query)}&per_page=${count}&orientation=${orientation}`
			: `${API_BASE}/videos/search?query=${encodeURIComponent(query)}&per_page=${count}&orientation=${orientation}`;

	const res = await fetch(url, {
		headers: { Authorization: key },
	});
	if (!res.ok) {
		throw new Error(
			`Pexels ${kind} search failed: HTTP ${res.status} ${await res.text().then((t) => t.slice(0, 200))}`,
		);
	}

	if (kind === "photo") {
		const data = (await res.json()) as PexelsPhotoSearchResponse;
		const out: StockResult[] = [];
		for (const photo of data.photos.slice(0, count)) {
			const local = await cacheToUploads(photo.src.large, "jpg", `pexels-photo-${photo.id}`);
			out.push({
				url: local,
				thumbUrl: photo.src.small,
				width: photo.width,
				height: photo.height,
				credit: photo.photographer,
				pexelsUrl: photo.url,
				pexelsId: photo.id,
				kind: "photo",
			});
		}
		return out;
	}

	const data = (await res.json()) as PexelsVideoSearchResponse;
	const out: StockResult[] = [];
	for (const video of data.videos.slice(0, count)) {
		// Pick a reasonably-sized HD file under 5MB ideal range. We
		// pick the highest "hd" quality, falling back to sd.
		const file = pickVideoFile(video.video_files);
		if (!file) continue;
		const ext = file.file_type.split("/")[1] ?? "mp4";
		const local = await cacheToUploads(file.link, ext, `pexels-video-${video.id}`);
		out.push({
			url: local,
			thumbUrl: video.image,
			width: file.width,
			height: file.height,
			credit: video.user.name,
			pexelsUrl: video.url,
			pexelsId: video.id,
			kind: "video",
		});
	}
	return out;
}

function pickVideoFile(files: PexelsVideoFile[]): PexelsVideoFile | undefined {
	// Prefer hd at 1920x1080-ish, fall back to sd.
	const hd = files
		.filter((f) => f.quality === "hd" && f.width >= 1080 && f.width <= 1920)
		.sort((a, b) => a.width - b.width)[0];
	if (hd) return hd;
	const sd = files.filter((f) => f.quality === "sd")[0];
	if (sd) return sd;
	return files[0];
}

/**
 * Download `srcUrl` to runtime-storage/uploads/ if not already cached.
 * Filename is `<idHint>-<sha8>.<ext>` so a repeat call with the same
 * (logical) source returns the existing file.
 */
async function cacheToUploads(
	srcUrl: string,
	ext: string,
	idHint: string,
): Promise<string> {
	const dir = storageDir("uploads");
	const hash = crypto.createHash("sha1").update(srcUrl).digest("hex").slice(0, 12);
	const safeExt = ext.replace(/[^a-z0-9]/gi, "").slice(0, 4) || "bin";
	const filename = `${idHint}-${hash}.${safeExt}`;
	const fullPath = path.join(dir, filename);
	if (fs.existsSync(fullPath)) {
		return publicUrlFor("uploads", filename);
	}
	const res = await fetch(srcUrl);
	if (!res.ok) {
		throw new Error(`Pexels asset download failed: HTTP ${res.status} ${srcUrl}`);
	}
	const buf = Buffer.from(await res.arrayBuffer());
	await fs.promises.writeFile(fullPath, buf);
	return publicUrlFor("uploads", filename);
}
