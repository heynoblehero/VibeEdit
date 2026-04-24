import { NextRequest, NextResponse } from "next/server";

const PEXELS_API_KEY = process.env.PEXELS_API_KEY || "";
const GIPHY_API_KEY = process.env.GIPHY_API_KEY || "";

type SourceType = "video" | "image" | "gif" | "meme";

function isSourceType(value: string): value is SourceType {
	return value === "video" || value === "image" || value === "gif" || value === "meme";
}

export async function GET(request: NextRequest) {
	const query = request.nextUrl.searchParams.get("q");
	const typeParam = request.nextUrl.searchParams.get("type") || "video";
	const perPage = request.nextUrl.searchParams.get("per_page") || "12";

	if (!query) {
		return NextResponse.json({ error: "Query parameter 'q' is required" }, { status: 400 });
	}

	if (!isSourceType(typeParam)) {
		return NextResponse.json({ error: `Invalid type '${typeParam}'` }, { status: 400 });
	}
	const type: SourceType = typeParam;

	if (type === "gif" || type === "meme") {
		return handleGiphy({ query, type, perPage });
	}
	return handlePexels({ query, type, perPage });
}

async function handlePexels({
	query,
	type,
	perPage,
}: {
	query: string;
	type: "video" | "image";
	perPage: string;
}) {
	if (!PEXELS_API_KEY) {
		return NextResponse.json(
			{ error: "Pexels API key not configured. Set PEXELS_API_KEY in environment." },
			{ status: 503 },
		);
	}

	try {
		const endpoint =
			type === "video"
				? `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=${perPage}`
				: `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${perPage}`;

		const response = await fetch(endpoint, {
			headers: { Authorization: PEXELS_API_KEY },
		});

		if (!response.ok) {
			return NextResponse.json({ error: `Pexels API error: ${response.status}` }, { status: response.status });
		}

		const data = await response.json();

		if (type === "video") {
			const results = (data.videos || []).map((video: any) => {
				const hdFile = video.video_files?.find((f: any) => f.quality === "hd") || video.video_files?.[0];
				return {
					id: `pexels-video-${video.id}`,
					url: hdFile?.link,
					thumbnail: video.image,
					duration: video.duration,
					width: hdFile?.width || video.width,
					height: hdFile?.height || video.height,
					source: "pexels",
					credit: video.user?.name,
					mediaKind: "video" as const,
				};
			});
			return NextResponse.json({ results, type });
		}

		const results = (data.photos || []).map((photo: any) => ({
			id: `pexels-image-${photo.id}`,
			url: photo.src?.large2x || photo.src?.large || photo.src?.original,
			thumbnail: photo.src?.medium,
			width: photo.width,
			height: photo.height,
			source: "pexels",
			credit: photo.photographer,
			mediaKind: "image" as const,
		}));
		return NextResponse.json({ results, type });
	} catch (error) {
		return NextResponse.json(
			{ error: error instanceof Error ? error.message : "Stock media search failed" },
			{ status: 500 },
		);
	}
}

async function handleGiphy({
	query,
	type,
	perPage,
}: {
	query: string;
	type: "gif" | "meme";
	perPage: string;
}) {
	if (!GIPHY_API_KEY) {
		return NextResponse.json(
			{ error: "Giphy API key not configured. Set GIPHY_API_KEY in environment." },
			{ status: 503 },
		);
	}

	try {
		const searchQuery = type === "meme" ? `${query} meme` : query;
		const endpoint = `https://api.giphy.com/v1/gifs/search?api_key=${encodeURIComponent(
			GIPHY_API_KEY,
		)}&q=${encodeURIComponent(searchQuery)}&limit=${encodeURIComponent(perPage)}&rating=pg-13&bundle=messaging_non_clips`;

		const response = await fetch(endpoint);
		if (!response.ok) {
			return NextResponse.json({ error: `Giphy API error: ${response.status}` }, { status: response.status });
		}

		const data = await response.json();
		const results = (data.data || []).map((gif: any) => {
			const original = gif.images?.original;
			const preview = gif.images?.fixed_width || gif.images?.fixed_height || original;
			const mp4 = gif.images?.original_mp4?.mp4 || gif.images?.looping?.mp4;
			return {
				id: `giphy-${type}-${gif.id}`,
				url: mp4 || original?.url || gif.url,
				thumbnail: preview?.url || original?.url,
				width: Number(original?.width) || 0,
				height: Number(original?.height) || 0,
				duration: gif.images?.original_mp4?.length
					? Number(gif.images.original_mp4.length) / 1000
					: undefined,
				source: "giphy",
				credit: gif.user?.display_name || gif.username || "Giphy",
				mediaKind: mp4 ? ("video" as const) : ("image" as const),
			};
		});
		return NextResponse.json({ results, type });
	} catch (error) {
		return NextResponse.json(
			{ error: error instanceof Error ? error.message : "Giphy search failed" },
			{ status: 500 },
		);
	}
}
