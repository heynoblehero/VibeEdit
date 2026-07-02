import Link from "next/link";
import type { Metadata } from "next";
import { Wordmark } from "@/components/Wordmark";
import WatermarkRemoverTool from "@/components/tools/WatermarkRemoverTool";

export const metadata: Metadata = {
  title: "Free AI Video Watermark Remover — Remove Veo Watermark | VibeEdit",
  description:
    "Remove the watermark from AI-generated videos (Veo, and more) free online. Upload your clip, get a clean download. No signup for your first few — no software to install.",
  alternates: { canonical: "/tools/watermark-remover" },
  openGraph: {
    title: "Free AI Video Watermark Remover — VibeEdit",
    description:
      "Remove the Veo / AI watermark from videos you generated. Free, online, no signup to start.",
    type: "website",
    url: "/tools/watermark-remover",
    siteName: "VibeEdit",
  },
};

export default function WatermarkRemoverPage() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-[var(--color-border)]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/">
            <Wordmark size="md" />
          </Link>
          <div className="flex items-center gap-4 text-sm">
            <Link
              href="/tools"
              className="text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
            >
              ← All tools
            </Link>
            <Link
              href="/early"
              className="rounded-md bg-[var(--color-accent)] px-4 py-1.5 font-semibold text-black hover:opacity-90"
            >
              Sign up free
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold sm:text-4xl">AI Video Watermark Remover</h1>
          <p className="mx-auto mt-2 max-w-xl text-[var(--color-fg-muted)]">
            Remove the visible watermark from AI-generated videos you created. Upload, and download
            a clean clip in seconds — free, right in your browser.
          </p>
        </div>

        <WatermarkRemoverTool />

        <section className="mx-auto mt-12 max-w-2xl space-y-6 text-sm text-[var(--color-fg-muted)]">
          <div>
            <h2 className="mb-1 font-semibold text-[var(--color-fg)]">How it works</h2>
            <p>
              Upload your video, pick where the watermark sits (Veo puts it bottom-right by
              default), and we cleanly reconstruct that region. Your audio is preserved untouched.
              Files are processed and then deleted — we don&apos;t keep your videos.
            </p>
          </div>
          <div>
            <h2 className="mb-1 font-semibold text-[var(--color-fg)]">
              Please only use it on your own content
            </h2>
            <p>
              This removes the <em>visible</em> logo from videos you generated. Invisible provenance
              watermarks (like Google&apos;s SynthID) are not affected, so the clip remains
              identifiable as AI-generated. Don&apos;t use this to misrepresent others&apos; work.
            </p>
          </div>
          <div>
            <h2 className="mb-1 font-semibold text-[var(--color-fg)]">
              Want more than a watermark?
            </h2>
            <p>
              <Link href="/early" className="text-[var(--color-accent)] hover:underline">
                VibeEdit
              </Link>{" "}
              turns a prompt into a finished video — script, voiceover, captions, b-roll, the whole
              thing. Free to start.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
