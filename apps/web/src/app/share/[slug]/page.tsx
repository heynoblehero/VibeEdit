import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { projects, renderJobs } from "@/lib/db/schema";
import { Wordmark } from "@/components/Wordmark";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ slug: string }> };

export default async function PublicShare({ params }: PageProps) {
	const { slug } = await params;
	const row = db
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
	if (!row || row.status !== "done") notFound();

	const finishedAt = row.finishedAt
		? new Date(row.finishedAt).toLocaleDateString()
		: "";
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
				<div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-black">
					<video
						src={videoUrl}
						controls
						autoPlay
						loop
						playsInline
						className="block h-auto w-full"
					>
						<track kind="captions" />
					</video>
				</div>
				<p className="mt-4 text-center text-sm text-[var(--color-fg-muted)]">
					This entire video was generated from a single chat prompt.
				</p>
			</section>

			<section className="mx-auto mt-12 max-w-3xl px-4 pb-24 text-center sm:mt-16 sm:px-6 sm:pb-32">
				<h2 className="mb-3 text-xl font-bold sm:text-2xl md:text-3xl">
					Stop editing. Start prompting.
				</h2>
				<p className="mx-auto mb-6 max-w-xl text-[var(--color-fg-muted)]">
					VibeEdit Video is Claude Code for video. You describe a hook, the
					AI writes the composition, and you watch it render — no timeline,
					no NLE, no keyframing.
				</p>
				<Link
					href="/app/signup"
					className="inline-block rounded-md bg-[var(--color-accent)] px-6 py-3 font-semibold text-black hover:opacity-90"
				>
					Make one yourself
				</Link>
				<div className="mt-2 text-xs text-[var(--color-fg-muted)]">
					$1 for 14 days · cancel any time
				</div>
			</section>
		</main>
	);
}
