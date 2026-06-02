/**
 * Client-side renderer for Hyperframes compositions.
 *
 * Pipeline:
 *   Load HTML → hidden iframe → seek frame-by-frame → html2canvas capture
 *   → WebCodecs VideoEncoder + AudioEncoder → mp4-muxer → MP4 Blob
 *
 * Falls back to null when WebCodecs is unavailable so the caller can
 * route to the server-side queue instead.
 */

export type ClientRenderMethod = "webcodecs" | "server";

export type ClientRenderPhase =
  | "initializing"
  | "capturing"
  | "encoding"
  | "audio"
  | "muxing"
  | "done";

export interface ClientRenderProgress {
  phase: ClientRenderPhase;
  frame: number;
  totalFrames: number;
  method: ClientRenderMethod;
}

export interface ClientRenderOptions {
  projectId: string;
  fps: number;
  quality: "draft" | "standard" | "high";
  onProgress: (p: ClientRenderProgress) => void;
}

/** Returns an MP4 Blob, or null if client-side rendering is not possible. */
export async function renderOnClient(opts: ClientRenderOptions): Promise<Blob | null> {
  if (!supportsWebCodecs()) return null;

  const { projectId, fps, quality, onProgress } = opts;

  // Reduce resolution on draft quality to speed things up.
  const scale = quality === "draft" ? 0.5 : 1;

  try {
    // ── 1. Fetch the composition HTML ────────────────────────────────────
    const htmlRes = await fetch(`/api/projects/${projectId}/files/index.html`);
    if (!htmlRes.ok) throw new Error("Could not fetch composition HTML");
    const html = await htmlRes.text();

    // ── 2. Parse composition metadata ────────────────────────────────────
    const meta = parseCompositionMeta(html);
    if (!meta) throw new Error("Could not parse composition dimensions/duration");

    const { totalDuration, width: srcW, height: srcH } = meta;
    const width = Math.round(srcW * scale);
    const height = Math.round(srcH * scale);
    const totalFrames = Math.ceil(totalDuration * fps);

    // ── 3. Create the offscreen render iframe ────────────────────────────
    const iframe = createRenderIframe(width, height);
    document.body.appendChild(iframe);

    try {
      // Load the composition into the iframe (srcdoc = same-origin, no
      // network request, no CSP issues with assets on the same host).
      await loadCompositionIntoIframe(iframe, html, 12_000);

      onProgress({ phase: "capturing", frame: 0, totalFrames, method: "webcodecs" });

      // ── 4. Capture frames ─────────────────────────────────────────────
      // Lazily import html2canvas so it doesn't bloat the initial bundle.
      const { default: html2canvas } = (await import(
        /* webpackChunkName: "html2canvas" */ "html2canvas"
      )) as { default: typeof import("html2canvas").default };

      const frameDataList: ImageData[] = [];

      for (let f = 0; f < totalFrames; f++) {
        const t = f / fps;
        seekComposition(iframe, t);
        // Two rAF ticks: first lets GSAP update, second lets the browser paint.
        await rafTick();
        await rafTick();

        const root = iframe.contentDocument?.getElementById("root");
        if (!root) throw new Error("Composition root element not found");

        const captured = await html2canvas(root as HTMLElement, {
          useCORS: true,
          allowTaint: false,
          logging: false,
          scale: 1,
          width,
          height,
          // Inline fonts so html2canvas can render them.
          onclone: (clonedDoc) => {
            // Copy computed styles for custom properties (--color-*, etc.)
            const clonedRoot = clonedDoc.getElementById("root");
            if (clonedRoot && root) {
              const src = getComputedStyle(root);
              for (const prop of src) {
                if (prop.startsWith("--")) {
                  (clonedRoot.style as unknown as Record<string, string>)[prop] =
                    src.getPropertyValue(prop);
                }
              }
            }
          },
        });

        const ctx = captured.getContext("2d");
        if (!ctx) throw new Error("Canvas 2D context unavailable");
        frameDataList.push(ctx.getImageData(0, 0, width, height));

        onProgress({ phase: "capturing", frame: f + 1, totalFrames, method: "webcodecs" });
      }

      // ── 5. Encode video frames with WebCodecs VideoEncoder ────────────
      onProgress({ phase: "encoding", frame: 0, totalFrames, method: "webcodecs" });
      const { Muxer, ArrayBufferTarget } = await import(
        /* webpackChunkName: "mp4-muxer" */ "mp4-muxer"
      );

      const target = new ArrayBufferTarget();
      const muxer = new Muxer({
        target,
        video: {
          codec: "avc",
          width,
          height,
        },
        audio: undefined as unknown as never, // filled in below if audio tracks exist
        fastStart: "in-memory",
      });

      const videoChunks: EncodedVideoChunk[] = [];
      const encoder = new VideoEncoder({
        output: (chunk) => videoChunks.push(chunk),
        error: (e) => {
          throw new Error(`VideoEncoder error: ${e.message}`);
        },
      });

      encoder.configure({
        codec: "avc1.42001f", // H.264 Baseline
        width,
        height,
        bitrate: quality === "draft" ? 1_500_000 : quality === "standard" ? 5_000_000 : 12_000_000,
        framerate: fps,
      });

      const frameDurationUs = Math.round(1_000_000 / fps);

      for (let f = 0; f < frameDataList.length; f++) {
        const imageData = frameDataList[f];
        const timestampUs = f * frameDurationUs;

        // VideoFrame from ImageData
        const frame = new VideoFrame(imageDataToUint8ClampedArray(imageData, width, height), {
          format: "RGBA",
          codedWidth: width,
          codedHeight: height,
          timestamp: timestampUs,
          duration: frameDurationUs,
        });

        encoder.encode(frame, { keyFrame: f % (fps * 2) === 0 });
        frame.close();

        if (f % 10 === 0) {
          onProgress({ phase: "encoding", frame: f + 1, totalFrames, method: "webcodecs" });
        }
      }

      await encoder.flush();
      encoder.close();

      // ── 6. Encode audio with WebCodecs AudioEncoder ───────────────────
      const audioTracks = parseAudioTracks(html);
      let audioChunks: EncodedAudioChunk[] = [];
      const sampleRate = 44100;
      const numChannels = 2;

      if (audioTracks.length > 0) {
        onProgress({ phase: "audio", frame: 0, totalFrames, method: "webcodecs" });
        const mixedBuffer = await mixAudioTracks(audioTracks, projectId, totalDuration);

        if (mixedBuffer) {
          // Create a Muxer that handles both video and audio.
          // We rebuild it here since mp4-muxer needs audio config up-front.
          muxer.finalize(); // abandon the video-only draft

          const targetWithAudio = new ArrayBufferTarget();
          const muxerWithAudio = new Muxer({
            target: targetWithAudio,
            video: { codec: "avc", width, height },
            audio: { codec: "aac", sampleRate, numberOfChannels: numChannels },
            fastStart: "in-memory",
          });

          const audioEncoder = new AudioEncoder({
            output: (chunk) => audioChunks.push(chunk),
            error: (e) => console.warn("[client-render] AudioEncoder:", e),
          });
          audioEncoder.configure({
            codec: "mp4a.40.2",
            sampleRate,
            numberOfChannels: numChannels,
            bitrate: 128_000,
          });

          // Feed mixed audio in 4096-sample chunks
          const channelData = [
            mixedBuffer.getChannelData(0),
            numChannels > 1 ? mixedBuffer.getChannelData(1) : mixedBuffer.getChannelData(0),
          ];
          const chunkSize = 4096;
          const numSamples = mixedBuffer.length;

          for (let i = 0; i < numSamples; i += chunkSize) {
            const len = Math.min(chunkSize, numSamples - i);
            const interleaved = new Float32Array(len * numChannels);
            for (let s = 0; s < len; s++) {
              interleaved[s * numChannels] = channelData[0][i + s] ?? 0;
              interleaved[s * numChannels + 1] = channelData[1][i + s] ?? 0;
            }
            const audioData = new AudioData({
              format: "f32-planar",
              sampleRate,
              numberOfFrames: len,
              numberOfChannels: numChannels,
              timestamp: Math.round((i / sampleRate) * 1_000_000),
              data: interleaved,
            });
            audioEncoder.encode(audioData);
            audioData.close();
          }

          await audioEncoder.flush();
          audioEncoder.close();

          // Add all video chunks to the audio-aware muxer
          for (const chunk of videoChunks) {
            muxerWithAudio.addVideoChunk(chunk, { decoderConfig: undefined as never });
          }
          for (const chunk of audioChunks) {
            muxerWithAudio.addAudioChunk(chunk, { decoderConfig: undefined as never });
          }
          muxerWithAudio.finalize();
          return new Blob([targetWithAudio.buffer], { type: "video/mp4" });
        }
      }

      // Video-only mux (no audio tracks or audio encoding failed)
      onProgress({ phase: "muxing", frame: totalFrames, totalFrames, method: "webcodecs" });
      for (const chunk of videoChunks) {
        muxer.addVideoChunk(chunk, { decoderConfig: undefined as never });
      }
      muxer.finalize();

      onProgress({ phase: "done", frame: totalFrames, totalFrames, method: "webcodecs" });
      return new Blob([target.buffer], { type: "video/mp4" });
    } finally {
      document.body.removeChild(iframe);
    }
  } catch (err) {
    console.warn("[client-render] failed, falling back to server:", err);
    return null;
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────────

export function supportsWebCodecs(): boolean {
  return (
    typeof VideoEncoder !== "undefined" &&
    typeof VideoFrame !== "undefined" &&
    typeof AudioEncoder !== "undefined" &&
    typeof AudioData !== "undefined"
  );
}

function parseCompositionMeta(
  html: string,
): { totalDuration: number; width: number; height: number } | null {
  const dur = html.match(/data-duration="([^"]+)"/)?.[1];
  const w = html.match(/data-width="([^"]+)"/)?.[1];
  const h = html.match(/data-height="([^"]+)"/)?.[1];
  if (!dur || !w || !h) return null;
  return {
    totalDuration: parseFloat(dur),
    width: parseInt(w),
    height: parseInt(h),
  };
}

