# VibeEdit browser extension

Send a clip from any video page (YouTube first) to your VibeEdit reference
library or a project. The extension is intentionally thin: it only hands off the
page URL + an optional in/out window + the intended action. All downloading,
trimming, and analysis happens server-side via `POST /api/capture`.

## How it works

1. Load this folder as an unpacked extension (see below).
2. Open VibeEdit (vibevideoedit.com) — the header shows **Connect extension**.
   Click it once and the site hands the extension a connection token
   automatically (no copy/paste). Manual fallback: mint a token in
   **Settings → Extension** and paste it into the popup's **Connection settings**.
3. On a video page, either:
   - click the **＋ VibeEdit** button injected under the YouTube player, or
   - open the extension popup, pick an action + optional trim, and **Send current tab**.

The extension authenticates with the per-user token in an `x-vibe-token` header
(no cookies), so it works cross-origin without exposing your session.

## Actions

- **Recreate the style** — the AI builds an original composition from the clip;
  the source footage is never re-hosted. Always allowed.
- **Reuse the footage** / **Save the clip** — retains the actual footage; requires
  you to confirm you own it or it's licensed (or the source is Creative Commons).

## Load unpacked (development)

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked** and select this `apps/extension/` folder.

This folder is plain MV3 (no build step). It is not part of the Turbo/web build.

## Notes

- `host_permissions` in `manifest.json` lists the VibeEdit origins the extension
  may call (`vibeedit.video` + localhost). If you self-host on another domain,
  add it there.
- Icons are intentionally omitted for now; Chrome renders a default. Add
  `icons` + an `action.default_icon` before publishing to the Web Store.
