// Browser-side silence detection via Web Audio API. Returns an array of
// silence ranges in seconds. Threshold in dBFS; anything quieter for at least
// `minSilenceSec` gets flagged. Works on any media URL the browser can load
// (including data: and same-origin /uploads/).

export interface SilenceRange {
  startSec: number;
  endSec: number;
}

export async function detectSilence(
  url: string,
  opts: { thresholdDb?: number; minSilenceSec?: number } = {},
): Promise<{ durationSec: number; ranges: SilenceRange[] }> {
  const thresholdDb = opts.thresholdDb ?? -40;
  const minSilence = opts.minSilenceSec ?? 0.4;

  const res = await fetch(url);
  const buffer = await res.arrayBuffer();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const AudioCtx: typeof AudioContext = (window.AudioContext || (window as any).webkitAudioContext);
  const ctx = new AudioCtx();
  const audio = await ctx.decodeAudioData(buffer.slice(0));
  const sampleRate = audio.sampleRate;
  const channel = audio.getChannelData(0);
  const windowMs = 20;
  const windowSamples = Math.max(1, Math.round((sampleRate * windowMs) / 1000));
  const thresholdLinear = Math.pow(10, thresholdDb / 20);

  const ranges: SilenceRange[] = [];
  let silentStart: number | null = null;
  for (let i = 0; i < channel.length; i += windowSamples) {
    let sum = 0;
    const end = Math.min(channel.length, i + windowSamples);
    for (let k = i; k < end; k++) sum += channel[k] * channel[k];
    const rms = Math.sqrt(sum / (end - i));
    const isSilent = rms < thresholdLinear;
    if (isSilent && silentStart === null) {
      silentStart = i / sampleRate;
    } else if (!isSilent && silentStart !== null) {
      const s = silentStart;
      const e = i / sampleRate;
      if (e - s >= minSilence) ranges.push({ startSec: s, endSec: e });
      silentStart = null;
    }
  }
  if (silentStart !== null) {
    const e = channel.length / sampleRate;
    if (e - silentStart >= minSilence) {
      ranges.push({ startSec: silentStart, endSec: e });
    }
  }
  // Cleanup.
  try {
    await ctx.close();
  } catch {
    // not all browsers support close()
  }
  return { durationSec: audio.duration, ranges };
}

export function trimAroundSilence(
  durationSec: number,
  ranges: SilenceRange[],
): { trimStart: number; trimEnd: number } {
  // Trim leading and trailing silence only. Internal silences get left in — we
  // don't want to splice the video here, just tighten the head/tail.
  let trimStart = 0;
  let trimEnd = durationSec;
  if (ranges.length > 0) {
    const first = ranges[0];
    if (first.startSec < 0.25) trimStart = first.endSec;
    const last = ranges[ranges.length - 1];
    if (durationSec - last.endSec < 0.25) trimEnd = last.startSec;
  }
  if (trimEnd <= trimStart + 0.5) return { trimStart: 0, trimEnd: durationSec };
  return { trimStart, trimEnd };
}
