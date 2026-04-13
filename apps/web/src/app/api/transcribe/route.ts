import { NextRequest, NextResponse } from "next/server";

/**
 * Transcription endpoint using OpenAI Whisper API.
 * Accepts audio file upload, returns timed word-level transcript.
 * Requires OPENAI_API_KEY env var.
 *
 * Falls back to placeholder captions if no API key is set.
 */

interface TranscriptSegment {
	start: number;
	end: number;
	text: string;
}

export async function POST(request: NextRequest) {
	try {
		const formData = await request.formData();
		const audioFile = formData.get("audio") as File | null;

		if (!audioFile) {
			return NextResponse.json(
				{ error: "Audio file is required" },
				{ status: 400 },
			);
		}

		const apiKey = process.env.OPENAI_API_KEY;

		if (!apiKey) {
			// Fallback: generate placeholder captions based on duration
			const duration = parseFloat(
				(formData.get("duration") as string) || "30",
			);
			const segments = generatePlaceholderSegments(duration);
			return NextResponse.json({
				segments,
				source: "placeholder",
				message:
					"No OpenAI API key configured. Using placeholder captions. Set OPENAI_API_KEY for real transcription.",
			});
		}

		// Call OpenAI Whisper API
		const whisperForm = new FormData();
		whisperForm.append("file", audioFile);
		whisperForm.append("model", "whisper-1");
		whisperForm.append("response_format", "verbose_json");
		whisperForm.append("timestamp_granularities[]", "segment");

		const response = await fetch(
			"https://api.openai.com/v1/audio/transcriptions",
			{
				method: "POST",
				headers: { Authorization: `Bearer ${apiKey}` },
				body: whisperForm,
			},
		);

		if (!response.ok) {
			const err = await response.json().catch(() => ({}));
			return NextResponse.json(
				{
					error:
						err.error?.message ||
						`Whisper API error: ${response.status}`,
				},
				{ status: response.status },
			);
		}

		const data = await response.json();
		const segments: TranscriptSegment[] = (data.segments || []).map(
			(seg: any) => ({
				start: seg.start,
				end: seg.end,
				text: seg.text.trim(),
			}),
		);

		return NextResponse.json({
			segments,
			source: "whisper",
			language: data.language,
			duration: data.duration,
		});
	} catch (error) {
		return NextResponse.json(
			{
				error:
					error instanceof Error
						? error.message
						: "Transcription failed",
			},
			{ status: 500 },
		);
	}
}

function generatePlaceholderSegments(duration: number): TranscriptSegment[] {
	const segments: TranscriptSegment[] = [];
	const segmentDuration = 3;
	for (let t = 0; t < duration; t += segmentDuration) {
		segments.push({
			start: t,
			end: Math.min(t + segmentDuration, duration),
			text: `[Caption at ${Math.floor(t)}s — replace with real text]`,
		});
	}
	return segments;
}
