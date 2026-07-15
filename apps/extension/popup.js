// Popup: configure the connection, then send the active tab's URL with a chosen
// action + optional in/out window to the background worker.

const $ = (id) => document.getElementById(id);

function parseTime(value) {
  const trimmed = (value || "").trim();
  if (!trimmed) return undefined;
  if (trimmed.includes(":")) {
    const [m, s] = trimmed.split(":");
    const mm = Number(m);
    const ss = Number(s);
    return Number.isFinite(mm) && Number.isFinite(ss) ? mm * 60 + ss : undefined;
  }
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : undefined;
}

function setStatus(text, ok) {
  const el = $("status");
  el.textContent = text;
  el.style.color = ok === undefined ? "#666" : ok ? "#1a7f37" : "#b3261e";
}

function toggleAttest() {
  $("attestLabel").style.display = $("action").value === "recreate" ? "none" : "block";
}

function renderConnState(hasToken) {
  const conn = $("connState");
  conn.textContent = hasToken ? "Connected ✓" : "Not connected — click below to get a token";
  conn.classList.toggle("ok", Boolean(hasToken));
  // Sending is only useful once connected; keep the button enabled but the
  // status will explain if it isn't.
  $("send").style.opacity = hasToken ? "1" : "0.6";
}

function currentApiBase() {
  return ($("apiBase").value.trim() || "https://vibevideoedit.com").replace(/\/+$/, "");
}

async function restore() {
  const cfg = await chrome.storage.sync.get(["apiBase", "token", "defaultAction"]);
  $("apiBase").value = cfg.apiBase || "https://vibevideoedit.com";
  $("token").value = cfg.token || "";
  if (cfg.defaultAction) $("action").value = cfg.defaultAction;
  renderConnState(Boolean(cfg.token));
  toggleAttest();
}

// "Get a token" → open the site's connect page (first-party, logged in). The
// site hands the token back to the extension automatically via the site-bridge
// content script, so the user never copies anything.
$("getToken").addEventListener("click", () => {
  chrome.tabs.create({ url: `${currentApiBase()}/app/settings/extension` });
});

// Live-update connection state if the site hands off a token while the popup is
// open (e.g. the user clicked Connect on the site page).
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync" && changes.token) {
    $("token").value = changes.token.newValue || "";
    renderConnState(Boolean(changes.token.newValue));
  }
});

$("action").addEventListener("change", toggleAttest);

$("saveConfig").addEventListener("click", async () => {
  await chrome.storage.sync.set({
    apiBase: $("apiBase").value.trim(),
    token: $("token").value.trim(),
  });
  setStatus("Settings saved.", true);
});

$("send").addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url) {
    setStatus("No active tab URL.", false);
    return;
  }
  const action = $("action").value;
  // Remember the last-used action as the default for the content-script button.
  await chrome.storage.sync.set({ defaultAction: action });
  setStatus("Sending…");
  chrome.runtime.sendMessage(
    {
      type: "capture",
      payload: {
        url: tab.url,
        action,
        startSeconds: parseTime($("start").value),
        endSeconds: parseTime($("end").value),
        attested: $("attested").checked,
      },
    },
    (response) => {
      if (chrome.runtime.lastError || !response) {
        setStatus("Failed — is the extension connected?", false);
        return;
      }
      if (response.ok) {
        const where = response.data?.target === "project" ? "a project" : "your library";
        setStatus(`Sent to ${where}.`, true);
      } else {
        setStatus(response.error || "Failed.", false);
      }
    },
  );
});

restore();
