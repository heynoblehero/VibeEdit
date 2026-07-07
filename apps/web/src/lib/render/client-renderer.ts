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

export interface ClientRenderError {
  phase: ClientRenderPhase;
  frame: number;
  totalFrames: number;
  message: string;
  /** True when we deliberately bailed (too long / memory pressure), not a bug. */
  recoverable: boolean;
}

export interface ClientRenderOptions {
  projectId: string;
  fps: number;
  quality: "draft" | "standard" | "high";
  onProgress: (p: ClientRenderProgress) => void;
  /**
   * Called when the in-browser render cannot complete and we fall back to the
   * server. Gives the caller the actual reason + location so it's no longer a
   * silent failure (or, worse, an invisible tab crash).
   */
  onError?: (e: ClientRenderError) => void;
}

// In-browser rendering holds the whole encoded MP4 in RAM (fastStart:
// "in-memory") plus all compressed chunks. Past a few minutes that itself gets
// heavy, and very long captures are slow + fragile, so anything longer is sent
// to the server queue instead. ~3 min at the target fps.
const MAX_CLIENT_SECONDS = 180;

/** Returns an MP4 Blob, or null if client-side rendering is not possible. */
export async function renderOnClient(opts: ClientRenderOptions): Promise<Blob | null> {
  if (!supportsWebCodecs()) return null;

  const { projectId, fps, quality, onProgress } = opts;

  // Reduce resolution on draft quality to speed things up.
  const scale = quality === "draft" ? 0.5 : 1;

  // Tracked across the whole pipeline so a failure can report WHERE it died.
  let phase: ClientRenderPhase = "initializing";
  let currentFrame = 0;
  let totalFrames = 0;

  const fail = (message: string, recoverable: boolean): null => {
    const tag = recoverable ? "falling back to server" : "FAILED";
    console.error(
      `[client-render] ${tag} — phase=${phase} frame=${currentFrame}/${totalFrames}: ${message}`,
    );
    opts.onError?.({ phase, frame: currentFrame, totalFrames, message, recoverable });
    return null;
  };

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
    totalFrames = Math.ceil(totalDuration * fps);

    // ── 2b. Length guard — long compositions render on the server ─────────
    if (totalDuration > MAX_CLIENT_SECONDS) {
      return fail(
        `composition is ${Math.round(totalDuration)}s (over the ${MAX_CLIENT_SECONDS}s in-browser limit)`,
        true,
      );
    }

    // ── 2c. Fidelity guard — features html2canvas can't capture ───────────
    // The device path rasterizes the DOM with html2canvas, which renders
    // <video> elements and WebGL canvases as blank. Compositions using motion
    // footage or 3D must go to the server (real Chrome screenshots) so those
    // layers actually appear in the MP4 instead of silently dropping out.
    const unsupported = unsupportedFeature(html);
    if (unsupported) {
      return fail(`composition uses ${unsupported}, which needs the server renderer`, true);
    }

    // ── 3. Create the offscreen render iframe ────────────────────────────
    const iframe = createRenderIframe(width, height);
    document.body.appendChild(iframe);

    try {
      // Load the composition into the iframe (srcdoc = same-origin, no
      // network request, no CSP issues with assets on the same host).
      await loadCompositionIntoIframe(iframe, html, 12_000);

      phase = "capturing";
      onProgress({ phase: "capturing", frame: 0, totalFrames, method: "webcodecs" });

      // Lazily import html2canvas so it doesn't bloat the initial bundle.
      const { default: html2canvas } = (await import(
        /* webpackChunkName: "html2canvas" */ "html2canvas"
      )) as { default: typeof import("html2canvas").default };

      // ── 4. Streaming capture + encode ─────────────────────────────────
      // Each frame is encoded the instant it's captured, then its pixels are
      // released. The previous implementation buffered every frame's raw RGBA
      // (≈ width*height*4 bytes each) in an array and encoded afterwards — at
      // 1080×1920 that's ~8 MB/frame, so a ~1-minute clip needed >10 GB and
      // the browser OOM-killed the tab (window "snaps" shut, nothing logged).
      // Holding one frame at a time plus the small compressed chunks keeps
      // peak memory flat regardless of length.
      let encoderError: Error | null = null;
      const videoChunks: EncodedVideoChunk[] = [];
      const encoder = new VideoEncoder({
        output: (chunk) => videoChunks.push(chunk),
        // Don't throw from the callback (it runs off the call stack and would
        // become an uncaught error); record it and surface it from the loop.
        error: (e) => {
          encoderError = new Error(`VideoEncoder error: ${e.message}`);
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

      for (let f = 0; f < totalFrames; f++) {
        currentFrame = f;
        if (encoderError) throw encoderError;

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
        const imageData = ctx.getImageData(0, 0, width, height);

        const frame = new VideoFrame(imageDataToUint8ClampedArray(imageData, width, height), {
          format: "RGBA",
          codedWidth: width,
          codedHeight: height,
          timestamp: f * frameDurationUs,
          duration: frameDurationUs,
        });
        encoder.encode(frame, { keyFrame: f % (fps * 2) === 0 });
        frame.close();

        // Backpressure: keep the encoder queue bounded so chunks drain instead
        // of piling up if the encoder falls behind html2canvas.
        while (encoder.encodeQueueSize > fps * 2) {
          await rafTick();
          if (encoderError) throw encoderError;
        }

        onProgress({ phase: "capturing", frame: f + 1, totalFrames, method: "webcodecs" });

        // Proactive OOM guard (Chromium only): bail to the server *before* the
        // tab is killed, turning a silent crash into a clean fallback.
        if (f % 30 === 0 && isHeapNearLimit()) {
          return fail(`memory pressure at frame ${f}/${totalFrames}`, true);
        }
      }

      // ── 5. Finalize the video stream ──────────────────────────────────
      phase = "encoding";
      onProgress({ phase: "encoding", frame: totalFrames, totalFrames, method: "webcodecs" });
      await encoder.flush();
      encoder.close();
      if (encoderError) throw encoderError;

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

      // ── 6. Encode audio with WebCodecs AudioEncoder ───────────────────
      const audioTracks = parseAudioTracks(html);
      let audioChunks: EncodedAudioChunk[] = [];
      const sampleRate = 44100;
      const numChannels = 2;

      if (audioTracks.length > 0) {
        phase = "audio";
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
      phase = "muxing";
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
    // Unexpected failure (not one of the deliberate bail-outs above). Report
    // exactly what broke and where so it stops being an invisible failure,
    // then fall back to the server queue.
    const message = err instanceof Error ? `${err.message}\n${err.stack ?? ""}` : String(err);
    return fail(message, false);
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Chromium exposes `performance.memory`. When the JS heap is within ~12% of the
 * hard limit we're about to be OOM-killed, so callers can stop and fall back
 * gracefully. Always returns false where the API is unavailable (Firefox,
 * Safari) — there we rely on the streaming encoder keeping memory flat.
 */
function isHeapNearLimit(): boolean {
  const mem = (
    performance as unknown as { memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number } }
  ).memory;
  if (!mem || !mem.jsHeapSizeLimit) return false;
  return mem.usedJSHeapSize / mem.jsHeapSizeLimit > 0.88;
}

/**
 * Returns a human-readable description of the first feature the device renderer
 * can't faithfully capture, or null if the composition is safe for html2canvas.
 *
 * html2canvas walks the DOM/CSS and cannot read:
 *  - <video> pixels (motion b-roll) — drawn blank / poster only
 *  - WebGL canvases (Three.js etc.) — the drawing buffer reads empty unless
 *    preserveDrawingBuffer is set, which compositions don't do
 * Both must render on the server (Puppeteer drives real Chrome).
 */
function unsupportedFeature(html: string): string | null {
  if (/<video[\s>]/i.test(html)) return "motion footage (<video>)";
  if (
    /WebGLRenderer|getContext\(\s*["'](?:webgl2?|experimental-webgl)["']|\bthree(?:\.min)?\.js|three\.module/i.test(
      html,
    )
  ) {
    return "3D / WebGL";
  }
  return null;
}

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
  // Offset into the source file to start decoding from (data-media-start).
  // Processed single-clip footage is pre-trimmed so this is 0, but a raw video
  // referenced with data-media-start needs it to line up.
  mediaStartSeconds: number;
}

function parseAudioTracks(html: string): AudioTrack[] {
  const tracks: AudioTrack[] = [];

  // Parse <audio class="clip" data-start="..." data-duration="..." data-volume="..." src="...">
  const audioRe = /<audio[^>]+class="[^"]*clip[^"]*"[^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = audioRe.exec(html)) !== null) {
    const tag = m[0];
    const src = tag.match(/\bsrc="([^"]+)"/)?.[1];
    if (!src) continue;
    const start = parseFloat(tag.match(/data-start="([^"]+)"/)?.[1] ?? "0");
    const dur = parseFloat(tag.match(/data-duration="([^"]+)"/)?.[1] ?? "9999");
    const vol = parseFloat(tag.match(/data-volume="([^"]+)"/)?.[1] ?? "1");
    const mediaStart = parseFloat(tag.match(/data-media-start="([^"]+)"/)?.[1] ?? "0");
    tracks.push({
      src,
      startSeconds: start,
      durationSeconds: dur,
      volume: vol,
      mediaStartSeconds: mediaStart,
    });
  }

  // Parse audible <video class="clip"> elements — the footage's ORIGINAL audio.
  // Mirror the render engine's contract (audioMixer.parseAudioElements): a video
  // contributes audio unless it is `muted` or explicitly `data-has-audio="false"`.
  // Without this, the preview pane plays every footage edit SILENT even though
  // the rendered output has sound — the "there's no audio" report.
  const videoRe = /<video[^>]+class="[^"]*clip[^"]*"[^>]*>/gi;
  while ((m = videoRe.exec(html)) !== null) {
    const tag = m[0];
    const src = tag.match(/\bsrc="([^"]+)"/)?.[1];
    if (!src) continue;
    const isMuted = /\smuted(?:\s|=|>|\/)/i.test(tag);
    const hasAudioAttr = tag.match(/data-has-audio="([^"]+)"/)?.[1];
    const audible = hasAudioAttr === "true" || (!isMuted && hasAudioAttr !== "false");
    if (!audible) continue;
    const start = parseFloat(tag.match(/data-start="([^"]+)"/)?.[1] ?? "0");
    const dur = parseFloat(tag.match(/data-duration="([^"]+)"/)?.[1] ?? "9999");
    const vol = parseFloat(tag.match(/data-volume="([^"]+)"/)?.[1] ?? "1");
    const mediaStart = parseFloat(tag.match(/data-media-start="([^"]+)"/)?.[1] ?? "0");
    tracks.push({
      src,
      startSeconds: start,
      durationSeconds: dur,
      volume: vol,
      mediaStartSeconds: mediaStart,
    });
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

      // Trim to data-duration, starting from the source's data-media-start
      // offset (0 for pre-trimmed processed clips).
      const startInBuffer = Math.max(0, Math.min(audioBuffer.duration, track.mediaStartSeconds));
      const durInBuffer = Math.min(audioBuffer.duration - startInBuffer, track.durationSeconds);
      source.start(track.startSeconds, startInBuffer, durInBuffer);
      anyLoaded = true;
    } catch (err) {
      console.warn("[client-render] audio track failed:", track.src, err);
    }
  }

  if (!anyLoaded) return null;
  return offlineCtx.startRendering();
}