function createRenderIframe(width: number, height: number): HTMLIFrameElement {
  const iframe = document.createElement("iframe");
  // Position off-screen but not display:none — elements in display:none won't
  // render CSS, so html2canvas produces blank output.
  iframe.style.cssText = `
    position: fixed;
    left: ${-(width + 200)}px;
    top: 0;
    width: ${width}px;
    height: ${height}px;
    border: none;
    pointer-events: none;
    overflow: hidden;
  `;
  iframe.setAttribute("sandbox", "allow-scripts allow-same-origin");
  return iframe;
}

function loadCompositionIntoIframe(
  iframe: HTMLIFrameElement,
  html: string,
  timeoutMs: number,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const deadline = setTimeout(() => {
      reject(new Error("Composition init timeout"));
    }, timeoutMs);

    iframe.addEventListener(
      "load",
      async () => {
        // Poll for timelines/hf to register (GSAP scripts run after DOMContentLoaded).
        const start = Date.now();
        while (Date.now() - start < timeoutMs) {
          const win = iframe.contentWindow as Record<string, unknown> | null;
          if (win?.["__hf"] || win?.["__timelines"]) {
            clearTimeout(deadline);
            // Extra tick so all timeline registrations finish.
            await rafTick();
            resolve();
            return;
          }
          await new Promise((r) => setTimeout(r, 50));
        }
        clearTimeout(deadline);
        reject(new Error("No __hf or __timelines found in composition"));
      },
      { once: true },
    );

    // srcdoc keeps the document same-origin so we can access contentWindow.
    iframe.srcdoc = html;
  });
}

