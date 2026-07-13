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

async function restore() {
  const cfg = await chrome.storage.sync.get(["apiBase", "token", "defaultAction"]);
  $("apiBase").value = cfg.apiBase || "https://vibevideoedit.com";
  $("token").value = cfg.token || "";
  if (cfg.defaultAction) $("action").value = cfg.defaultAction;
  toggleAttest();
}

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
