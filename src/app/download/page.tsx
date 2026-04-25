"use client";

import { Check, Download, Share, Smartphone } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
};

// /download — installs the app via PWA. No fake store badges; this is
// the real install path that actually works today on every modern phone
// + desktop browser.
export default function DownloadPage() {
  const [installPrompt, setInstallPrompt] = useState<InstallEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [platform, setPlatform] = useState<"ios" | "android" | "desktop">("desktop");

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as InstallEvent);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setInstalled(true);
    }
    const ua = navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(ua)) setPlatform("ios");
    else if (/android/.test(ua)) setPlatform("android");
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === "accepted") setInstalled(true);
    setInstallPrompt(null);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 gap-8 bg-neutral-950 text-neutral-100">
      <Link
        href="/"
        className="text-[11px] text-neutral-500 hover:text-white absolute top-4 left-4"
      >
        ← back to editor
      </Link>

      <div className="flex flex-col items-center gap-2 text-center max-w-md">
        <div className="text-3xl">🎬</div>
        <h1 className="text-2xl font-semibold text-white">Install VibeEdit</h1>
        <p className="text-sm text-neutral-400">
          One-tap install — works on every modern phone, tablet, and
          desktop. Same editor, same agent, fits your home screen.
        </p>
      </div>

      <div className="w-full max-w-md flex flex-col gap-3">
        {installed ? (
          <div className="flex items-center justify-center gap-2 p-6 rounded-xl bg-emerald-500/10 border border-emerald-500/40 text-emerald-300">
            <Check className="h-5 w-5" />
            <span className="text-sm font-semibold">
              Installed — open from your home screen
            </span>
          </div>
        ) : installPrompt ? (
          <button
            onClick={handleInstall}
            className="flex items-center justify-center gap-3 p-6 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-base transition-colors"
          >
            <Download className="h-5 w-5" />
            Install VibeEdit
          </button>
        ) : (
          <div className="flex flex-col gap-2 p-6 rounded-xl bg-neutral-900 border border-neutral-800">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <Smartphone className="h-4 w-4 text-emerald-400" />
              {platform === "ios"
                ? "Add to Home Screen on iOS"
                : platform === "android"
                  ? "Install on Android"
                  : "Install in your browser"}
            </div>
            {platform === "ios" ? (
              <ol className="text-xs text-neutral-400 leading-relaxed space-y-1 pl-5 list-decimal">
                <li>
                  Tap the <Share className="h-3 w-3 inline -mt-0.5" /> Share
                  button
                </li>
                <li>
                  Scroll down → <strong>Add to Home Screen</strong>
                </li>
                <li>
                  Tap <strong>Add</strong> in the top-right
                </li>
              </ol>
            ) : platform === "android" ? (
              <ol className="text-xs text-neutral-400 leading-relaxed space-y-1 pl-5 list-decimal">
                <li>Tap the ⋮ menu in Chrome</li>
                <li>
                  Tap <strong>Install app</strong> (or &ldquo;Add to Home
                  Screen&rdquo;)
                </li>
                <li>Confirm</li>
              </ol>
            ) : (
              <ol className="text-xs text-neutral-400 leading-relaxed space-y-1 pl-5 list-decimal">
                <li>
                  Look for the install icon in your address bar (▢↓ in
                  Chrome, ⊕ in Edge, or use the App menu in Safari)
                </li>
                <li>
                  Click it → <strong>Install</strong>
                </li>
                <li>VibeEdit opens in its own window</li>
              </ol>
            )}
          </div>
        )}

        <div className="flex flex-col gap-1 p-3 rounded-lg bg-neutral-900/50 border border-neutral-800/50 text-[11px] text-neutral-500">
          <span className="font-semibold text-neutral-400">Why a PWA?</span>
          <span>
            VibeEdit is web-native — installing as a PWA gives you the
            home-screen icon and standalone window without a 100MB native
            build. iOS / Android store releases ship later.
          </span>
        </div>

        {/* Real APK download — built by GitHub Actions on every push. */}
        <div className="flex flex-col gap-2 p-3 rounded-lg bg-neutral-900/50 border border-neutral-800/50">
          <div className="flex items-center gap-2 text-[11px] font-semibold text-neutral-300">
            <Smartphone className="h-3.5 w-3.5 text-emerald-400" />
            Native Android APK
          </div>
          <a
            href="https://github.com/heynoblehero/VibeEdit/releases/download/android-latest/vibeedit.apk"
            className="flex items-center gap-2 text-xs text-emerald-400 hover:text-emerald-300"
          >
            <Download className="h-3.5 w-3.5" />
            Latest APK (auto-built from master)
          </a>
          <span className="text-[10px] text-neutral-500 leading-tight">
            Unsigned debug build. Sideload it (Settings → allow
            &ldquo;Install unknown apps&rdquo;). Wraps vibevideoedit.com in
            a Capacitor WebView. iOS via TestFlight — DM for invite.
          </span>
        </div>

        <a
          href="/"
          className="text-center text-xs text-neutral-500 hover:text-emerald-400 underline decoration-dotted underline-offset-2"
        >
          or just bookmark vibevideoedit.com →
        </a>
      </div>
    </div>
  );
}
