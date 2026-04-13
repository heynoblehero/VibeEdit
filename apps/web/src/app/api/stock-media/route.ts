import { NextRequest, NextResponse } from "next/server";

const PEXELS_API_KEY = process.env.PEXELS_API_KEY || "";

export async function GET(request: NextRequest) {
	const query = request.nextUrl.searchParams.get("q");
	const type = request.nextUrl.searchParams.get("type") || "video";
	const perPage = request.nextUrl.searchParams.get("per_page") || "5";

	if (!query) {
		return NextResponse.json({ error: "Query parameter 'q' is required" }, { status: 400 });
	}

	if (!PEXELS_API_KEY) {
		return NextResponse.json({ error: "Pexels API key not configured. Set PEXELS_API_KEY in environment." }, { status: 503 });
	}

	try {
		const endpoint = type === "video"
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
					id: video.id,
					url: hdFile?.link,
					thumbnail: video.image,
					duration: video.duration,
					width: hdFile?.width || video.width,
					height: hdFile?.height || video.height,
					source: "pexels",
					photographer: video.user?.name,
				};
			});
			return NextResponse.json({ results, type: "video" });
		}

		const results = (data.photos || []).map((photo: any) => ({
			id: photo.id,
			url: photo.src?.large2x || photo.src?.large || photo.src?.original,
			thumbnail: photo.src?.medium,
			width: photo.width,
			height: photo.height,
			source: "pexels",
			photographer: photo.photographer,
		}));
		return NextResponse.json({ results, type: "image" });
	} catch (error) {
		return NextResponse.json(
			{ error: error instanceof Error ? error.message : "Stock media search failed" },
			{ status: 500 },
		);
	}
}
