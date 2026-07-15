// Service worker: the only place that talks to the VibeEdit API. Content script
// and popup post messages here; we read the saved config (API base + token) and
// call POST /api/capture. Keeping the fetch here (not in the content script)
// avoids page-CSP interference and keeps the token out of page context.

const DEFAULT_BASE = "https://vibevideoedit.com";

async function getConfig() {
  const { apiBase, token, defaultAction } = await chrome.storage.sync.get([
    "apiBase",
    "token",
    "defaultAction",
  ]);
  return {
    apiBase: (apiBase || DEFAULT_BASE).replace(/\/+$/, ""),
    token: token || "",
    defaultAction: defaultAction || "save",
  };
}

async function capture(payload) {
  const { apiBase, token, defaultAction } = await getConfig();
  if (!token)
    return {
      ok: false,
      error: "No connection token set. Open the extension and paste one from Settings → Extension.",
    };

  const body = {
    url: payload.url,
    action: payload.action || defaultAction,
    startSeconds: payload.startSeconds,
    endSeconds: payload.endSeconds,
    projectId: payload.projectId,
    attested: payload.attested === true,
  };

  try {
    const response = await fetch(`${apiBase}/api/capture`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-vibe-token": token },
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return { ok: false, error: data.message || data.error || `HTTP ${response.status}` };
    }
    // Absolutize the editor link so the content script can open it directly.
    if (data.editorPath) data.editorUrl = `${apiBase}${data.editorPath}`;
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: String(error) };
  }
}

// Toolbar-icon badge = live connection confirmation. A lime "✓" means a token
// is stored (connected); cleared means not connected.
function updateBadge(hasToken) {
  chrome.action.setBadgeText({ text: hasToken ? "✓" : "" });
  chrome.action.setBadgeBackgroundColor({ color: "#d4ff3a" });
}
chrome.storage.sync.get(["token"], ({ token }) => updateBadge(Boolean(token)));
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync" && changes.token) updateBadge(Boolean(changes.token.newValue));
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "capture") {
    capture(message.payload).then(sendResponse);
    return true; // async response
  }
  if (message?.type === "getConfig") {
    getConfig().then((cfg) =>
      sendResponse({
        apiBase: cfg.apiBase,
        hasToken: Boolean(cfg.token),
        defaultAction: cfg.defaultAction,
      }),
    );
    return true;
  }
  return false;
});