function seekComposition(iframe: HTMLIFrameElement, timeSeconds: number): void {
  const win = iframe.contentWindow as Record<string, unknown> | null;
  if (!win) return;

  // Try the unified __hf.seek() API first (used by the Hyperframes runtime).
  const hf = win["__hf"] as Record<string, unknown> | null;
  if (hf && typeof hf["seek"] === "function") {
    (hf["seek"] as (t: number) => void)(timeSeconds);
    return;
  }

  // Fall back to the direct __timelines map (compositions register each
  // named GSAP timeline here for the player to control).
  const timelines = win["__timelines"] as Record<string, unknown> | null;
  if (!timelines) return;
  for (const tl of Object.values(timelines)) {
    const t = tl as Record<string, unknown>;
    if (typeof t["seek"] === "function") {
      (t["seek"] as (time: number) => void)(timeSeconds);
    }
  }
}

function rafTick(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

function imageDataToUint8ClampedArray(
  imageData: ImageData,
  width: number,
  height: number,
): Uint8ClampedArray {
  // VideoFrame expects a flat RGBA buffer matching the declared dimensions.
  if (imageData.width === width && imageData.height === height) {
    return imageData.data;
  }
  // Crop/pad if html2canvas returned different dimensions.
  const result = new Uint8ClampedArray(width * height * 4);
  const srcRowBytes = imageData.width * 4;
  const dstRowBytes = width * 4;
  const rowsToCopy = Math.min(imageData.height, height);
  const colsToCopy = Math.min(srcRowBytes, dstRowBytes);
  for (let row = 0; row < rowsToCopy; row++) {
    result.set(
      imageData.data.subarray(row * srcRowBytes, row * srcRowBytes + colsToCopy),
      row * dstRowBytes,
    );
  }
  return result;
}

// ── Audio helpers ──────────────────────────────────────────────────────────────

interface AudioTrack {
  src: string;
  startSeconds: number;
  durationSeconds: number;
  volume: number;
}

function parseAudioTracks(html: string): AudioTrack[] {
  // Parse <audio class="clip" data-start="..." data-duration="..." data-volume="..." src="...">
  const trackRe = /<audio[^>]+class="[^"]*clip[^"]*"[^>]*>/gi;
  const tracks: AudioTrack[] = [];
  let m: RegExpExecArray | null;
  while ((m = trackRe.exec(html)) !== null) {
    const tag = m[0];
    const src = tag.match(/\bsrc="([^"]+)"/)?.[1];
    if (!src) continue;
    const start = parseFloat(tag.match(/data-start="([^"]+)"/)?.[1] ?? "0");
    const dur = parseFloat(tag.match(/data-duration="([^"]+)"/)?.[1] ?? "9999");
    const vol = parseFloat(tag.match(/data-volume="([^"]+)"/)?.[1] ?? "1");
    tracks.push({ src, startSeconds: start, durationSeconds: dur, volume: vol });
  }
  return tracks;
}

