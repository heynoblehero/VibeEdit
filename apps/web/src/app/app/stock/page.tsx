"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import { Wordmark } from "@/components/Wordmark";

type Asset = {
  slug: string;
  kind: "sfx" | "broll" | "character";
  name: string;
  tags: string[];
  url: string;
  durationSeconds?: number;
  licence: string;
  credit?: string;
};

export default function StockPage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [all, setAll] = useState<Asset[]>([]);
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<"all" | "sfx" | "broll" | "character">("all");

  useEffect(() => {
    if (!isPending && !session) router.replace("/app/login");
  }, [isPending, session, router]);

  useEffect(() => {
    fetch("/api/stock")
      .then((r) => r.json())
      .then((j) => setAll(j.assets || []));
  }, []);

  const visible = useMemo(() => {
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return all
      .filter((a) => (kind === "all" ? true : a.kind === kind))
      .filter((a) => {
        if (terms.length === 0) return true;
        const hay = (a.name + " " + a.tags.join(" ")).toLowerCase();
        return terms.every((t) => hay.includes(t));
      });
  }, [all, query, kind]);

  if (isPending || !session) return null;

  return (
    <main className="mx-auto max-w-6xl p-4 sm:p-8">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-3 sm:mb-10">
        <Link href="/app/projects">
          <Wordmark size="md" />
        </Link>
        <nav className="flex flex-wrap gap-3 text-sm">
          <Link
            href="/app/projects"
            className="text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
          >
            Projects
          </Link>
          <Link href="/app/stock" className="text-[var(--color-accent)]">
            Stock
          </Link>
        </nav>
      </header>

      <h1 className="mb-2 text-2xl font-bold sm:text-3xl">Stock library</h1>
      <p className="mb-6 max-w-2xl text-[var(--color-fg-muted)]">
        CC0 SFX, royalty-free B-roll, and self-created host illustrations the agent can pull from
        automatically. Just say "use the dramatic riser" or "pull a glitch overlay" in chat.
      </p>

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search 'riser', 'particles', 'narrator'..."
          className="w-full flex-1 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 outline-none focus:border-[var(--color-accent)] sm:w-auto sm:min-w-[260px]"
        />
        {(["all", "sfx", "broll", "character"] as const).map((k) => (
          <button
            key={k}
            onClick={() => setKind(k)}
            className={`rounded-md px-3 py-2 text-sm ${
              kind === k
                ? "bg-[var(--color-accent)] text-black"
                : "border border-[var(--color-border)] hover:bg-[var(--color-surface)]"
            }`}
          >
            {k.toUpperCase()}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {visible.map((a) => (
          <AssetCard key={a.slug} asset={a} />
        ))}
        {visible.length === 0 && (
          <div className="col-span-full rounded-lg border border-dashed border-[var(--color-border)] p-8 text-center text-sm text-[var(--color-fg-muted)]">
            No matches.
          </div>
        )}
      </div>
    </main>
  );
}

function AssetCard({ asset }: { asset: Asset }) {
  return (
    <div className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
      <div className="flex h-32 items-center justify-center bg-[var(--color-bg-2)] text-3xl">
        {asset.kind === "sfx" && "♫"}
        {asset.kind === "broll" && "🎞"}
        {asset.kind === "character" && "🧍"}
      </div>
      <div className="p-3">
        <div className="mb-1 flex items-baseline justify-between">
          <h3 className="font-semibold text-sm">{asset.name}</h3>
          {asset.durationSeconds && (
            <span className="text-[10px] text-[var(--color-fg-muted)]">
              {asset.durationSeconds}s
            </span>
          )}
        </div>
        <div className="mb-2 font-mono text-[10px] text-[var(--color-fg-muted)]">{asset.slug}</div>
        <div className="mb-2 flex flex-wrap gap-1">
          {asset.tags.slice(0, 4).map((t) => (
            <span
              key={t}
              className="rounded bg-[var(--color-bg)] px-1.5 py-0.5 text-[10px] text-[var(--color-fg-muted)]"
            >
              {t}
            </span>
          ))}
        </div>
        <div className="text-[10px] text-[var(--color-fg-muted)]">
          {asset.licence}
          {asset.credit && ` · ${asset.credit}`}
        </div>
      </div>
    </div>
  );
}
