import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { projects, renderJobs } from "@/lib/db/schema";
import { Wordmark } from "@/components/Wordmark";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ slug: string }> };

function queryRow(slug: string) {
  return db
    .select({
      id: renderJobs.id,
      status: renderJobs.status,
      projectName: projects.name,
      finishedAt: renderJobs.finishedAt,
    })
    .from(renderJobs)
    .leftJoin(projects, eq(renderJobs.projectId, projects.id))
    .where(eq(renderJobs.publicShareSlug, slug))
    .get();
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const row = queryRow(slug);
  if (!row || row.status !== "done") {
    return { title: "Not Found", robots: { index: false, follow: false } };
  }
  const name = row.projectName || "Untitled";
  const ogImage =
    "/og?title=" +
    encodeURIComponent(name) +
    "&subtitle=" +
    encodeURIComponent("Made with VibeEdit — from a single chat prompt.") +
    "&badge=" +
    encodeURIComponent("Made with VibeEdit");
  const pageUrl = `/share/${slug}`;
  return {
    title: `${name} — Made with VibeEdit`,
    description: "This video was built from a single chat prompt using the VibeEdit AI agent.",
    alternates: { canonical: pageUrl },
    // Share links are meant to be shared, but not indexed in search.
    robots: { index: false, follow: true },
    openGraph: {
      title: `${name} — Made with VibeEdit`,
      description: "Describe the video. Get the MP4. No timeline needed.",
      type: "video.other",
      url: pageUrl,
      siteName: "VibeEdit",
      images: [{ url: ogImage, width: 1200, height: 630, alt: `${name} — made with VibeEdit` }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${name} — Made with VibeEdit`,
      description: "Built with VibeEdit — AI video editing agent.",
      images: [ogImage],
    },
  };
}

export default async function PublicShare({ params }: PageProps) {
  const { slug } = await params;
  const row = queryRow(slug);
  if (!row || row.status !== "done") notFound();

  const finishedAt = row.finishedAt ? new Date(row.finishedAt).toLocaleDateString() : "";
  const videoUrl = `/api/share/${slug}/video`;

  return (
    <main className="min-h-screen">
      <header className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 p-4 sm:p-6">
        <Link href="/">
          <Wordmark size="md" />
        </Link>
        <Link
          href="/app/signup"
          className="rounded-md bg-[var(--color-accent)] px-3 py-2 text-xs font-semibold text-black hover:opacity-90 sm:px-4 sm:text-sm"
        >
          Make your own — $1 trial
        </Link>
      </header>

      <section className="mx-auto max-w-3xl px-4 pt-6 sm:px-6">
        <div className="mb-4 text-xs uppercase tracking-wider text-[var(--color-fg-muted)]">
          Made with VibeEdit Video {finishedAt && `· ${finishedAt}`}
        </div>
        <h1 className="mb-6 break-words text-2xl font-bold sm:text-3xl md:text-4xl">
          {row.projectName || "Untitled render"}
        </h1>
        <div className="overflow-hidden rounded-t-2xl border border-[var(--color-border)] bg-black shadow-2xl">
          <video src={videoUrl} controls autoPlay loop playsInline className="block h-auto w-full">
            <track kind="captions" />
          </video>
        </div>
        <div className="flex items-center justify-between rounded-b-2xl border-t border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-xs text-[var(--color-fg-muted)]">
          <span>Made with VibeEdit</span>
          <span>{finishedAt}</span>
        </div>
      </section>

      <section className="mx-auto mt-12 max-w-3xl px-4 pb-24 sm:mt-16 sm:px-6 sm:pb-32">
        <div className="mb-8 grid grid-cols-1 gap-3 text-center text-sm sm:grid-cols-3">
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
            <div className="mb-1 text-lg">✏️</div>
            <div className="font-semibold">Describe it</div>
            <div className="text-xs text-[var(--color-fg-muted)]">One chat message</div>
          </div>
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
            <div className="mb-1 text-lg">⚙️</div>
            <div className="font-semibold">Agent builds it</div>
            <div className="text-xs text-[var(--color-fg-muted)]">Every frame, automated</div>
          </div>
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
            <div className="mb-1 text-lg">▶️</div>
            <div className="font-semibold">Export MP4</div>
            <div className="text-xs text-[var(--color-fg-muted)]">1080p, no watermark</div>
          </div>
        </div>
        <div className="text-center">
          <h2 className="mb-3 text-xl font-bold sm:text-2xl">Make your own in minutes.</h2>
          <Link
            href="/app/signup"
            className="inline-block rounded-md bg-[var(--color-accent)] px-6 py-3 font-semibold text-black hover:opacity-90"
          >
            Start your 7-day free trial
          </Link>
          <div className="mt-2 text-xs text-[var(--color-fg-muted)]">
            7-day trial on every plan · cancel any time
          </div>
        </div>
      </section>
    </main>
  );
}
