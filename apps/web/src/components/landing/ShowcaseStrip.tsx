"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type ShowcaseItem = { slug: string; projectName: string | null; thumbUrl: string };

/**
 * Real proof: a strip of actual renders users published to the showcase (from
 * /api/showcase). Renders nothing until there are real videos — never fabricated.
 */
export function ShowcaseStrip() {
  const [items, setItems] = useState<ShowcaseItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/showcase?limit=12")
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((data) => {
        const list = (data.entries ?? []) as ShowcaseItem[];
        if (!cancelled && Array.isArray(list)) setItems(list.filter((item) => item?.thumbUrl));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (items.length < 4) return null;

  return (
    <section className="border-b border-[var(--color-border)] bg-[var(--color-surface)]/30">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.15em] text-[var(--color-accent)]">
              Made with VibeEdit
            </p>
            <h2 className="text-[clamp(1.6rem,3.5vw,2.5rem)] font-bold tracking-tight">
              Real videos. Real prompts.
            </h2>
          </div>
          <Link
            href="/showcase"
            className="text-sm font-medium text-[var(--color-accent)] hover:underline"
          >
            See the showcase →
          </Link>
        </div>

        <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-3 sm:mx-0 sm:px-0">
          {items.slice(0, 12).map((item) => (
            <Link
              key={item.slug}
              href={`/showcase`}
              className="group relative aspect-[9/16] w-[150px] shrink-0 overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-2)] transition-colors hover:border-[var(--color-accent)]/50"
              title={item.projectName ?? "Made with VibeEdit"}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.thumbUrl}
                alt={item.projectName ?? ""}
                loading="lazy"
                className="h-full w-full object-cover transition-transform group-hover:scale-105"
              />
              <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/80 to-transparent px-2.5 pb-2 pt-6 text-[11px] font-medium text-white">
                {item.projectName ?? "Untitled"}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
