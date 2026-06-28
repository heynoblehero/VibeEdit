// Pre-baked "instant first render" composition.
//
// New users hit a blank canvas + a slow first render — the two things most
// likely to make them bounce before they ever see a finished video. To beat
// that, onboarding writes this self-contained Hyperframes composition into the
// user's first project and enqueues a render immediately, so a polished MP4 is
// waiting when they land in the editor.
//
// This is NOT a new format. It follows the exact Hyperframes runtime contract
// (see isaac-hook/index.html and isaac-hook/CLAUDE.md):
//   - A `#root` element carries `data-composition-id`, `data-start`,
//     `data-duration`, `data-width`, `data-height`.
//   - Every timed element has `class="clip"` plus `data-start` /
//     `data-duration` / `data-track-index` so the framework can control its
//     visibility while seeking.
//   - A single GSAP timeline is created `paused` and registered on
//     `window.__timelines["main"]`; the engine seeks it frame-by-frame.
//   - Logic is fully deterministic (no Date.now / Math.random / network),
//     which is required for reproducible frame capture.
//
// It is intentionally dependency-light (only GSAP from a CDN + Google Fonts,
// same as the reference composition) so it renders without any uploaded assets.

export type StarterFormat = "16:9" | "9:16" | "both";

export type StarterCompositionInput = {
  /** Channel / brand name to headline the intro. Falls back gracefully. */
  channelName?: string | null;
  /** Onboarding niche, used to pick a tagline that feels personalized. */
  niche?: string | null;
  /** Brand primary color (hex). Drives the accent gradient + underline. */
  primaryColor?: string | null;
  /** Preferred aspect ratio from onboarding. "both" resolves to 16:9. */
  format?: StarterFormat | null;
};

const NICHE_TAGLINE: Record<string, string> = {
  youtube: "Your next video, made by talking.",
  shorts: "Scroll-stopping Shorts, on autopilot.",
  wedding: "Cinematic highlights, effortlessly.",
  corporate: "On-brand video, every single time.",
  education: "Lessons that actually get watched.",
  documentary: "Story-first edits, frame by frame.",
  content: "Post more. Edit less. Just vibe.",
  other: "Describe it. We render it.",
};

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

function safeColor(input: string | null | undefined, fallback: string): string {
  return input && HEX_RE.test(input) ? input : fallback;
}

// Minimal HTML-escape so a user-supplied channel name can't break out of the
// markup or inject script. We only ever interpolate text into element bodies.
function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function resolveDimensions(format: StarterFormat | null | undefined): {
  width: number;
  height: number;
} {
  // "both" defaults to landscape, matching the projects API default.
  return format === "9:16" ? { width: 1080, height: 1920 } : { width: 1920, height: 1080 };
}

/**
 * Build a complete, render-ready Hyperframes `index.html` for the starter
 * project. Pure + deterministic given its input.
 */
