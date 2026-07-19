"use client";

import { useEffect, useRef, useState } from "react";

type Stats = { users: number; renders: number; messages: number };

function fmt(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return String(Math.round(n));
}

// Animate 0 → target with an ease-out once triggered.
function useCountUp(target: number, run: boolean, durationMs = 1300): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!run) {
      setValue(0);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(target * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, run, durationMs]);
  return value;
}

function StatItem({ target, label, run }: { target: number; label: string; run: boolean }) {
  const value = useCountUp(target, run);
  return (
    <div className="px-4">
      <div className="bg-gradient-to-b from-[var(--color-fg)] to-[var(--color-fg-muted)] bg-clip-text text-4xl font-black tabular-nums text-transparent sm:text-5xl">
        {fmt(value)}+
      </div>
      <div className="mt-2 text-sm font-medium text-[var(--color-fg-muted)]">{label}</div>
    </div>
  );
}

export function StatsBar() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [inView, setInView] = useState(false);
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    fetch("/api/stats")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: Stats | null) => {
        if (data && (data.users > 0 || data.renders > 0)) setStats(data);
      })
      .catch(() => {});
  }, []);

  // Kick the count-up off when the bar scrolls into view.
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setInView(true);
      },
      { threshold: 0.4 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [stats]);

  if (!stats) return null;

  const items = [
    { target: stats.users, label: "creators" },
    { target: stats.renders, label: "renders exported" },
    { target: stats.messages, label: "AI messages sent" },
  ];

  return (
    <section
      ref={ref}
      className="border-y border-[var(--color-border)] bg-[var(--color-surface)]/30"
    >
      <div className="mx-auto grid max-w-3xl grid-cols-3 divide-x divide-[var(--color-border)] px-4 py-12 text-center sm:px-6">
        {items.map((item) => (
          <StatItem key={item.label} target={item.target} label={item.label} run={inView} />
        ))}
      </div>
    </section>
  );
}
