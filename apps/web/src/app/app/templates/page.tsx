"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import { Wordmark } from "@/components/Wordmark";

type Template = {
  slug: string;
  name: string;
  niche: string;
  ratio: "16:9" | "9:16";
  durationSeconds: number;
  description: string;
  accent: string;
};

export default function TemplatesPage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [creating, setCreating] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "16:9" | "9:16">("all");

  useEffect(() => {
    if (!isPending && !session) router.replace("/app/login");
  }, [isPending, session, router]);

  useEffect(() => {
    fetch("/api/templates")
      .then((r) => r.json())
      .then((j) => setTemplates(j.templates || []))
      .finally(() => setTemplatesLoading(false));
  }, []);

  async function startFrom(slug: string) {
    setCreating(slug);
    const result = await fetch("/api/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ template: slug }),
    });
    setCreating(null);
    if (!result.ok) return;
    const { id } = (await result.json()) as { id: string };
    router.push(`/app/projects/${id}/edit`);
  }

  if (isPending || !session) {
    return (
      <main className="flex min-h-screen items-center justify-center text-[var(--color-fg-muted)]">
        Loading...
      </main>
    );
  }

  const visible = filter === "all" ? templates : templates.filter((t) => t.ratio === filter);

  return (
    <main className="mx-auto max-w-6xl p-4 sm:p-8">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-3 sm:mb-10">
        <Wordmark size="md" />
        <nav className="flex flex-wrap gap-3 text-sm">
          <Link
            href="/app/projects"
            className="text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
          >
            Projects
          </Link>
          <Link href="/app/templates" className="text-[var(--color-accent)]">
            Templates
          </Link>
        </nav>
      </header>

      <h1 className="mb-3 text-2xl font-bold sm:text-3xl">Templates</h1>
      <p className="mb-8 max-w-2xl text-[var(--color-fg-muted)]">
        Fork a starter and chat-edit your way to a finished video. Every template is a real
        composition — open it and prompt the agent for changes.
      </p>

      <div className="mb-8 flex gap-2 text-sm">
        {(["all", "16:9", "9:16"] as const).map((value) => (
          <button
            key={value}
            onClick={() => setFilter(value)}
            className={`rounded-md px-3 py-1 ${
              filter === value
                ? "bg-[var(--color-accent)] text-black"
                : "border border-[var(--color-border)] text-[var(--color-fg-muted)] hover:bg-[var(--color-surface)]"
            }`}
          >
            {value === "all" ? "All formats" : value}
          </button>
        ))}
      </div>

      {templatesLoading ? (
        <TemplatesSkeleton />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {visible.map((t) => (
            <TemplateCard
              key={t.slug}
              template={t}
              creating={creating === t.slug}
              onStart={() => startFrom(t.slug)}
            />
          ))}
        </div>
      )}
    </main>
  );
}

function TemplatesSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          key={index}
          className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]"
        >
          <div className="h-44 animate-pulse bg-[var(--color-bg-2)]" />
          <div className="p-4 space-y-2">
            <div className="h-4 w-1/2 animate-pulse rounded bg-[var(--color-bg-2)]" />
            <div className="h-3 w-3/4 animate-pulse rounded bg-[var(--color-bg-2)]" />
            <div className="h-8 w-full animate-pulse rounded-md bg-[var(--color-bg-2)]" />
          </div>
        </div>
      ))}
    </div>
  );
}

function TemplateCard({
  template,
  creating,
  onStart,
}: {
  template: Template;
  creating: boolean;
  onStart: () => void;
}) {
  const isVertical = template.ratio === "9:16";
  const accent = template.accent;
  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] transition-colors hover:border-[var(--color-accent)]/40">
      {/* Composition mockup preview */}
      <div
        className={`relative w-full overflow-hidden ${isVertical ? "h-72" : "h-44"}`}
        style={{ background: "linear-gradient(160deg, #0d0d0d 0%, #181818 100%)" }}
      >
        {/* Subtle grid */}
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage: `linear-gradient(${accent} 1px, transparent 1px), linear-gradient(90deg, ${accent} 1px, transparent 1px)`,
            backgroundSize: "28px 28px",
          }}
        />
        {/* Mock scene layout */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 px-6">
          <div className="h-3.5 w-3/4 rounded-sm" style={{ background: accent, opacity: 0.95 }} />
          <div className="h-2 w-1/2 rounded-sm" style={{ background: accent, opacity: 0.45 }} />
          <div className="mt-1 flex w-3/4 gap-1.5">
            <div className="h-7 flex-1 rounded-sm" style={{ background: `${accent}28` }} />
            <div className="h-7 flex-1 rounded-sm" style={{ background: `${accent}28` }} />
            <div className="h-7 flex-1 rounded-sm" style={{ background: `${accent}28` }} />
          </div>
          <div className="h-1.5 w-2/5 rounded-sm" style={{ background: accent, opacity: 0.25 }} />
        </div>
        {/* Ratio + duration badges */}
        <div
          className="absolute left-2.5 top-2.5 rounded px-1.5 py-0.5 font-mono text-[10px] font-bold"
          style={{
            background: `${accent}22`,
            color: accent,
            border: `1px solid ${accent}44`,
          }}
        >
          {template.ratio}
        </div>
        <div
          className="absolute bottom-2.5 right-2.5 font-mono text-[10px]"
          style={{ color: `${accent}88` }}
        >
          {template.durationSeconds}s
        </div>
      </div>
      <div className="p-4">
        <div className="mb-1 flex items-center justify-between">
          <h3 className="font-bold">{template.name}</h3>
          <span
            className="rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide"
            style={{ background: `${accent}18`, color: accent }}
          >
            {template.niche}
          </span>
        </div>
        <p className="mb-4 line-clamp-2 text-xs text-[var(--color-fg-muted)]">
          {template.description}
        </p>
        <button
          onClick={onStart}
          disabled={creating}
          className="w-full rounded-md bg-[var(--color-accent)] py-2 text-sm font-semibold text-black hover:opacity-90 disabled:opacity-50"
        >
          {creating ? "Creating…" : "Start from this"}
        </button>
      </div>
    </div>
  );
}
