// Caption overlay generator: turns caption cues (+ optional per-word timings)
// into a self-contained composition layer — DOM + scoped CSS + a single GSAP
// timeline registered as window.__timelines["captions"].
//
// Contract with the Hyperframes runtime (see system-prompt + snapshot/capture):
//   - The layer registers exactly ONE timeline ("captions"), and it animates
//     ONLY its own caption spans — disjoint from the video and other scenes — so
//     it never collides with the "main"/per-scene timelines (the #1 timeline bug
//     is a second master animating the SAME elements; this isn't that).
//   - Everything is positioned in GLOBAL composition time (seconds from t=0), so
//     the player/renderer seek it in lockstep with the footage.
//   - Output is deterministic (no Date/Math.random) so renders are reproducible.

import {
  CAPTION_PRESETS,
  type CaptionOverlayPreset,
  type CaptionPresetId,
  DEFAULT_CAPTION_PRESET,
} from "./presets.js";

export interface OverlayWord {
  text: string;
  start: number;
  end: number;
}

export interface OverlayCue {
  text: string;
  start: number;
  end: number;
  /** Optional per-word timings; when absent, words are spread evenly over the cue. */
  words?: OverlayWord[];
}

export interface BuildCaptionLayerOptions {
  cues: OverlayCue[];
  /** Composition canvas size — presets scale font/margins off the height. */
  width: number;
  height: number;
  /** Total composition duration (s) — the timeline is padded to this so the
   *  player doesn't stop early. */
  totalDuration: number;
  presetId?: CaptionPresetId;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function round(value: number, dp = 3): number {
  const factor = 10 ** dp;
  return Math.round(value * factor) / factor;
}

// Split a cue into words with timings: use provided per-word data, else spread
// the cue's words evenly across [start, end].
function wordsForCue(cue: OverlayCue): OverlayWord[] {
  if (cue.words && cue.words.length > 0) return cue.words;
  const tokens = cue.text.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return [];
  const span = Math.max(0.0001, cue.end - cue.start);
  const per = span / tokens.length;
  return tokens.map((text, index) => ({
    text,
    start: round(cue.start + index * per),
    end: round(cue.start + (index + 1) * per),
  }));
}

// Build the scoped CSS for a preset at a given canvas size. All selectors are
// namespaced under .vibe-captions so the layer can't leak styles into the
// composition (or vice-versa).
function buildCaptionCss(preset: CaptionOverlayPreset, width: number, height: number): string {
  const fontSize = Math.max(12, Math.round(preset.fontScale * height));
  const marginV = Math.round(preset.marginVScale * height);
  const maxWidth = Math.round(preset.maxWidthScale * width);
  const strokePx = preset.strokeScale > 0 ? round(fontSize * preset.strokeScale, 2) : 0;

  const anchor =
    preset.position === "center"
      ? "top:50%; transform:translate(-50%,-50%);"
      : `bottom:${marginV}px; transform:translateX(-50%);`;

  // Gradient fill clips the text and forces a transparent color, which would
  // hide -webkit-text-stroke — so gradient presets rely on their drop shadow for
  // legibility and skip the stroke.
  const fill = preset.gradient
    ? `background-image:${preset.gradient}; -webkit-background-clip:text; background-clip:text; color:transparent;`
    : `color:${preset.fillColor};`;
  const stroke =
    strokePx > 0 && !preset.gradient
      ? `-webkit-text-stroke:${strokePx}px ${preset.strokeColor}; paint-order:stroke fill;`
      : "";
  const shadow = preset.textShadow ? `text-shadow:${preset.textShadow};` : "";
  const pill = preset.pill
    ? `background:${preset.pill.color}; padding:${preset.pill.padYEm}em ${preset.pill.padXEm}em; border-radius:${preset.pill.radiusEm}em;`
    : "";

  return [
    ".vibe-captions{position:absolute;inset:0;pointer-events:none;z-index:60;}",
    `.vibe-captions .vibe-cue{position:absolute;left:50%;${anchor}` +
      `width:max-content;max-width:${maxWidth}px;text-align:center;opacity:0;` +
      `font-family:${preset.fontFamily};font-size:${fontSize}px;font-weight:${preset.fontWeight};` +
      `line-height:1.15;letter-spacing:${preset.letterSpacingEm}em;` +
      `${preset.uppercase ? "text-transform:uppercase;" : ""}${shadow}${pill}}`,
    `.vibe-captions .vibe-word{display:inline-block;${fill}${stroke}will-change:transform,opacity;}`,
  ].join("");
}

// Build the GSAP timeline script. Reads timing from data-* attributes on the
// rendered DOM so the markup is the single source of truth.
function buildTimelineScript(preset: CaptionOverlayPreset, totalDuration: number): string {
  const pop = preset.pop;
  const activeColor = preset.activeColor && !preset.gradient ? preset.activeColor : "";
  const baseColor = preset.gradient ? "" : preset.fillColor;

  // NOTE: kept as a plain string (not a template with backticks inside) so it
  // survives insertion into index.html unchanged.
  return [
    "(function(){",
    'if(typeof gsap==="undefined")return;',
    "window.__timelines=window.__timelines||{};",
    'var layer=document.querySelector(".vibe-captions");',
    "if(!layer)return;",
    "var tl=gsap.timeline({paused:true});",
    'var cues=layer.querySelectorAll(".vibe-cue");',
    "cues.forEach(function(cue){",
    "var start=parseFloat(cue.dataset.start)||0;",
    "var end=parseFloat(cue.dataset.end)||0;",
    "tl.fromTo(cue,{opacity:0},{opacity:1,duration:0.12},start);",
    "tl.to(cue,{opacity:0,duration:0.12},Math.max(start,end-0.12));",
    pop
      ? [
          'var words=cue.querySelectorAll(".vibe-word");',
          "words.forEach(function(w){",
          "var ws=parseFloat(w.dataset.start)||start;",
          "var we=parseFloat(w.dataset.end)||end;",
          "tl.fromTo(w,{opacity:0,scale:0.7,yPercent:12},{opacity:1,scale:1,yPercent:0,duration:0.18,ease:'back.out(2.2)'},ws);",
          activeColor
            ? `tl.set(w,{color:'${activeColor}'},ws);tl.set(w,{color:'${baseColor}'},we);`
            : "",
          "});",
        ].join("")
      : "",
    "});",
    `tl.to({},{duration:${round(Math.max(0.1, totalDuration))}});`,
    'window.__timelines["captions"]=tl;',
    "})();",
  ].join("");
}

/**
 * Build a complete caption overlay block (DOM + <style> + <script>) ready to
 * insert into a composition's <body>. Returns the HTML string.
 */
export function buildCaptionLayer(options: BuildCaptionLayerOptions): string {
  const preset = CAPTION_PRESETS[options.presetId ?? DEFAULT_CAPTION_PRESET];
  const css = buildCaptionCss(preset, options.width, options.height);

  const cueMarkup = options.cues
    .filter((cue) => cue.text.trim().length > 0 && cue.end > cue.start)
    .map((cue) => {
      const words = wordsForCue(cue);
      const spans = words
        .map(
          (word) =>
            `<span class="vibe-word" data-start="${round(word.start)}" data-end="${round(word.end)}">${escapeHtml(word.text)}</span>`,
        )
        .join(" ");
      return `<div class="vibe-cue" data-start="${round(cue.start)}" data-end="${round(cue.end)}">${spans}</div>`;
    })
    .join("");

  return [
    `<div class="vibe-captions" data-preset="${preset.id}" aria-hidden="true">${cueMarkup}</div>`,
    `<style>${css}</style>`,
    `<script>${buildTimelineScript(preset, options.totalDuration)}</script>`,
  ].join("\n");
}
