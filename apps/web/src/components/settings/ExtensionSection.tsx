"use client";

import { useEffect, useState } from "react";
import { useSession } from "@/lib/auth-client";
import { useToast } from "@/components/Toast";
import { ConnectExtension } from "@/components/ConnectExtension";

type TokenRow = {
  token: string; // masked
  name: string;
  lastSeenAt: string | null;
  createdAt: string;
};

/**
 * Browser-extension settings rendered inline in the Settings modal. Same
 * data/logic as the /app/settings/extension page, minus the page chrome
 * (wordmark header, nav, auth redirect) so it fits inside the modal panel.
 */
export function ExtensionSection() {
  const toast = useToast();
  const { data: session, isPending } = useSession();
  const [tokens, setTokens] = useState<TokenRow[]>([]);
  const [freshToken, setFreshToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const response = await fetch("/api/extension-tokens");
    if (response.ok) setTokens(((await response.json()).tokens as TokenRow[]) || []);
  }

  useEffect(() => {
    if (session) refresh();
  }, [session]);

  async function mint() {
    setBusy(true);
    try {
      const response = await fetch("/api/extension-tokens", { method: "POST" });
      if (!response.ok) {
        toast.error("Couldn't create a token.");
        return;
      }
      const data = (await response.json()) as { token: string };
      setFreshToken(data.token);
      refresh();
    } finally {
      setBusy(false);
    }
  }

  async function revoke(masked: string) {
    // The DELETE endpoint matches by a unique prefix; the visible prefix (before
    // the ellipsis) is long enough to be unique.
    const prefix = masked.split("…")[0];
    if (!confirm("Revoke this extension token? The browser using it will stop working.")) return;
    await fetch(`/api/extension-tokens?prefix=${encodeURIComponent(prefix)}`, { method: "DELETE" });
    refresh();
  }

  if (isPending || !session) {
    return <p className="text-sm text-[var(--color-fg-muted)]">Loading…</p>;
  }

  return (
    <div>
      <p className="mb-4 text-sm text-[var(--color-fg-muted)]">
        Install the VibeEdit browser extension, then click connect below — we hand it a token
        automatically, no copy/paste. On any video page, the extension can send a clip straight to
        your reference library or a project.
      </p>

      {/* One-click connect + live confirmation (also reflected in the extension). */}
      <div className="mb-6 max-w-md">
        <ConnectExtension prominent />
      </div>

      <button
        type="button"
        onClick={mint}
        disabled={busy}
        className="mb-6 rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-black disabled:opacity-50"
      >
        {busy ? "Creating…" : "Create connection token"}
      </button>

      {freshToken && (
        <div className="mb-6 rounded-xl border border-[var(--color-accent)]/40 bg-[var(--color-accent)]/8 p-4">
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--color-accent)]">
            Copy this now — it won't be shown again
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 break-all rounded bg-[var(--color-bg)] px-2 py-1.5 text-xs text-[var(--color-fg)]">
              {freshToken}
            </code>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(freshToken);
                toast.success("Copied.");
              }}
              className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium"
            >
              Copy
            </button>
          </div>
        </div>
      )}

      <section className="space-y-3">
        {tokens.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--color-border)] p-6 text-center text-sm text-[var(--color-fg-muted)]">
            No tokens yet.
          </div>
        ) : (
          tokens.map((row) => (
            <div
              key={row.token}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-2)] p-4"
            >
              <div className="min-w-0">
                <div className="font-medium text-[var(--color-fg)]">{row.name}</div>
                <div className="mt-0.5 flex items-center gap-2 text-xs text-[var(--color-fg-muted)]">
                  <code>{row.token}</code>
                  <span>·</span>
                  <span>
                    {row.lastSeenAt
                      ? `last used ${new Date(row.lastSeenAt).toLocaleDateString()}`
                      : "never used"}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => revoke(row.token)}
                className="shrink-0 text-xs text-[var(--color-fg-subtle)] hover:text-[var(--color-danger)]"
              >
                Revoke
              </button>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
