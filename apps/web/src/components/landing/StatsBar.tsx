"use client";

import { useEffect, useState } from "react";

type Stats = { users: number; renders: number; messages: number };

function fmt(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return String(n);
}

export function StatsBar() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    fetch("/api/stats")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: Stats | null) => {
        if (data && (data.users > 0 || data.renders > 0)) setStats(data);
      })
      .catch(() => {});
  }, []);

  if (!stats) return null;

  const items = [
    { value: fmt(stats.users), label: "creators" },
    { value: fmt(stats.renders), label: "renders exported" },
    { value: fmt(stats.messages), label: "AI messages sent" },
  ];

  return (
    <section className="border-y border-[var(--color-border)] bg-[var(--color-surface)]/30">
      <div className="mx-auto grid max-w-3xl grid-cols-3 divide-x divide-[var(--color-border)] px-4 py-8 text-center sm:px-6">
        {items.map((item) => (
          <div key={item.label} className="px-4">
            <div className="text-2xl font-black tabular-nums text-[var(--color-fg)] sm:text-3xl">
              {item.value}+
            </div>
            <div className="mt-1 text-xs text-[var(--color-fg-muted)]">{item.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
