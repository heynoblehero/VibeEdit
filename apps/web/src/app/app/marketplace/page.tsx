"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import Link from "next/link";

type Template = {
  id: string;
  label: string;
  description: string | null;
  platform: string | null;
  aspectRatio: string | null;
  likesCount: number;
  authorName: string;
  createdAt: string;
};

const PLATFORM_FILTERS = [
  { value: "", label: "All" },
  { value: "youtube", label: "YouTube" },
  { value: "tiktok", label: "TikTok / Shorts" },
  { value: "instagram", label: "Instagram" },
  { value: "linkedin", label: "LinkedIn" },
];

export default function MarketplacePage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [platform, setPlatform] = useState("");
  const [_cursor, setCursor] = useState(0);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [forking, setForking] = useState<string | null>(null);
  const [liking, setLiking] = useState<string | null>(null);

  useEffect(() => {
    if (!isPending && !session) router.replace("/app/login");
  }, [isPending, session, router]);

  async function load(p: string, c: number, append = false) {
    setLoading(true);
    const params = new URLSearchParams();
    if (p) params.set("platform", p);
    params.set("cursor", String(c));
    const res = await fetch(`/api/marketplace?${params}`);
    if (!res.ok) return;
    const data = (await res.json()) as { templates: Template[]; nextCursor: number | null };
    setTemplates((prev) => (append ? [...prev, ...data.templates] : data.templates));
    setNextCursor(data.nextCursor);
    setLoading(false);
  }

  useEffect(() => {
    if (session) load(platform, 0);
  }, [session, platform]);

  function changePlatform(p: string) {
    setPlatform(p);
    setCursor(0);
  }

  async function fork(template: Template) {
    if (forking) return;
    setForking(template.id);
    try {
      const res = await fetch(`/api/snippets/${template.id}/fork`, { method: "POST" });
      if (!res.ok) return;
      const data = (await res.json()) as { id: string };
      router.push(`/app/projects/${data.id}/edit`);
    } finally {
      setForking(null);
    }
  }

  async function like(template: Template) {
    if (liking || !session) return;
    setLiking(template.id);
    await fetch("/api/marketplace", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ snippetId: template.id, action: "like" }),
    });
    setTemplates((prev) =>
      prev.map((t) => (t.id === template.id ? { ...t, likesCount: t.likesCount + 1 } : t)),
    );
    setLiking(null);
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      {/* Header */}
      <div className="border-b border-[var(--color-border)] bg-[var(--color-bg)]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <div>
            <h1 className="text-lg font-semibold text-[var(--color-fg)]">Template Marketplace</h1>
            <p className="mt-0.5 text-sm text-[var(--color-fg-muted)]">
              Community compositions — fork to use as a starting point
            </p>
          </div>
          <Link href="/app/projects" className="text-sm text-[var(--color-accent)] hover:underline">
            ← My projects
          </Link>
        </div>

        {/* Platform filter */}
        <div className="mx-auto max-w-6xl px-4 pb-3 sm:px-6">
          <div className="flex gap-1.5">
            {PLATFORM_FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => changePlatform(f.value)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  platform === f.value
                    ? "bg-[var(--color-accent)] text-black"
                    : "bg-[var(--color-surface)] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        {loading && templates.length === 0 ? (
          <div className="flex items-center justify-center py-24 text-sm text-[var(--color-fg-muted)]">
            <span className="mr-2 inline-block h-2 w-2 animate-pulse rounded-full bg-[var(--color-accent)]" />
            Loading…
          </div>
        ) : templates.length === 0 ? (
          <div className="py-24 text-center text-sm text-[var(--color-fg-muted)]">
            No public templates yet.{" "}
            <Link href="/app/snippets" className="text-[var(--color-accent)] hover:underline">
              Share yours →
            </Link>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {templates.map((t) => (
                <div
                  key={t.id}
                  className="flex flex-col rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 transition-shadow hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-[var(--color-fg)]">{t.label}</p>
                      <p className="mt-0.5 text-xs text-[var(--color-fg-muted)]">
                        by {t.authorName}
                        {t.platform && (
                          <span className="ml-2 rounded bg-[var(--color-border)] px-1.5 py-0.5 font-mono text-[10px]">
                            {t.aspectRatio}
                          </span>
                        )}
                      </p>
                    </div>
                    <button
                      onClick={() => like(t)}
                      disabled={!!liking}
                      className="flex shrink-0 items-center gap-1 rounded-full border border-[var(--color-border)] px-2 py-1 text-xs text-[var(--color-fg-muted)] transition-colors hover:border-red-400 hover:text-red-400"
                      title="Like"
                    >
                      ♥ {t.likesCount}
                    </button>
                  </div>
                  {t.description && (
                    <p className="mt-2 text-xs text-[var(--color-fg-muted)] line-clamp-2">
                      {t.description}
                    </p>
                  )}
                  <button
                    onClick={() => fork(t)}
                    disabled={forking === t.id}
                    className="mt-4 w-full rounded-md bg-[var(--color-accent)] px-3 py-1.5 text-xs font-semibold text-black hover:opacity-90 disabled:opacity-50"
                  >
                    {forking === t.id ? "Forking…" : "Fork & edit"}
                  </button>
                </div>
              ))}
            </div>

            {nextCursor !== null && (
              <div className="mt-8 flex justify-center">
                <button
                  onClick={() => {
                    setCursor(nextCursor);
                    load(platform, nextCursor, true);
                  }}
                  disabled={loading}
                  className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] disabled:opacity-50"
                >
                  {loading ? "Loading…" : "Load more"}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
