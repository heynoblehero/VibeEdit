// Runs in the PAGE's main world (manifest content_scripts world: "MAIN") so it
// can call captureStream() + MediaRecorder on YouTube's <video> element — the
// isolated content script can't reliably capture the media stream.
//
// It records the chosen in→out window in real time (the user's own tab, own
// session, residential IP → no bot-check, no cookies leave the browser) and
// hands the recorded bytes back to the isolated content script via postMessage.

(function () {
  const HARD_CAP_SEC = 300;

  function post(msg, transfer) {
    window.postMessage({ source: "vibeedit-rec-main", ...msg }, location.origin, transfer || []);
  }

  function pickMime() {
    const candidates = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];
    for (const type of candidates) {
      if (window.MediaRecorder && MediaRecorder.isTypeSupported(type)) return type;
    }
    return "video/webm";
  }

  async function record(inSec, outSec) {
    const video = document.querySelector("video");
    if (!video) return post({ type: "error", message: "No video found on this page." });
    if (!video.captureStream && !video.mozCaptureStream) {
      return post({ type: "error", message: "This browser can't record the video element." });
    }

    const start = Math.max(0, Number(inSec) || 0);
    const dur = Number.isFinite(video.duration) ? video.duration : start + 60;
    let end = outSec != null ? Number(outSec) : Math.min(dur, start + 30);
    if (!(end > start)) end = Math.min(dur, start + 30);
    if (end - start > HARD_CAP_SEC) end = start + HARD_CAP_SEC;

    let stream;
    try {
      stream = video.captureStream ? video.captureStream() : video.mozCaptureStream();
    } catch (error) {
      return post({ type: "error", message: `Couldn't capture: ${error.message}` });
    }
    if (!stream || stream.getVideoTracks().length === 0) {
      return post({ type: "error", message: "This video is protected and can't be recorded." });
    }

    const mime = pickMime();
    let recorder;
    try {
      recorder = new MediaRecorder(stream, { mimeType: mime });
    } catch (error) {
      return post({ type: "error", message: `Recorder error: ${error.message}` });
    }

    const chunks = [];
    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) chunks.push(event.data);
    };
    recorder.onstop = async () => {
      try {
        const blob = new Blob(chunks, { type: mime });
        const buffer = await blob.arrayBuffer();
        post({ type: "done", buffer, mime, bytes: blob.size }, [buffer]);
      } catch (error) {
        post({ type: "error", message: `Encoding failed: ${error.message}` });
      }
    };

    // Seek to the in-point, play, and record until the out-point.
    const beginRecording = () => {
      video.play().then(() => {
        recorder.start();
        const tick = () => {
          if (recorder.state !== "recording") return;
          const pct = Math.min(1, (video.currentTime - start) / (end - start));
          post({ type: "progress", pct });
          if (video.currentTime >= end || video.ended) {
            recorder.stop();
          } else {
            requestAnimationFrame(tick);
          }
        };
        requestAnimationFrame(tick);
      });
    };

    const onSeeked = () => {
      video.removeEventListener("seeked", onSeeked);
      beginRecording();
    };
    if (Math.abs(video.currentTime - start) < 0.3) {
      beginRecording();
    } else {
      video.addEventListener("seeked", onSeeked);
      video.currentTime = start;
    }
  }

  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    const data = event.data;
    if (!data || data.source !== "vibeedit-rec" || data.type !== "start") return;
    record(data.inSec, data.outSec);
  });
})();
