"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Wordmark } from "@/components/Wordmark";

type Check = { ok: boolean; detail?: string };
type Health = {
  status: "ok" | "degraded";
  checks: Record<string, Check>;
  timestamp: string;
};

export default function StatusPage() {
  const [health, setHealth] = useState<Health | null>(null);
  const [lastChecked, setLastChecked] = useState<number>(0);

  async function refresh() {
    try {
      const r = await fetch("/api/health");
      const data = (await r.json()) as Health;
      setHealth(data);
      setLastChecked(Date.now());
    } catch {
      setHealth({
        status: "degraded",
        checks: { network: { ok: false, detail: "could not reach API" } },
        timestamp: new Date().toISOString(),
      });
    }
  }

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 30_000);
    return () => clearInterval(id);
  }, []);

  const overallOk = health?.status === "ok";

  return (
    <main className="mx-auto max-w-3xl p-4 sm:p-8">
      <header className="mb-8 flex items-center justify-between sm:mb-10">
        <Link href="/">
          <Wordmark size="md" />
        </Link>
        <span className="text-xs text-[var(--color-fg-muted)]">Auto-refresh · 30s</span>
      </header>

      <div
        className={`mb-8 rounded-2xl border p-6 sm:p-8 ${
          overallOk
            ? "border-[var(--color-success)] bg-[var(--color-success)]/10"
            : "border-[var(--color-danger)] bg-[var(--color-danger)]/10"
        }`}
      >
        <div className="mb-2 flex items-center gap-3">
          <span
            className={`inline-block h-3 w-3 rounded-full ${
              overallOk ? "bg-[var(--color-success)]" : "bg-[var(--color-danger)]"
            }`}
          />
          <h1 className="text-xl font-bold sm:text-2xl">
            {overallOk ? "All systems operational" : "Degraded service"}
          </h1>
        </div>
        {lastChecked > 0 && (
          <div className="text-sm text-[var(--color-fg-muted)]">
            Checked {new Date(lastChecked).toLocaleTimeString()}
          </div>
        )}
      </div>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[var(--color-fg-muted)]">
          Subsystems
        </h2>
        <ul className="space-y-2">
          {health &&
            Object.entries(health.checks).map(([name, check]) => (
              <li
                key={name}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`inline-block h-2 w-2 shrink-0 rounded-full ${
                      check.ok ? "bg-[var(--color-success)]" : "bg-[var(--color-danger)]"
                    }`}
                  />
                  <span className="font-medium">{name}</span>
                </div>
                <span className="text-xs text-[var(--color-fg-muted)]">{check.detail}</span>
              </li>
            ))}
        </ul>
      </section>
    </main>
  );
}
