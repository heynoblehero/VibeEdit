"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  PROVIDERS,
  type ProviderId,
  getApiKey,
  setApiKey,
  clearApiKey,
  maskKey,
  onKeysChanged,
} from "@/lib/api-keys/store";
import { BrandSection } from "./BrandSection";
import { AccountSection } from "./AccountSection";
import { ExtensionSection } from "./ExtensionSection";

type Tab = "account" | "brand" | "keys" | "extension" | "billing";

const TABS: Array<{ id: Tab; label: string; icon: React.ReactNode }> = [
  { id: "account", label: "Account", icon: <span aria-hidden="true">👤</span> },
  { id: "brand", label: "Brand kit", icon: <span aria-hidden="true">🎨</span> },
  { id: "keys", label: "API keys", icon: <span aria-hidden="true">🔑</span> },
  { id: "extension", label: "Extension", icon: <span aria-hidden="true">🧩</span> },
  { id: "billing", label: "Billing", icon: <span aria-hidden="true">💳</span> },
];

/**
 * The tabbed settings content, used by the /app/settings page. Sections render
 * inline (billing links out — it's Polar-heavy). Left-nav on desktop, a
 * horizontal scroller on mobile.
 */
export function SettingsPanel({ initialTab = "account" }: { initialTab?: Tab }) {
  const [tab, setTab] = useState<Tab>(initialTab);

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] sm:flex-row">
      {/* Nav — sidebar on desktop, scroller on mobile */}
      <nav className="flex shrink-0 gap-1 overflow-x-auto border-b border-[var(--color-border)] bg-[var(--color-bg-2)] p-2 sm:w-48 sm:flex-col sm:overflow-visible sm:border-b-0 sm:border-r">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
              tab === item.id
                ? "bg-[var(--color-accent)]/12 font-medium text-[var(--color-fg)]"
                : "text-[var(--color-fg-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-fg)]"
            }`}
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </nav>

      <div className="min-w-0 flex-1 p-5 sm:p-6">
        {tab === "account" ? (
          <AccountSection />
        ) : tab === "brand" ? (
          <BrandSection />
        ) : tab === "keys" ? (
          <ApiKeysSection />
        ) : tab === "extension" ? (
          <ExtensionSection />
        ) : (
          <BillingLink />
        )}
      </div>
    </div>
  );
}

function BillingLink() {
  return (
    <div className="flex flex-col items-start gap-4">
      <p className="text-sm leading-relaxed text-[var(--color-fg-muted)]">
        Your plan, credits (edits · renders · storage), and payment method live on the billing page.
      </p>
      <Link
        href="/app/billing"
        className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-black transition-opacity hover:opacity-90"
      >
        Open billing →
      </Link>
    </div>
  );
}

/* ── API keys (inline, browser-local) ─────────────────────────────────────── */
function ApiKeysSection() {
  const [saved, setSaved] = useState<Record<string, string | null>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    const refresh = () => {
      const next: Record<string, string | null> = {};
      for (const provider of PROVIDERS) next[provider.id] = getApiKey(provider.id);
      setSaved(next);
    };
    refresh();
    return onKeysChanged(refresh);
  }, []);

  function save(id: ProviderId) {
    const value = drafts[id]?.trim();
    if (!value) return;
    setApiKey(id, value);
    setDrafts((current) => ({ ...current, [id]: "" }));
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--color-fg-muted)]">
        Paste your own keys to unlock image / video / voice generation. Keys stay in{" "}
        <strong className="text-[var(--color-fg)]">this browser only</strong> — they never touch our
        database. Chat, editing, and renders work without them.
      </p>

      {PROVIDERS.map((provider) => {
        const isSet = !!saved[provider.id];
        return (
          <div
            key={provider.id}
            className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-2)] p-4"
          >
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="font-medium text-[var(--color-fg)]">{provider.name}</span>
              {isSet ? (
                <span className="rounded-full bg-[var(--color-success)]/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-[var(--color-success)]">
                  Connected
                </span>
              ) : (
                <a
                  href={provider.getKeyUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-[var(--color-accent)] hover:underline"
                >
                  Get a key →
                </a>
              )}
            </div>
            <p className="mb-3 text-xs text-[var(--color-fg-muted)]">{provider.description}</p>

            {isSet ? (
              <div className="flex items-center gap-2">
                <code className="flex-1 truncate rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 font-mono text-xs text-[var(--color-fg-muted)]">
                  {maskKey(saved[provider.id] ?? "")}
                </code>
                <button
                  type="button"
                  onClick={() => clearApiKey(provider.id)}
                  className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-xs font-medium text-[var(--color-danger)] transition-colors hover:border-[var(--color-danger)]/50"
                >
                  Remove
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  type="password"
                  value={drafts[provider.id] ?? ""}
                  onChange={(event) =>
                    setDrafts((current) => ({ ...current, [provider.id]: event.target.value }))
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter") save(provider.id);
                  }}
                  placeholder={provider.keyPrefix ? `${provider.keyPrefix}…` : "Paste your key…"}
                  className="flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm outline-none placeholder:text-[var(--color-fg-subtle)] focus:border-[var(--color-accent)]"
                />
                <button
                  type="button"
                  onClick={() => save(provider.id)}
                  disabled={!drafts[provider.id]?.trim()}
                  className="rounded-lg bg-[var(--color-accent)] px-3 py-2 text-xs font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-40"
                >
                  Save
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
