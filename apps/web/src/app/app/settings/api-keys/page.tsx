"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import { Wordmark } from "@/components/Wordmark";
import { useToast } from "@/components/Toast";
import {
  PROVIDERS,
  type ProviderId,
  getApiKey,
  setApiKey,
  clearApiKey,
  maskKey,
  onKeysChanged,
} from "@/lib/api-keys/store";

type FormState = Record<ProviderId, string>;

type TestState = {
  status: "idle" | "testing" | "ok" | "error";
  detail?: string;
  error?: string;
};

function providerName(id: ProviderId): string {
  return PROVIDERS.find((p) => p.id === id)?.name ?? "Provider";
}

export default function ApiKeysSettingsPage() {
  const router = useRouter();
  const toast = useToast();
  const { data: session, isPending } = useSession();
  const [drafts, setDrafts] = useState<FormState>(emptyForm());
  const [editing, setEditing] = useState<Record<ProviderId, boolean>>(emptyBoolForm());
  const [saved, setSaved] = useState<Record<ProviderId, string | null>>(emptyStringForm());
  const [testStates, setTestStates] = useState<Record<ProviderId, TestState>>(emptyTestForm());

  useEffect(() => {
    if (!isPending && !session) router.replace("/app/login");
  }, [isPending, session, router]);

  useEffect(() => {
    const refresh = () => {
      const next: Record<ProviderId, string | null> = emptyStringForm();
      for (const provider of PROVIDERS) next[provider.id] = getApiKey(provider.id);
      setSaved(next);
    };
    refresh();
    const off = onKeysChanged(refresh);
    return off;
  }, []);

  if (isPending || !session) return null;

  function save(id: ProviderId) {
    const value = drafts[id]?.trim();
    if (!value) return;
    try {
      setApiKey(id, value);
      setDrafts((current) => ({ ...current, [id]: "" }));
      setEditing((current) => ({ ...current, [id]: false }));
      toast.success(`${providerName(id)} key saved in this browser`);
    } catch {
      toast.error("Couldn't save the key — your browser may be blocking storage.");
    }
  }

  function clear(id: ProviderId) {
    clearApiKey(id);
    setDrafts((current) => ({ ...current, [id]: "" }));
    setEditing((current) => ({ ...current, [id]: false }));
    setTestStates((current) => ({ ...current, [id]: { status: "idle" } }));
    toast.info(`${providerName(id)} key removed`);
  }

  async function test(id: ProviderId) {
    // Test the saved key, falling back to the draft input if there's no
    // saved key yet (so users can verify a key before committing it).
    const apiKey = getApiKey(id) || drafts[id]?.trim();
    if (!apiKey) {
      setTestStates((current) => ({
        ...current,
        [id]: { status: "error", error: "no key to test" },
      }));
      return;
    }
    setTestStates((current) => ({
      ...current,
      [id]: { status: "testing" },
    }));
    try {
      const response = await fetch("/api/byok/test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ provider: id, apiKey }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        detail?: string;
        error?: string;
      };
      setTestStates((current) => ({
        ...current,
        [id]: data.ok
          ? { status: "ok", detail: data.detail }
          : { status: "error", error: data.error || "test failed" },
      }));
    } catch (caught) {
      setTestStates((current) => ({
        ...current,
        [id]: {
          status: "error",
          error: (caught as Error).message || "network error",
        },
      }));
    }
  }

  return (
    <main className="mx-auto max-w-3xl p-4 sm:p-8">
      <header className="md:hidden mb-8 flex flex-wrap items-center justify-between gap-3">
        <Link href="/app/projects">
          <Wordmark size="md" />
        </Link>
        <nav aria-label="Settings" className="flex flex-wrap gap-3 text-sm">
          <Link
            href="/app/settings/brand"
            className="text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
          >
            Brand
          </Link>
          <Link
            href="/app/settings/api-keys"
            aria-current="page"
            className="text-[var(--color-accent)]"
          >
            API keys
          </Link>
          <Link
            href="/app/settings/account"
            className="text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
          >
            Account
          </Link>
        </nav>
      </header>

      <h1 className="mb-2 text-2xl font-bold sm:text-3xl">API keys</h1>
      <p className="mb-6 max-w-2xl text-sm text-[var(--color-fg-muted)]">
        Paste your own keys to unlock image / video / voice generation inside the chat. Keys stay in{" "}
        <strong>this browser only</strong> — they never touch our database. The chat attaches them
        to each request and the server forwards directly to the provider.
      </p>

      <div className="mb-6 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-2)] p-3 text-xs text-[var(--color-fg-muted)]">
        ⚠ Re-paste keys on each new device or browser. Clearing site data wipes them.
      </div>

      <section className="space-y-3">
        {PROVIDERS.map((provider) => {
          const isSet = !!saved[provider.id];
          const isEditingKey = editing[provider.id];
          return (
            <div
              key={provider.id}
              className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-semibold text-[var(--color-fg)]">
                      {provider.name}
                    </h2>
                    {isSet && (
                      <span className="rounded-full bg-[var(--color-success)]/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-success)]">
                        Connected
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-[var(--color-fg-muted)]">
                    {provider.description}
                  </p>
                </div>
                <a
                  href={provider.getKeyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-[var(--color-fg-muted)] underline hover:text-[var(--color-fg)]"
                >
                  Get key ↗
                </a>
              </div>

              <div className="mt-3">
                {isSet && !isEditingKey ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <code className="flex-1 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 font-mono text-xs text-[var(--color-fg-muted)]">
                      {maskKey(saved[provider.id])}
                    </code>
                    <button
                      onClick={() => test(provider.id)}
                      disabled={testStates[provider.id].status === "testing"}
                      className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-2)] px-3 py-2 text-xs text-[var(--color-fg)] hover:border-[var(--color-accent)] disabled:opacity-50"
                    >
                      {testStates[provider.id].status === "testing" ? "Testing…" : "Test"}
                    </button>
                    <button
                      onClick={() =>
                        setEditing((current) => ({
                          ...current,
                          [provider.id]: true,
                        }))
                      }
                      className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-2)] px-3 py-2 text-xs text-[var(--color-fg)] hover:border-[var(--color-fg-muted)]"
                    >
                      Replace
                    </button>
                    <button
                      onClick={() => clear(provider.id)}
                      className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-2)] px-3 py-2 text-xs text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input
                      type="password"
                      value={drafts[provider.id] || ""}
                      onChange={(event) =>
                        setDrafts((current) => ({
                          ...current,
                          [provider.id]: event.target.value,
                        }))
                      }
                      placeholder={provider.placeholder}
                      className="flex-1 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 font-mono text-xs outline-none focus:border-[var(--color-accent)]"
                    />
                    <button
                      onClick={() => test(provider.id)}
                      disabled={
                        !drafts[provider.id]?.trim() || testStates[provider.id].status === "testing"
                      }
                      className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-2)] px-4 py-2 text-xs text-[var(--color-fg)] hover:border-[var(--color-accent)] disabled:opacity-50"
                    >
                      {testStates[provider.id].status === "testing" ? "Testing…" : "Test"}
                    </button>
                    <button
                      onClick={() => save(provider.id)}
                      disabled={!drafts[provider.id]?.trim()}
                      className="rounded-md bg-[var(--color-accent)] px-4 py-2 text-xs font-semibold text-black hover:opacity-90 disabled:opacity-50"
                    >
                      Save
                    </button>
                    {isSet && (
                      <button
                        onClick={() =>
                          setEditing((current) => ({
                            ...current,
                            [provider.id]: false,
                          }))
                        }
                        className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-2)] px-3 py-2 text-xs text-[var(--color-fg)] hover:border-[var(--color-fg-muted)]"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                )}
                <TestResult state={testStates[provider.id]} />
              </div>
            </div>
          );
        })}
      </section>

      <section className="mt-8 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:p-5">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-[var(--color-fg-muted)]">
          How the agent uses these
        </h2>
        <ol className="space-y-2 text-sm text-[var(--color-fg)]">
          <li>
            <span className="font-semibold">1.</span> You ask the agent in chat:{" "}
            <em>"generate 4 background options for scene 2"</em>.
          </li>
          <li>
            <span className="font-semibold">2.</span> The agent calls Replicate with your key, saves
            the variants to{" "}
            <code className="rounded bg-[var(--color-bg)] px-1 text-xs">assets/variants/</code>.
          </li>
          <li>
            <span className="font-semibold">3.</span> The chat shows you a thumbnail grid. Click the
            winner — it becomes the scene's background, the rest stay as alternates.
          </li>
        </ol>
      </section>
    </main>
  );
}