async function mixAudioTracks(
  tracks: AudioTrack[],
  projectId: string,
  totalDuration: number,
): Promise<AudioBuffer | null> {
  if (typeof OfflineAudioContext === "undefined") return null;

  const sampleRate = 44100;
  const offlineCtx = new OfflineAudioContext(2, Math.ceil(totalDuration * sampleRate), sampleRate);

  let anyLoaded = false;
  for (const track of tracks) {
    try {
      // Resolve src: assets/ paths are served from the project files API.
      const url = track.src.startsWith("assets/")
        ? `/api/projects/${projectId}/files/${track.src}`
        : track.src.startsWith("/stock/")
          ? track.src
          : track.src;

      const resp = await fetch(url);
      if (!resp.ok) continue;
      const arrayBuffer = await resp.arrayBuffer();
      const audioBuffer = await offlineCtx.decodeAudioData(arrayBuffer);

      const source = offlineCtx.createBufferSource();
      source.buffer = audioBuffer;

      const gainNode = offlineCtx.createGain();
      gainNode.gain.value = Number.isFinite(track.volume) ? track.volume : 1;

      source.connect(gainNode);
      gainNode.connect(offlineCtx.destination);

      // Trim to data-duration if specified
      const startInBuffer = 0;
      const durInBuffer = Math.min(audioBuffer.duration, track.durationSeconds);
      source.start(track.startSeconds, startInBuffer, durInBuffer);
      anyLoaded = true;
    } catch (err) {
      console.warn("[client-render] audio track failed:", track.src, err);
    }
  }

  if (!anyLoaded) return null;
  return offlineCtx.startRendering();
}
