"use client";

/**
 * Min/max envelope waveform rendered to a canvas inside a parent
 * container. Decodes audio once per src via Web Audio API
 * (decodeAudioData) — the decoded buffer is cached in a module-level
 * Map keyed by URL so re-rendering a project's timeline doesn't
 * re-decode dozens of tiny voiceover files.
 *
 * Reuses the AudioContext pattern from src/lib/silence-detect.ts.
 *
 * Falls back to a thin static line when decoding fails (CORS, missing
 * file, unsupported format).
 */

import { useEffect, useRef, useState } from "react";

interface Props {
  src: string;
  /** Display width hint; the canvas auto-fills its parent's width. */
  height?: number;
  /** Hex / rgba color for the envelope fill. */
  color?: string;
}

interface CachedSamples {
  /** Per-bucket [min, max] in -1..1 space. Pre-bucketed at a coarse
   *  resolution (1024 buckets) so re-rendering at any width is cheap
   *  — we just sample-down at draw time. */
  buckets: Float32Array;
}

const cache: Map<string, CachedSamples | "pending" | "failed"> = new Map();
const subscribers: Map<string, Set<() => void>> = new Map();
const TARGET_BUCKETS = 1024;

/**
 * Peak amplitude (0..1) at a fractional position (0..1) along the
 * cached source. Used by the LevelMeter to derive a cheap level
 * reading without re-tapping the audio graph at runtime.
 */
export function peakAt(src: string, frac: number): number {
  const cached = cache.get(src);
  if (!cached || cached === "pending" || cached === "failed") return 0;
  const buckets = cached.buckets;
  const total = buckets.length / 2;
  const i = Math.max(0, Math.min(total - 1, Math.floor(frac * total)));
  const min = buckets[i * 2];
  const max = buckets[i * 2 + 1];
  return Math.min(1, Math.max(Math.abs(min), Math.abs(max)));
}

async function decode(src: string): Promise<CachedSamples | null> {
  const existing = cache.get(src);
  if (existing && existing !== "pending" && existing !== "failed") {
    return existing;
  }
  if (existing === "pending") return null;
  if (existing === "failed") return null;

  cache.set(src, "pending");
  try {
    const res = await fetch(src);
    if (!res.ok) throw new Error(`fetch ${res.status}`);
    const buffer = await res.arrayBuffer();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const AudioCtx = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
    const ctx = new AudioCtx();
    const audio = await ctx.decodeAudioData(buffer.slice(0));
    const channel = audio.getChannelData(0);
    const samples = channel.length;
    const bucketSize = Math.max(1, Math.floor(samples / TARGET_BUCKETS));
    const out = new Float32Array(TARGET_BUCKETS * 2);
    for (let i = 0; i < TARGET_BUCKETS; i++) {
      let min = Infinity;
      let max = -Infinity;
      const start = i * bucketSize;
      const end = Math.min(samples, start + bucketSize);
      for (let j = start; j < end; j++) {
        const v = channel[j];
        if (v < min) min = v;
        if (v > max) max = v;
      }
      if (!isFinite(min)) min = 0;
      if (!isFinite(max)) max = 0;
      out[i * 2] = min;
      out[i * 2 + 1] = max;
    }
    ctx.close().catch(() => {});
    const samplesObj: CachedSamples = { buckets: out };
    cache.set(src, samplesObj);
    subscribers.get(src)?.forEach((fn) => fn());
    subscribers.delete(src);
    return samplesObj;
  } catch {
    cache.set(src, "failed");
    subscribers.get(src)?.forEach((fn) => fn());
    subscribers.delete(src);
    return null;
  }
}

export function AudioWaveform({ src, height = 24, color = "rgba(56, 189, 248, 0.7)" }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [version, setVersion] = useState(0);

  // Trigger decode + subscribe to cache updates so this instance
  // re-renders when the buffer arrives.
  useEffect(() => {
    let alive = true;
    const cached = cache.get(src);
    if (cached && cached !== "pending" && cached !== "failed") {
      setVersion((v) => v + 1);
      return;
    }
    const sub = () => {
      if (alive) setVersion((v) => v + 1);
    };
    if (!subscribers.has(src)) subscribers.set(src, new Set());
    subscribers.get(src)!.add(sub);
    decode(src);
    return () => {
      alive = false;
      subscribers.get(src)?.delete(sub);
    };
  }, [src]);

  // Re-paint the canvas when the buffer arrives or the parent resizes.
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const cached = cache.get(src);
    const samples = cached && cached !== "pending" && cached !== "failed" ? cached : null;
    const dpr = window.devicePixelRatio || 1;
    const width = container.clientWidth;
    canvas.width = Math.max(1, width * dpr);
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!samples) {
      // Decoding / failed — render a thin baseline.
      ctx.strokeStyle = color;
      ctx.lineWidth = 1 * dpr;
      ctx.beginPath();
      ctx.moveTo(0, canvas.height / 2);
      ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.stroke();
      return;
    }
    const buckets = samples.buckets;
    const total = buckets.length / 2;
    const bw = canvas.width / total;
    const mid = canvas.height / 2;
    ctx.fillStyle = color;
    for (let i = 0; i < total; i++) {
      const min = buckets[i * 2];
      const max = buckets[i * 2 + 1];
      const yMax = mid - max * mid;
      const yMin = mid - min * mid;
      const h = Math.max(1, yMin - yMax);
      ctx.fillRect(i * bw, yMax, Math.max(1, bw * 0.85), h);
    }
  }, [src, version, height, color]);

  // Re-render on resize (parent may grow / shrink with timeline width).
  useEffect(() => {
    const c = containerRef.current;
    if (!c || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setVersion((v) => v + 1));
    ro.observe(c);
    return () => ro.disconnect();
  }, []);

  const cached = cache.get(src);
  const pending = cached === "pending" || cached === undefined;

  return (
    <div ref={containerRef} className="absolute inset-0 pointer-events-none">
      <canvas
        ref={canvasRef}
        className={pending ? "block animate-pulse opacity-60" : "block"}
      />
    </div>
  );
}
