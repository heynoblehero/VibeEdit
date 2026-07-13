// site-bridge.js — runs only on the VibeEdit site. Two jobs:
//   (a) announce the extension is installed, so the site can show connected UI
//   (b) accept a connection token from the site in ONE click (via postMessage),
//       so the user never has to copy/paste a token into the popup.
// Communication is same-origin window.postMessage; the token never leaves the
// VibeEdit tab.

const VERSION = chrome.runtime.getManifest().version;

function announce() {
  // Synchronous attribute for instant detection on page load.
  document.documentElement.setAttribute("data-vibeedit-extension", VERSION);
  // Async presence message that also reports whether a token is already stored,
  // so the site can show "Connected" vs "Connect extension".
  chrome.storage.sync.get(["token"], ({ token }) => {
    window.postMessage(
      {
        source: "vibeedit-extension",
        type: "present",
        version: VERSION,
        connected: Boolean(token),
      },
      location.origin,
    );
  });
}

// Set as early as possible (document_start) and again once the DOM is ready in
// case the app framework rewrites <html> attributes on hydration.
announce();
window.addEventListener("DOMContentLoaded", announce);

window.addEventListener("message", (event) => {
  if (event.source !== window) return;
  const data = event.data;
  if (!data || data.source !== "vibeedit-site") return;

  if (data.type === "ping") {
    announce();
    return;
  }

  if (data.type === "connect" && typeof data.token === "string") {
    const apiBase =
      typeof data.apiBase === "string" && data.apiBase ? data.apiBase : location.origin;
    chrome.storage.sync.set({ token: data.token, apiBase: apiBase.replace(/\/+$/, "") }, () => {
      window.postMessage({ source: "vibeedit-extension", type: "connected" }, location.origin);
    });
  }
});