export function buildStarterComposition(input: StarterCompositionInput): string {
  const { width, height } = resolveDimensions(input.format);
  const isVertical = height > width;

  const rawName = (input.channelName || "").trim();
  const title = escapeHtml(rawName ? rawName : "Welcome to VibeEdit");
  const nicheKey = (input.niche || "").toLowerCase();
  const tagline = escapeHtml(NICHE_TAGLINE[nicheKey] || NICHE_TAGLINE.other);

  const accent = safeColor(input.primaryColor, "#7c3aed");
  const accent2 = "#22d3ee";

  // Type scale adapts to orientation so the headline never overflows 9:16.
  const titleSize = isVertical ? "120px" : "150px";
  const taglineSize = isVertical ? "44px" : "52px";
  const kickerSize = isVertical ? "30px" : "32px";

  // Total composition length in seconds. Kept short (6s) so the very first
  // render finishes fast — the whole point is a quick "aha".
  const DURATION = 6;

  return `<!doctype html>
<html lang="en" data-resolution="${isVertical ? "portrait" : "landscape"}">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=${width}, height=${height}" />
    <title>${title} — Starter</title>
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=block"
      rel="stylesheet"
    />
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body {
        width: ${width}px;
        height: ${height}px;
        overflow: hidden;
        background: #05050a;
        font-family: "Inter", system-ui, sans-serif;
        color: #fff;
      }
      #root { position: absolute; inset: 0; }
      #stage { position: absolute; inset: 0; }

      .scene {
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        text-align: center;
        padding: 8%;
        opacity: 0;
        will-change: opacity, transform;
      }

      /* Animated brand gradient backdrop */
      .bg {
        position: absolute;
        inset: -10%;
        z-index: 0;
        background:
          radial-gradient(ellipse at 30% 25%, ${accent}55 0%, transparent 55%),
          radial-gradient(ellipse at 75% 80%, ${accent2}33 0%, transparent 55%),
          radial-gradient(ellipse at 50% 50%, #11111c 0%, #05050a 70%, #000 100%);
        will-change: transform;
      }
      .grain {
        position: absolute;
        inset: 0;
        z-index: 1;
        background: radial-gradient(ellipse at center, transparent 45%, rgba(0,0,0,.7) 100%);
        pointer-events: none;
      }

      .kicker {
        position: relative;
        z-index: 2;
        font-size: ${kickerSize};
        font-weight: 700;
        letter-spacing: 0.35em;
        text-transform: uppercase;
        color: ${accent2};
        margin-bottom: 0.6em;
        opacity: 0;
        will-change: opacity, transform;
      }
      .title {
        position: relative;
        z-index: 2;
        font-size: ${titleSize};
        font-weight: 900;
        line-height: 0.98;
        letter-spacing: -0.02em;
        background: linear-gradient(120deg, #ffffff 0%, ${accent} 55%, ${accent2} 100%);
        -webkit-background-clip: text;
        background-clip: text;
        color: transparent;
        text-wrap: balance;
        will-change: opacity, transform;
      }
      .underline {
        position: relative;
        z-index: 2;
        height: 10px;
        width: 0;
        margin: 0.5em 0 0.65em;
        border-radius: 999px;
        background: linear-gradient(90deg, ${accent}, ${accent2});
        will-change: width;
      }
      .tagline {
        position: relative;
        z-index: 2;
        font-size: ${taglineSize};
        font-weight: 600;
        color: rgba(255,255,255,0.82);
        max-width: 80%;
        text-wrap: balance;
        opacity: 0;
        will-change: opacity, transform;
      }

      .cta {
        position: relative;
        z-index: 2;
        margin-top: 1.4em;
        font-size: ${kickerSize};
        font-weight: 800;
        padding: 0.7em 1.4em;
        border-radius: 999px;
        background: linear-gradient(120deg, ${accent}, ${accent2});
        color: #05050a;
        opacity: 0;
        will-change: opacity, transform;
      }
    </style>
  </head>
  <body>
    <div
      id="root"
      data-composition-id="main"
      data-start="0"
      data-duration="${DURATION}"
      data-width="${width}"
      data-height="${height}"
    >
      <div id="stage">
        <div id="s1" class="scene clip" data-start="0" data-duration="${DURATION}" data-track-index="0">
          <div class="bg" id="bg"></div>
          <div class="grain"></div>
          <div class="kicker" id="kicker">Your first video</div>
          <div class="title" id="title">${title}</div>
          <div class="underline" id="underline"></div>
          <div class="tagline" id="tagline">${tagline}</div>
          <div class="cta" id="cta">Made with VibeEdit</div>
        </div>
      </div>
    </div>

    <script>
      // Deterministic timeline only — required for reproducible frame capture.
      window.__timelines = window.__timelines || {};
      const tl = gsap.timeline({ paused: true });

      // Slow ambient drift on the backdrop for the whole composition.
      tl.set("#s1", { opacity: 1 }, 0);
      tl.fromTo("#bg",
        { scale: 1.05, xPercent: 0, yPercent: 0 },
        { scale: 1.14, xPercent: -2, yPercent: -2, duration: ${DURATION}, ease: "none" }, 0);

      // Kicker fades up.
      tl.fromTo("#kicker",
        { opacity: 0, y: 24 },
        { opacity: 1, y: 0, duration: 0.5, ease: "power2.out" }, 0.25);

      // Title rises + settles.
      tl.fromTo("#title",
        { opacity: 0, y: 60, scale: 0.96 },
        { opacity: 1, y: 0, scale: 1, duration: 0.7, ease: "power3.out" }, 0.5);

      // Underline wipes in beneath the title.
      tl.fromTo("#underline",
        { width: 0 },
        { width: "42%", duration: 0.6, ease: "power2.out" }, 1.0);

      // Tagline.
      tl.fromTo("#tagline",
        { opacity: 0, y: 24 },
        { opacity: 1, y: 0, duration: 0.6, ease: "power2.out" }, 1.4);

      // CTA pill pops in and gives a single confident pulse.
      tl.fromTo("#cta",
        { opacity: 0, y: 20, scale: 0.9 },
        { opacity: 1, y: 0, scale: 1, duration: 0.5, ease: "back.out(1.7)" }, 2.0);
      tl.to("#cta", { scale: 1.05, duration: 0.4, ease: "sine.inOut", yoyo: true, repeat: 1 }, 2.8);

      // Gentle outro lift so the loop feels intentional.
      tl.to("#s1", { y: -16, duration: 1.0, ease: "power1.in" }, ${DURATION - 1});

      window.__timelines["main"] = tl;
    </script>
  </body>
</html>
`;
}
