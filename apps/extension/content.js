// YouTube watch page — the VibeEdit capture experience.
//
// Adds a "＋ VibeEdit" button. Clicking opens a panel where the user marks an
// in/out window on the video's timeline, picks what to do (recreate/reuse/save),
// then captures. Capture runs server-side (background → /api/capture); the panel
// shows a processing state, then a preview of the captured clip with a link to
// open it in the VibeEdit editor.
//
// Note: YouTube's <video> is cross-origin/DRM, so we can't grab a client-side
// frame (canvas would be tainted). The preview thumbnail comes back from the
// server after the clip is downloaded.

(function () {
  const BUTTON_ID = "vibeedit-capture-button";
  const PANEL_ID = "vibeedit-panel";
  const state = { inMark: null, outMark: null, action: "recreate", open: false };
  const config = { apiBase: "", token: "", hasToken: false };

  function loadConfig() {
    chrome.runtime.sendMessage({ type: "getConfig" }, (cfg) => {
      if (chrome.runtime.lastError || !cfg) return;
      config.apiBase = cfg.apiBase || "";
      config.token = cfg.token || "";
      config.hasToken = Boolean(cfg.hasToken);
    });
  }

  const fmt = (seconds) => {
    if (seconds == null || !Number.isFinite(seconds)) return "—";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };
  const video = () => document.querySelector("video");
  const videoTitle = () =>
    (
      document.querySelector("h1.ytp-title-link, h1.title yt-formatted-string")?.textContent ||
      document.title.replace(/\s*-\s*YouTube\s*$/, "")
    ).trim();

  // --- Markers on YouTube's real progress bar (best-effort) ---------------
  function renderTimelineMarkers() {
    const bar = document.querySelector(".ytp-progress-bar");
    const dur = video()?.duration;
    if (!bar || !dur) return;
    for (const cls of ["vibeedit-mark-in", "vibeedit-mark-out"]) {
      const existing = bar.querySelector(`.${cls}`);
      if (existing) existing.remove();
    }
    const add = (seconds, cls) => {
      if (seconds == null) return;
      const el = document.createElement("div");
      el.className = `vibeedit-timeline-mark ${cls}`;
      el.style.left = `${Math.min(100, Math.max(0, (seconds / dur) * 100))}%`;
      bar.appendChild(el);
    };
    add(state.inMark, "vibeedit-mark-in");
    add(state.outMark, "vibeedit-mark-out");
  }

  // --- Panel --------------------------------------------------------------
  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function closePanel() {
    document.getElementById(PANEL_ID)?.remove();
    state.open = false;
  }

  function setStatus(node, text) {
    const status = node.querySelector(".vibeedit-status");
    if (status) status.textContent = text || "";
  }

  function openPanel() {
    if (document.getElementById(PANEL_ID)) return;
    state.open = true;

    const panel = el("div", "vibeedit-panel");
    panel.id = PANEL_ID;

    // Header
    const header = el("div", "vibeedit-panel-head");
    const title = el("div", "vibeedit-brand");
    title.innerHTML = 'vibe<span class="accent">edit</span> · capture';
    const close = el("button", "vibeedit-x", "✕");
    close.addEventListener("click", closePanel);
    header.append(title, close);

    // Body
    const body = el("div", "vibeedit-panel-body");
    body.append(el("div", "vibeedit-vidtitle", videoTitle()));

    // In/out controls + mini timeline
    const marks = el("div", "vibeedit-marks");
    const inBtn = el("button", "vibeedit-mini", "Set in");
    const outBtn = el("button", "vibeedit-mini", "Set out");
    const readout = el("div", "vibeedit-readout");
    const refreshReadout = () => {
      readout.textContent = `in ${fmt(state.inMark)}  →  out ${fmt(state.outMark)}`;
    };
    const miniBar = el("div", "vibeedit-mini-timeline");
    const miniIn = el("div", "vibeedit-mini-mark in");
    const miniOut = el("div", "vibeedit-mini-mark out");
    miniBar.append(miniIn, miniOut);
    const refreshMini = () => {
      const dur = video()?.duration || 0;
      miniIn.style.left = dur ? `${((state.inMark ?? 0) / dur) * 100}%` : "0%";
      miniOut.style.left = dur ? `${((state.outMark ?? dur) / dur) * 100}%` : "100%";
    };
    inBtn.addEventListener("click", () => {
      state.inMark = Math.floor(video()?.currentTime ?? 0);
      refreshReadout();
      refreshMini();
      renderTimelineMarkers();
    });
    outBtn.addEventListener("click", () => {
      state.outMark = Math.floor(video()?.currentTime ?? 0);
      refreshReadout();
      refreshMini();
      renderTimelineMarkers();
    });
    marks.append(inBtn, outBtn);
    body.append(marks, readout, miniBar);
    refreshReadout();
    refreshMini();

    // Action selector
    const actions = el("div", "vibeedit-actions");
    const opts = [
      ["recreate", "Recreate the style (original)"],
      ["reuse", "Reuse the footage"],
      ["save", "Just save the clip"],
    ];
    const attestWrap = el("label", "vibeedit-attest");
    const attest = document.createElement("input");
    attest.type = "checkbox";
    attestWrap.append(attest, document.createTextNode(" I own / licensed this footage"));
    const syncAttest = () => {
      attestWrap.style.display = state.action === "recreate" ? "none" : "flex";
    };
    for (const [value, label] of opts) {
      const row = el("label", "vibeedit-radio");
      const input = document.createElement("input");
      input.type = "radio";
      input.name = "vibeedit-action";
      input.checked = value === state.action;
      input.addEventListener("change", () => {
        state.action = value;
        syncAttest();
      });
      row.append(input, el("span", null, label));
      actions.append(row);
    }
    body.append(actions, attestWrap);
    syncAttest();

    // Status + primary button + result area
    body.append(el("div", "vibeedit-status"));
    const result = el("div", "vibeedit-result");
    body.append(
      el(
        "div",
        "vibeedit-hint",
        "Recording plays the clip in real time to capture it privately in your browser.",
      ),
    );
    const capture = el("button", "vibeedit-primary", "Record & capture");
    capture.addEventListener("click", () => runCapture(panel, capture, result, attest.checked));
    body.append(capture, result);

    panel.append(header, body);
    document.body.appendChild(panel);
    renderTimelineMarkers();
  }

  function statusWithSpinner(panel, text) {
    const status = panel.querySelector(".vibeedit-status");
    status.textContent = text;
    status.prepend(el("span", "vibeedit-spinner"));
  }

  // Records the in→out window client-side (recorder.js, main world) then uploads
  // the recorded file to the token-authed capture-upload endpoint. Nothing but
  // the final clip leaves the browser — no cookies, no server-side download.
  function runCapture(panel, button, result, attested) {
    if (!config.hasToken) {
      setStatus(panel, "Not connected — open the extension and click Get a token.");
      return;
    }
    if (state.inMark == null) {
      setStatus(panel, "Set an in-point first (Set in), then a Set out.");
      return;
    }
    button.disabled = true;
    result.innerHTML = "";
    statusWithSpinner(panel, "Recording… plays in real time");

    const onMessage = (event) => {
      if (event.source !== window) return;
      const data = event.data;
      if (!data || data.source !== "vibeedit-rec-main") return;
      if (data.type === "progress") {
        statusWithSpinner(panel, `Recording… ${Math.round((data.pct || 0) * 100)}%`);
      } else if (data.type === "error") {
        window.removeEventListener("message", onMessage);
        button.disabled = false;
        setStatus(panel, data.message || "Recording failed.");
      } else if (data.type === "done") {
        window.removeEventListener("message", onMessage);
        uploadRecording(panel, button, result, data, attested);
      }
    };
    window.addEventListener("message", onMessage);

    window.postMessage(
      { source: "vibeedit-rec", type: "start", inSec: state.inMark, outSec: state.outMark },
      location.origin,
    );
  }

  async function uploadRecording(panel, button, result, data, attested) {
    statusWithSpinner(panel, "Processing the clip…");
    try {
      const blob = new Blob([data.buffer], { type: data.mime || "video/webm" });
      const form = new FormData();
      form.append("file", blob, "capture.webm");
      form.append("action", state.action);
      form.append("attested", attested ? "true" : "false");
      form.append("sourceUrl", location.href);
      form.append("title", document.title.replace(/\s*-\s*YouTube\s*$/, "").trim());

      const response = await fetch(`${config.apiBase}/api/capture-upload`, {
        method: "POST",
        headers: { "x-vibe-token": config.token },
        body: form,
      });
      const json = await response.json().catch(() => ({}));
      button.disabled = false;
      if (!response.ok) {
        setStatus(panel, json.message || json.error || "Upload failed.");
        return;
      }
      setStatus(panel, "");
      if (json.editorPath) json.editorUrl = `${config.apiBase}${json.editorPath}`;
      renderResult(result, json);
    } catch (error) {
      button.disabled = false;
      setStatus(panel, `Upload failed: ${error.message}`);
    }
  }

  function renderResult(result, data) {
    result.innerHTML = "";
    if (data.previewDataUri) {
      const img = document.createElement("img");
      img.className = "vibeedit-preview";
      img.src = data.previewDataUri;
      result.append(img);
    }
    const where = data.target === "project" ? "your project" : "your library";
    result.append(el("div", "vibeedit-done", `✓ Captured to ${where}`));
    if (data.editorUrl) {
      const open = el("a", "vibeedit-open", "Open in VibeEdit editor →");
      open.href = data.editorUrl;
      open.target = "_blank";
      open.rel = "noopener";
      result.append(open);
    }
  }

  // --- Capture button -----------------------------------------------------
  function ensureButton() {
    if (document.getElementById(BUTTON_ID)) return;
    const button = el("button", "vibeedit-capture-button", "＋ VibeEdit");
    button.id = BUTTON_ID;
    button.title = "Capture this clip to VibeEdit";
    button.addEventListener("click", () => (state.open ? closePanel() : openPanel()));
    document.body.appendChild(button);
  }

  loadConfig();
  ensureButton();
  const observer = new MutationObserver(() => {
    ensureButton();
    if (state.open) renderTimelineMarkers();
  });
  observer.observe(document.body, { childList: true, subtree: true });
})();
