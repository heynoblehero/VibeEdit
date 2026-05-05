import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import { Toaster } from "sonner";
import { RenderOutputStrip } from "@/components/editor/RenderOutputStrip";
import { RenderQueuePanel } from "@/components/editor/RenderQueuePanel";
import { CommandPalette } from "@/components/shell/CommandPalette";
import { GlobalDropHint } from "@/components/shell/GlobalDropHint";
import { RecoveryToast } from "@/components/shell/RecoveryToast";
import { CapacitorBootstrap } from "@/components/shell/CapacitorBootstrap";
import { ServiceWorkerRegister } from "@/components/shell/ServiceWorkerRegister";
import { ShortcutsOverlay } from "@/components/shell/ShortcutsOverlay";
import { WhatsNewModal } from "@/components/shell/WhatsNewModal";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "VibeEdit — AI video editor",
    template: "%s · VibeEdit",
  },
  description:
    "Describe your video. The agent edits it. Faceless animation, comic dub, podcast clips, recipe reels — all from one chat.",
  applicationName: "VibeEdit",
  appleWebApp: {
    capable: true,
    title: "VibeEdit",
    statusBarStyle: "black-translucent",
  },
  openGraph: {
    title: "VibeEdit — AI video editor",
    description:
      "Describe your video. The agent edits it. Chat-first video editor on Claude + Remotion.",
    url: "https://vibevideoedit.com",
    siteName: "VibeEdit",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "VibeEdit — AI video editor",
    description: "Describe your video. The agent edits it.",
  },
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
};

// Mobile viewport: full-width, allow zoom (a11y), respect notch / safe-area.
// `viewportFit: "cover"` is what makes env(safe-area-inset-*) return real
// values on Android/iOS — without it the WebView pads the layout itself
// and our --safe-top vars are all zero.
export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Testing mode: wipe persisted project/chat state on every page load so
  // refresh = clean slate. Runs as an inline <script> so it executes BEFORE
  // zustand reads localStorage and hydrates the stores. UI prefs (theme,
  // chat-width) are left alone. Flip the "true" below to disable.
  const resetOnLoadScript = `
    (function(){
      if (!true) return;
      try {
        // Escape hatch: ?persist=1 in the URL keeps state for this load.
        if (location.search.indexOf("persist=1") >= 0) return;
        for (const k of ["vibeedit-project","vibeedit-chat","vibeedit-broll","vibeedit-render-queue"]) {
          localStorage.removeItem(k);
        }
      } catch (e) {}
    })();
  `;
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Script
          id="vibeedit-reset-on-load"
          strategy="beforeInteractive"
        >
          {resetOnLoadScript}
        </Script>
        {children}
        <CommandPalette />
        <ShortcutsOverlay />
        <RenderQueuePanel />
        <RenderOutputStrip />
        <GlobalDropHint />
        <RecoveryToast />
        <ServiceWorkerRegister />
        <CapacitorBootstrap />
        <WhatsNewModal />
        <Toaster
          theme="dark"
          position="bottom-right"
          richColors
          expand
          visibleToasts={3}
          duration={2400}
        />
      </body>
    </html>
  );
}
