import type { CapacitorConfig } from "@capacitor/cli";

// VibeEdit ships as a Capacitor-wrapped web app — the native WebView
// loads vibevideoedit.com directly, so the app is always in sync with
// the live site. No client bundle to ship.
//
// Override priority:
//   CAP_DEV_URL    e.g. http://192.168.1.14:3000 — laptop dev server
//   CAP_PROD_URL   defaults to https://vibevideoedit.com
//
// Example local dev (phone hits laptop dev server):
//   CAP_DEV_URL=http://<lan-ip>:3000 bun run cap:sync && bun run cap:run:android
//
// Example release build (phone hits production):
//   bun run cap:sync && bun run cap:build:android
const devUrl = process.env.CAP_DEV_URL;
const prodUrl = process.env.CAP_PROD_URL ?? "https://vibevideoedit.com";
const serverUrl = devUrl ?? prodUrl;

const config: CapacitorConfig = {
  appId: "com.vibeedit.studio",
  appName: "VibeEdit Studio",
  // Native WebView needs a webDir even when server.url is set — we point it
  // at public/ so the capacitor sync step has something to copy.
  webDir: "public",
  server: {
    url: serverUrl,
    // Only allow plaintext when explicitly pointing at a dev server.
    cleartext: !!devUrl,
  },
  ios: {
    contentInset: "always",
  },
  android: {
    allowMixedContent: !!devUrl,
  },
};

export default config;
