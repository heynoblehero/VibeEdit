import type { CapacitorConfig } from "@capacitor/cli";

// VibeEdit Studio ships as a Capacitor-wrapped web app.
//
// For development, set `CAP_DEV_URL=http://<laptop-ip>:3000` and the native
// WebView loads the running Next.js dev server live — code edits reflect on
// device immediately, no rebuild. Example:
//
//   CAP_DEV_URL=http://192.168.1.14:3000 bun run cap:sync
//
// For a production build, export the Next.js app statically (or serve it
// from a remote URL) and drop the output into `webDir` / `server.url`.
const devUrl = process.env.CAP_DEV_URL;

const config: CapacitorConfig = {
  appId: "com.vibeedit.studio",
  appName: "VibeEdit Studio",
  // Native WebView needs a webDir even when server.url is set — we point it
  // at public/ so the capacitor sync step has something to copy.
  webDir: "public",
  server: devUrl
    ? {
        url: devUrl,
        cleartext: true,
      }
    : undefined,
  ios: {
    contentInset: "always",
  },
  android: {
    allowMixedContent: true,
  },
};

export default config;
