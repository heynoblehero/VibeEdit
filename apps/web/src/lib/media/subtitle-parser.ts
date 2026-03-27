export interface SubtitleCue {
  index: number;
  startTime: number; // seconds
  endTime: number;   // seconds
  text: string;
}

function parseSrtTimestamp(ts: string): number {
  // Format: HH:MM:SS,mmm or HH:MM:SS.mmm
  const parts = ts.trim().replace(",", ".").split(":");
  const h = parseFloat(parts[0]) || 0;
  const m = parseFloat(parts[1]) || 0;
  const s = parseFloat(parts[2]) || 0;
  return h * 3600 + m * 60 + s;
}

export function parseSRT(content: string): SubtitleCue[] {
  const cues: SubtitleCue[] = [];
  const blocks = content.trim().split(/\n\s*\n/);

  for (const block of blocks) {
    const lines = block.trim().split("\n");
    if (lines.length < 3) continue;

    const index = parseInt(lines[0], 10);
    if (isNaN(index)) continue;

    const timeParts = lines[1].split("-->");
    if (timeParts.length !== 2) continue;

    const startTime = parseSrtTimestamp(timeParts[0]);
    const endTime = parseSrtTimestamp(timeParts[1]);
    const text = lines.slice(2).join("\n").trim();

    if (text) cues.push({ index, startTime, endTime, text });
  }

  return cues;
}

export function parseVTT(content: string): SubtitleCue[] {
  const cues: SubtitleCue[] = [];
  // Remove WEBVTT header and metadata
  const body = content.replace(/^WEBVTT[^\n]*\n/, "").replace(/^Kind:.*\n/gm, "").replace(/^Language:.*\n/gm, "");
  const blocks = body.trim().split(/\n\s*\n/);
  let index = 1;

  for (const block of blocks) {
    const lines = block.trim().split("\n");
    // Find the timestamp line
    let tsLineIdx = 0;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes("-->")) { tsLineIdx = i; break; }
    }

    const timeLine = lines[tsLineIdx];
    if (!timeLine || !timeLine.includes("-->")) continue;

    // Strip position/alignment metadata from timestamp line
    const tsOnly = timeLine.split(/\s+/).filter(p => p.includes(":") || p === "-->").join(" ");
    const timeParts = tsOnly.split("-->");
    if (timeParts.length !== 2) continue;

    const startTime = parseSrtTimestamp(timeParts[0]);
    const endTime = parseSrtTimestamp(timeParts[1]);
    // Clean text: remove cue tags like <c>, <v>, etc.
    const text = lines.slice(tsLineIdx + 1).join("\n").replace(/<[^>]+>/g, "").trim();

    if (text && endTime > startTime) {
      cues.push({ index: index++, startTime, endTime, text });
    }
  }

  return cues;
}

export function parseSubtitleFile(content: string, filename: string): SubtitleCue[] {
  const ext = filename.toLowerCase();
  if (ext.endsWith(".vtt")) return parseVTT(content);
  return parseSRT(content); // Default to SRT
}
