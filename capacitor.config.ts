import type { CapacitorConfig } from "@capacitor/cli";
import { KeyboardResize, KeyboardStyle } from "@capacitor/keyboard";

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
    // Run inside vibevideoedit.com's origin so cookies + auth flow as
    // they would in a normal browser.
    androidScheme: "https",
  },
  ios: {
    contentInset: "always",
  },
  android: {
    allowMixedContent: !!devUrl,
  },
  plugins: {
    SplashScreen: {
      // Hold the splash until the JS-side bootstrap calls hide(). 3s
      // is a generous ceiling — typical hide is <1s post-hydration.
      launchShowDuration: 3000,
      launchAutoHide: false,
      backgroundColor: "#0a0a0a",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
      // We don't ship a custom splash drawable — Capacitor falls back
      // to the app icon on a black background, which matches our
      // dashboard's gradient. Bespoke art is follow-up work.
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      // Bootstrap calls setOverlaysWebView/setStyle at runtime; this
      // block is the install-time default for the very first frame.
      overlaysWebView: true,
      style: "DARK",
      backgroundColor: "#00000000",
    },
    Keyboard: {
      resize: KeyboardResize.Native,
      style: KeyboardStyle.Dark,
      resizeOnFullScreen: true,
    },
  },
};

export default config;
