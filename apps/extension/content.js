// YouTube watch page: inject a small "Send to VibeEdit" button. Clicking sends
// the current page URL to the background worker, which posts it to /api/capture.
// We include the current playback time as a suggested start so the user lands on
// roughly the moment they were watching (they can refine in the app).

(function () {
  const BUTTON_ID = "vibeedit-send-button";

  function findVideoTime() {
    const video = document.querySelector("video");
    return video && Number.isFinite(video.currentTime) ? Math.floor(video.currentTime) : undefined;
  }

  function flash(text, ok) {
    const button = document.getElementById(BUTTON_ID);
    if (!button) return;
    const original = button.textContent;
    button.textContent = text;
    button.style.background = ok ? "#1a7f37" : "#b3261e";
    setTimeout(() => {
      button.textContent = original;
      button.style.background = "";
    }, 2200);
  }

  function send() {
    chrome.runtime.sendMessage(
      {
        type: "capture",
        payload: { url: location.href, startSeconds: findVideoTime() },
      },
      (response) => {
        if (chrome.runtime.lastError) {
          flash("Error", false);
          return;
        }
        if (response?.ok) {
          const where = response.data?.target === "project" ? "project" : "library";
          flash(`Sent to ${where}`, true);
        } else {
          flash(response?.error ? "Failed" : "Failed", false);
        }
      },
    );
  }

  function ensureButton() {
    if (document.getElementById(BUTTON_ID)) return;
    // Place it in the actions row under the video when present.
    const anchor = document.querySelector("#top-level-buttons-computed") || document.body;
    const button = document.createElement("button");
    button.id = BUTTON_ID;
    button.className = "vibeedit-send-button";
    button.textContent = "＋ VibeEdit";
    button.title = "Send this clip to VibeEdit";
    button.addEventListener("click", send);
    anchor.prepend(button);
  }

  // YouTube is a SPA — re-check periodically so the button survives navigation.
  ensureButton();
  const observer = new MutationObserver(() => ensureButton());
  observer.observe(document.body, { childList: true, subtree: true });
})();
