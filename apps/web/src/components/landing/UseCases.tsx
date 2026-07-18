import Link from "next/link";

type UseCase = { title: string; blurb: string; color: string; icon: React.ReactNode };

const USE_CASES: UseCase[] = [
  {
    title: "Content creators",
    blurb:
      "Turn long uploads, podcasts, and streams into scroll-stopping shorts — all by chatting.",
    color: "var(--color-cat-fx)",
    icon: (
      <path d="M15 10l4.55-2.28A1 1 0 0 1 21 8.62v6.76a1 1 0 0 1-1.45.9L15 14M4 6h9a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z" />
    ),
  },
  {
    title: "Agencies",
    blurb: "Produce on-brand client videos at scale — the brand kit keeps every cut consistent.",
    color: "var(--color-violet)",
    icon: (
      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M8.5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM20 8v6M23 11h-6" />
    ),
  },
  {
    title: "Marketers",
    blurb: "Spin up product demos, ads, and social clips from a sentence — no editor, no timeline.",
    color: "var(--color-cat-video)",
    icon: <path d="M3 3v18h18M18 17V9M13 17V5M8 17v-3" />,
  },
  {
    title: "Educators",
    blurb: "Cut lectures into tight explainers, add captions and lower-thirds by describing them.",
    color: "var(--color-cat-audio)",
    icon: <path d="M22 10v6M2 10l10-5 10 5-10 5z M6 12v5c3 3 9 3 12 0v-5" />,
  },
  {
    title: "Founders & teams",
    blurb:
      "Ship launch videos, updates, and demos in-house — no editor to hire, no skills to learn.",
    color: "var(--color-accent)",
    icon: (
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M12 3v18" />
    ),
  },
  {
    title: "Faceless channels",
    blurb:
      "Generate whole videos with no footage — titles, motion graphics, b-roll, voice, and music.",
    color: "var(--color-cat-image)",
    icon: (
      <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM2 12h20M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20z" />
    ),
  },
];

export function UseCases() {
  return (
    <section className="border-y border-[var(--color-border)] bg-[var(--color-surface)]/30">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
        <div className="mb-14 text-center">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.15em] text-[var(--color-accent)]">
            Who it's for
          </p>
          <h2 className="text-[clamp(1.8rem,4vw,3rem)] font-bold tracking-tight">
            One chat. Every kind of video.
          </h2>
          <p className="mx-auto mt-6 max-w-lg text-[1rem] leading-[1.8] text-[var(--color-fg-muted)]">
            Whether you're editing footage or building from scratch, VibeEdit removes the editing
            bottleneck so you can publish more.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {USE_CASES.map((useCase) => (
            <div
              key={useCase.title}
              className="group rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 transition-colors hover:border-[var(--color-border-2)]"
            >
              <div
                className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl transition-transform group-hover:scale-110"
                style={{ backgroundColor: `color-mix(in srgb, ${useCase.color} 15%, transparent)` }}
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={useCase.color}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  {useCase.icon}
                </svg>
              </div>
              <h3 className="text-lg font-bold text-[var(--color-fg)]">{useCase.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--color-fg-muted)]">
                {useCase.blurb}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-12 text-center">
          <Link
            href="/app/signup"
            className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-accent)] px-7 py-3.5 text-sm font-semibold text-black transition-all hover:-translate-y-0.5 hover:opacity-95"
          >
            Start your 7-day free trial →
          </Link>
        </div>
      </div>
    </section>
  );
}
