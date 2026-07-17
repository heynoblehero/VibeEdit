import { NextResponse } from "next/server";
import { readRegistryHtml } from "@/lib/ai/registry";

export const runtime = "nodejs";

// Serves a registry block's composition HTML for a LIVE preview iframe in the
// Effects Store. The blocks register PAUSED GSAP timelines (for seekable render),
// so we inject a tiny script that plays + loops them for the preview. Trusted
// first-party content (our own registry), so it's fine to run in a frame.
const AUTOPLAY = `
<script>
(function () {
  // Scale the fixed-size composition to fill the (small) preview iframe.
  function fit() {
    try {
      var root = document.querySelector('[data-composition-id]') ||
        document.querySelector('#root') || document.body.firstElementChild;
      if (!root) return;
      var w = parseFloat(root.getAttribute('data-width')) || root.offsetWidth || 1920;
      var h = parseFloat(root.getAttribute('data-height')) || root.offsetHeight || 1080;
      var s = Math.min(window.innerWidth / w, window.innerHeight / h);
      document.documentElement.style.overflow = 'hidden';
      document.body.style.margin = '0';
      document.body.style.overflow = 'hidden';
      document.body.style.background = '#000';
      root.style.transformOrigin = 'top left';
      root.style.transform = 'translate(' + (window.innerWidth - w * s) / 2 + 'px,' +
        (window.innerHeight - h * s) / 2 + 'px) scale(' + s + ')';
    } catch (e) {}
  }
  function play() {
    try {
      var tls = window.__timelines || {};
      Object.keys(tls).forEach(function (k) {
        var tl = tls[k];
        if (tl && typeof tl.repeat === 'function') { try { tl.repeat(-1); } catch (e) {} }
        if (tl && typeof tl.play === 'function') { try { tl.play(0); } catch (e) {} }
      });
    } catch (e) {}
  }
  window.addEventListener('load', function () { setTimeout(function () { fit(); play(); }, 120); });
  window.addEventListener('resize', fit);
})();
</script>`;

export async function GET(_req: Request, context: { params: Promise<{ name: string }> }) {
  const { name } = await context.params;
  // Guard the path — name is a single registry slug, never a path.
  if (!/^[a-z0-9][a-z0-9-]{0,60}$/i.test(name))
    return new NextResponse("bad name", { status: 400 });
  const html = readRegistryHtml(name);
  if (!html) return new NextResponse("not found", { status: 404 });
  const withAutoplay = html.includes("</body>")
    ? html.replace("</body>", `${AUTOPLAY}</body>`)
    : `${html}${AUTOPLAY}`;
  return new NextResponse(withAutoplay, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=300",
    },
  });
}
