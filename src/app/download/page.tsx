"use client";

import { Apple, Download, Globe, Smartphone } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

// /download — landing page for the mobile / desktop install options.
// Until the iOS / Android stores ship, the primary "install" path is
// PWA "Add to Home Screen" — works on Chrome / Safari / Edge today.
export default function DownloadPage() {
  const [installPrompt, setInstallPrompt] = useState<Event | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setInstalled(true);
    }
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const handleInstall = async () => {
    const e = installPrompt as unknown as {
      prompt: () => Promise<void>;
      userChoice: Promise<{ outcome: string }>;
    } | null;
    if (!e) return;
    await e.prompt();
    const { outcome } = await e.userChoice;
    if (outcome === "accepted") setInstalled(true);
    setInstallPrompt(null);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 gap-8 bg-neutral-950 text-neutral-100">
      <Link
        href="/"
        className="text-[11px] text-neutral-500 hover:text-white absolute top-4 left-4"
      >
        ← back to editor
      </Link>

      <div className="flex flex-col items-center gap-2 text-center max-w-md">
        <div className="text-3xl">🎬</div>
        <h1 className="text-2xl font-semibold text-white">Get VibeEdit</h1>
        <p className="text-sm text-neutral-400">
          Install it as an app — works on phone, tablet, and desktop. Same
          editor, same chat agent, fits your home screen.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-2xl">
        <button
          onClick={handleInstall}
          disabled={!installPrompt && !installed}
          className="flex flex-col items-center justify-center gap-2 p-6 rounded-xl border border-emerald-500/40 bg-emerald-500/5 hover:bg-emerald-500/10 disabled:opacity-50 transition-colors"
        >
          <Globe className="h-6 w-6 text-emerald-400" />
          <span className="text-sm font-semibold text-white">
            {installed
              ? "Installed ✓"
              : installPrompt
                ? "Install web app"
                : "Add to home screen"}
          </span>
          <span className="text-[10px] text-neutral-500 leading-tight text-center">
            {installPrompt
              ? "Click to install. Works offline-ish, full screen."
              : "On iOS Safari: Share → Add to Home Screen. On Android: ⋮ → Install app."}
          </span>
        </button>

        <div className="flex flex-col items-center justify-center gap-2 p-6 rounded-xl border border-neutral-800 bg-neutral-900 opacity-70">
          <Apple className="h-6 w-6 text-neutral-400" />
          <span className="text-sm font-semibold text-white">iOS App Store</span>
          <span className="text-[10px] text-neutral-500">
            Coming soon — TestFlight invite available on request.
          </span>
        </div>

        <div className="flex flex-col items-center justify-center gap-2 p-6 rounded-xl border border-neutral-800 bg-neutral-900 opacity-70">
          <Smartphone className="h-6 w-6 text-neutral-400" />
          <span className="text-sm font-semibold text-white">Android</span>
          <span className="text-[10px] text-neutral-500">
            APK + Play Store coming. <br />
            <a
              href="https://github.com/heynoblehero/VibeEdit/releases"
              target="_blank"
              rel="noreferrer"
              className="underline hover:text-emerald-400"
            >
              Latest builds →
            </a>
          </span>
        </div>
      </div>

      <div className="flex flex-col items-center gap-2 text-center pt-4 border-t border-neutral-800 w-full max-w-md">
        <span className="text-[10px] uppercase tracking-wider text-neutral-600">
          Or just bookmark
        </span>
        <a
          href="https://vibevideoedit.com"
          className="flex items-center gap-2 text-sm text-emerald-400 hover:text-emerald-300"
        >
          <Download className="h-4 w-4" />
          vibevideoedit.com
        </a>
        <span className="text-[10px] text-neutral-600 leading-tight">
          Modern browsers (Chrome, Safari, Edge) get an Install button in
          the address bar. Add it for a one-tap experience.
        </span>
      </div>
    </div>
  );
}
