import type { CaptionWord } from "./scene-schema";

// Minimal SRT parser — converts each cue to one "word" entry so the Captions
// component can chunk them. Not word-level granularity, but good enough for
// creators who already have professional captions.

function parseTimestampMs(ts: string): number {
  const m = ts.match(/(\d+):(\d+):(\d+)[,.](\d+)/);
  if (!m) return 0;
  const h = Number(m[1]);
  const min = Number(m[2]);
  const s = Number(m[3]);
  const ms = Number(m[4]);
  return h * 3600000 + min * 60000 + s * 1000 + ms;
}

export function parseSrt(text: string): CaptionWord[] {
  const cues: CaptionWord[] = [];
  const blocks = text
    .replace(/\r\n/g, "\n")
    .split(/\n\n+/)
    .map((b) => b.trim())
    .filter(Boolean);
  for (const block of blocks) {
    const lines = block.split("\n");
    // First line may be an index. Timestamp line has " --> ".
    const tsLineIdx = lines.findIndex((l) => l.includes("-->"));
    if (tsLineIdx < 0) continue;
    const ts = lines[tsLineIdx];
    const [startStr, endStr] = ts.split("-->").map((s) => s.trim());
    const startMs = parseTimestampMs(startStr);
    const endMs = parseTimestampMs(endStr);
    if (endMs <= startMs) continue;
    const textLines = lines.slice(tsLineIdx + 1).join(" ").trim();
    if (!textLines) continue;
    // Split the cue's text into word-ish tokens with interpolated times so the
    // renderer's chunker behaves naturally.
    const tokens = textLines.split(/\s+/).filter(Boolean);
    const dur = endMs - startMs;
    for (let i = 0; i < tokens.length; i++) {
      const wordStart = startMs + Math.round((i / tokens.length) * dur);
      const wordEnd = startMs + Math.round(((i + 1) / tokens.length) * dur);
      cues.push({ word: tokens[i], startMs: wordStart, endMs: wordEnd });
    }
  }
  return cues;
}
