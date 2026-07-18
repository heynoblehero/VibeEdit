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

type Tab = "keys" | "brand" | "account" | "extension" | "billing";

const TABS: Array<{ id: Tab; label: string; icon: React.ReactNode }> = [
  { id: "keys", label: "API keys", icon: <span aria-hidden="true">🔑</span> },
  { id: "brand", label: "Brand kit", icon: <span aria-hidden="true">🎨</span> },
  { id: "account", label: "Account", icon: <span aria-hidden="true">👤</span> },
  { id: "extension", label: "Extension", icon: <span aria-hidden="true">🧩</span> },
  { id: "billing", label: "Billing", icon: <span aria-hidden="true">💳</span> },
];

/**
 * One Settings surface, opened from anywhere via the account menu, instead of a
 * scatter of separate /app/settings/* pages. The API-keys section (the one most
 * touched now that generation is BYOK) is inline; the others link out to their
 * full pages for now.
 */
export function SettingsModal({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<Tab>("keys");

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm"
    >
      <div
        onClick={(event) => event.stopPropagation()}
        className="flex h-[600px] max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl"
      >
        {/* Left nav */}
        <nav className="flex w-44 shrink-0 flex-col gap-0.5 border-r border-[var(--color-border)] bg-[var(--color-bg-2)] p-2">
          <div className="px-2 py-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-fg-subtle)]">
            Settings
          </div>
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors ${
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

        {/* Content */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-3.5">
            <h2 className="font-semibold text-[var(--color-fg)]">
              {TABS.find((t) => t.id === tab)?.label}
            </h2>
            <button
              onClick={onClose}
              title="Close (Esc)"
              className="rounded-lg px-2 py-1 text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
            >
              ✕
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-5">
            {tab === "keys" ? <ApiKeysSection /> : <LinkOut tab={tab} onClose={onClose} />}
          </div>
        </div>
      </div>
    </div>
  );
}

const LINK_TARGETS: Record<Exclude<Tab, "keys">, { href: string; blurb: string }> = {
  brand: {
    href: "/app/settings/brand",
    blurb:
      "Your logo, primary color, fonts, and tone — the AI applies these to every video automatically so your content stays on-brand.",
  },
  account: {
    href: "/app/settings/account",
    blurb: "Your name, email, password, and account data.",
  },
  extension: {
    href: "/app/settings/extension",
    blurb: "Connect the Chrome extension to import clips from the web.",
  },
  billing: {
    href: "/app/billing",
    blurb: "Your plan, credits (edits · renders · storage), and payment method.",
  },
};

function LinkOut({ tab, onClose }: { tab: Exclude<Tab, "keys">; onClose: () => void }) {
  const target = LINK_TARGETS[tab];
  return (
    <div className="flex flex-col items-start gap-4">
      <p className="text-sm leading-relaxed text-[var(--color-fg-muted)]">{target.blurb}</p>
      <Link
        href={target.href}
        onClick={onClose}
        className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-black transition-opacity hover:opacity-90"
      >
        Open {TABS.find((t) => t.id === tab)?.label} →
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