function emptyForm(): FormState {
  const out: Partial<FormState> = {};
  for (const provider of PROVIDERS) out[provider.id] = "";
  return out as FormState;
}

function emptyBoolForm(): Record<ProviderId, boolean> {
  const out: Partial<Record<ProviderId, boolean>> = {};
  for (const provider of PROVIDERS) out[provider.id] = false;
  return out as Record<ProviderId, boolean>;
}

function emptyStringForm(): Record<ProviderId, string | null> {
  const out: Partial<Record<ProviderId, string | null>> = {};
  for (const provider of PROVIDERS) out[provider.id] = null;
  return out as Record<ProviderId, string | null>;
}

function emptyTestForm(): Record<ProviderId, TestState> {
  const out: Partial<Record<ProviderId, TestState>> = {};
  for (const provider of PROVIDERS) out[provider.id] = { status: "idle" };
  return out as Record<ProviderId, TestState>;
}

function TestResult({ state }: { state: TestState }) {
  if (state.status === "idle") return null;
  if (state.status === "testing") {
    return (
      <div className="mt-2 flex items-center gap-1.5 text-[11px] text-[var(--color-fg-muted)]">
        <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--color-accent)]" />
        Pinging provider…
      </div>
    );
  }
  if (state.status === "ok") {
    return (
      <div className="mt-2 flex items-center gap-1.5 text-[11px] text-[var(--color-success)]">
        <span>✓ Connected</span>
        {state.detail && <span className="text-[var(--color-fg-muted)]">· {state.detail}</span>}
      </div>
    );
  }
  return (
    <div className="mt-2 text-[11px] text-[var(--color-danger)]">
      ✗ {state.error || "test failed"}
    </div>
  );
}
