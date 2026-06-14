// Loads the <hyperframes-player> web component script once, shared across the
// live preview and the inline per-version snapshot players. Resolves immediately
// if the element is already defined; de-dupes concurrent + repeat callers so we
// never inject the CDN <script> twice.
let loadPromise: Promise<void> | null = null;

const SCRIPT_SRC =
  "https://cdn.jsdelivr.net/npm/@hyperframes/player/dist/hyperframes-player.global.js";

export function loadHyperframesPlayer(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (customElements.get("hyperframes-player")) return Promise.resolve();
  if (loadPromise) return loadPromise;

  loadPromise = new Promise<void>((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>("script[data-hf-player]");
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => resolve());
      return;
    }
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.dataset.hfPlayer = "1";
    script.onload = () => resolve();
    // Resolve on error too: the caller renders a graceful fallback rather than
    // hanging on a never-ready player.
    script.onerror = () => resolve();
    document.head.appendChild(script);
  });
  return loadPromise;
}
