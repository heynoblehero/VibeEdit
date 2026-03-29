import type { ClipMoment, ClipperSettings } from "@/types/clipper";

/**
 * Format seconds into MM:SS timestamp string.
 */
function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

/**
 * Format transcript segments into a readable timestamped block for Claude.
 */
export function formatTranscriptForAnalysis(
  segments: Array<{ text: string; start: number; end: number }>,
): string {
  return segments
    .map(
      (seg) =>
        `[${formatTimestamp(seg.start)}-${formatTimestamp(seg.end)}] ${seg.text.trim()}`,
    )
    .join("\n");
}

/**
 * Calls the /api/clips/analyze endpoint with the transcript and settings,
 * then parses the response into a sorted, capped list of ClipMoments.
 */
export async function detectViralMoments({
  transcript,
  settings,
}: {
  transcript: Array<{ text: string; start: number; end: number }>;
  settings: ClipperSettings;
}): Promise<ClipMoment[]> {
  if (transcript.length === 0) {
    return [];
  }

  const formattedTranscript = formatTranscriptForAnalysis(transcript);

  const response = await fetch("/api/clips/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      transcript: formattedTranscript,
      settings: {
        minClipDuration: settings.minClipDuration,
        maxClipDuration: settings.maxClipDuration,
        maxClips: settings.maxClips,
      },
    }),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    const errorMessage =
      (errorBody as { error?: string }).error ||
      `Viral moment detection failed (${response.status})`;
    throw new Error(errorMessage);
  }

  const data = (await response.json()) as { moments: ClipMoment[] };

  if (!data.moments || !Array.isArray(data.moments)) {
    throw new Error("Invalid response from clip analysis API");
  }

  // Assign UUIDs to each moment if not already present
  const moments: ClipMoment[] = data.moments.map((moment) => ({
    ...moment,
    id: moment.id || crypto.randomUUID(),
  }));

  // Sort by score descending
  moments.sort((a, b) => b.score - a.score);

  // Cap at maxClips
  return moments.slice(0, settings.maxClips);
}
