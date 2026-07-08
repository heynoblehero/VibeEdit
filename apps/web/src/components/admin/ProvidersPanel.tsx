"use client";

// Admin dashboard: manage the platform-managed provider credential POOL
// (multiple ElevenLabs keys, proxy configs for Midjourney/Suno/etc.) and the
// editable generation pricing. Replaces per-user BYOK — the app rotates across
// these credentials at generation time.

import { useCallback, useEffect, useState } from "react";
import { PROVIDER_SETUP } from "@/lib/providers/setup-guides";

type ProviderMeta = { id: string; label: string; kind: "key" | "proxy" };
type Credential = {
  id: string;
  provider: string;
  kind: "key" | "proxy";
  label: string | null;
  endpoint: string | null;
  masked: string;
  enabled: boolean;
  priority: number;
  usageCount: number;
  lastUsedAt: string | null;
  disabledReason: string | null;
};
type Pricing = {
  creditsByPlan: { free: number; creator: number; pro: number; studio: number };
  costByTier: { 1: number; 2: number; 3: number };
};
type Data = { providers: ProviderMeta[]; credentials: Credential[]; pricing: Pricing };

export default function ProvidersPanel() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [testResult, setTestResult] = useState<Record<string, string>>({});

  // Add-form state
  const [provider, setProvider] = useState("elevenlabs");
  const [label, setLabel] = useState("");
  const [secret, setSecret] = useState("");
  const [endpoint, setEndpoint] = useState("");
  const [priority, setPriority] = useState(0);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/providers");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const post = useCallback(async (payload: Record<string, unknown>) => {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/providers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
      return await res.json();
    } finally {
      setBusy(false);
    }
  }, []);

  const currentMeta = data?.providers.find((p) => p.id === provider);
  const isProxy = currentMeta?.kind === "proxy";

  async function add() {
    if (!secret.trim()) return;
    await post({
      action: "create",
      provider,
      kind: currentMeta?.kind,
      label,
      secret,
      endpoint: isProxy ? endpoint : undefined,
      priority,
    });
    setSecret("");
    setLabel("");
    setEndpoint("");
    setPriority(0);
    await load();
  }

  async function toggle(c: Credential) {
    await post({ action: "update", id: c.id, enabled: !c.enabled });
    await load();
  }
  async function remove(id: string) {
    await post({ action: "delete", id });
    await load();
  }
  async function test(id: string) {
    setTestResult((r) => ({ ...r, [id]: "testing…" }));
    const res = await post({ action: "test", id });
    setTestResult((r) => ({ ...r, [id]: res.ok ? `✓ ${res.detail}` : `✗ ${res.error}` }));
  }

  if (error) return <p className="text-sm text-[var(--color-danger)]">Failed to load: {error}</p>;
  if (!data) return <p className="text-sm text-[var(--color-fg-muted)]">Loading…</p>;

  return (
    <div className="space-y-8">
      {/* Credential pool */}
      <section>
        <h2 className="mb-1 text-sm font-semibold text-[var(--color-fg)]">
          Provider keys &amp; proxies
        </h2>
        <p className="mb-3 text-xs text-[var(--color-fg-muted)]">
          The app rotates across enabled credentials per provider (spreads quota; auto-disables one
          that starts failing). Add multiple ElevenLabs keys to raise throughput.
        </p>

        <div className="overflow-x-auto rounded-lg border border-[var(--color-border)]">
          <table className="w-full text-sm">
            <thead className="bg-[var(--color-surface)] text-left text-[11px] uppercase tracking-wide text-[var(--color-fg-subtle)]">
              <tr>
                <th className="px-3 py-2">Provider</th>
                <th className="px-3 py-2">Label / endpoint</th>
                <th className="px-3 py-2">Secret</th>
                <th className="px-3 py-2">Prio</th>
                <th className="px-3 py-2">Used</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.credentials.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-[var(--color-fg-muted)]">
                    No credentials yet — add one below.
                  </td>
                </tr>
              )}
              {data.credentials.map((c) => (
                <tr key={c.id} className="border-t border-[var(--color-border)]">
                  <td className="px-3 py-2 font-medium">{c.provider}</td>
                  <td className="px-3 py-2 text-[var(--color-fg-muted)]">
                    {c.label || "—"}
                    {c.endpoint && <div className="text-[10px]">{c.endpoint}</div>}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{c.masked}</td>
                  <td className="px-3 py-2">{c.priority}</td>
                  <td className="px-3 py-2">{c.usageCount}</td>
                  <td className="px-3 py-2">
                    {c.enabled ? (
                      <span className="text-[var(--color-accent)]">enabled</span>
                    ) : (
                      <span className="text-[var(--color-danger)]">
                        off{c.disabledReason ? ` — ${c.disabledReason}` : ""}
                      </span>
                    )}
                    {testResult[c.id] && (
                      <div className="text-[10px] text-[var(--color-fg-muted)]">
                        {testResult[c.id]}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-2 text-xs">
                      <button onClick={() => test(c.id)} className="underline" disabled={busy}>
                        Test
                      </button>
                      <button onClick={() => toggle(c)} className="underline" disabled={busy}>
                        {c.enabled ? "Disable" : "Enable"}
                      </button>
                      <button
                        onClick={() => remove(c.id)}
                        className="text-[var(--color-danger)] underline"
                        disabled={busy}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Add form */}
        <div className="mt-4 flex flex-wrap items-end gap-2 rounded-lg border border-[var(--color-border)] p-3">
          <label className="flex flex-col text-[11px] text-[var(--color-fg-muted)]">
            Provider
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              className="mt-1 rounded border border-[var(--color-border)] bg-[var(--color-bg-2)] px-2 py-1.5 text-sm"
            >
              {data.providers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col text-[11px] text-[var(--color-fg-muted)]">
            Label (optional)
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. eleven key #2"
              className="mt-1 rounded border border-[var(--color-border)] bg-[var(--color-bg-2)] px-2 py-1.5 text-sm"
            />
          </label>
          {isProxy && (
            <label className="flex flex-col text-[11px] text-[var(--color-fg-muted)]">
              Proxy URL
              <input
                value={endpoint}
                onChange={(e) => setEndpoint(e.target.value)}
                placeholder="https://my-proxy.example.com"
                className="mt-1 w-64 rounded border border-[var(--color-border)] bg-[var(--color-bg-2)] px-2 py-1.5 text-sm"
              />
            </label>
          )}
          <label className="flex flex-col text-[11px] text-[var(--color-fg-muted)]">
            {isProxy ? "Secret / cookie" : "API key"}
            <input
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              type="password"
              placeholder="paste secret"
              className="mt-1 w-64 rounded border border-[var(--color-border)] bg-[var(--color-bg-2)] px-2 py-1.5 text-sm"
            />
          </label>
          <label className="flex flex-col text-[11px] text-[var(--color-fg-muted)]">
            Priority
            <input
              type="number"
              value={priority}
              onChange={(e) => setPriority(Number(e.target.value))}
              className="mt-1 w-20 rounded border border-[var(--color-border)] bg-[var(--color-bg-2)] px-2 py-1.5 text-sm"
            />
          </label>
          <button
            onClick={add}
            disabled={busy || !secret.trim() || (isProxy && !endpoint.trim())}
            className="rounded-lg bg-[var(--color-accent)] px-3 py-2 text-sm font-semibold text-black disabled:opacity-40"
          >
            Add
          </button>
        </div>

        {/* Setup guide for the currently-selected provider */}
        <SetupGuide provider={provider} label={currentMeta?.label ?? provider} />
      </section>

      {/* Pricing */}
      <PricingEditor
        pricing={data.pricing}
        onSave={(p) => post({ action: "pricing", pricing: p }).then(load)}
        busy={busy}
      />
    </div>
  );
}

function SetupGuide({ provider, label }: { provider: string; label: string }) {
  const guide = PROVIDER_SETUP[provider];
  if (!guide) return null;
  return (
    <div className="mt-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-sm font-semibold text-[var(--color-fg)]">How to set up {label}</span>
        {guide.docsUrl && (
          <a
            href={guide.docsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-[var(--color-accent)] underline"
          >
            docs ↗
          </a>
        )}
      </div>
      <p className="mb-2 text-xs text-[var(--color-fg-muted)]">{guide.powers}</p>
      {guide.warning && (
        <p className="mb-2 rounded border border-[var(--color-danger)] bg-[var(--color-danger)]/10 px-2 py-1.5 text-[11px] text-[var(--color-danger)]">
          ⚠ {guide.warning}
        </p>
      )}
      <ol className="ml-4 list-decimal space-y-1 text-xs text-[var(--color-fg-muted)]">
        {guide.steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      <div className="mt-2 space-y-0.5 text-[11px] text-[var(--color-fg-subtle)]">
        <div>
          <span className="font-medium text-[var(--color-fg-muted)]">Secret:</span>{" "}
          {guide.secretHint}
        </div>
        {guide.endpointHint && (
          <div>
            <span className="font-medium text-[var(--color-fg-muted)]">Proxy URL:</span>{" "}
            {guide.endpointHint}
          </div>
        )}
      </div>
    </div>
  );
}

function PricingEditor({
  pricing,
  onSave,
  busy,
}: {
  pricing: Pricing;
  onSave: (p: Pricing) => void;
  busy: boolean;
}) {
  const [p, setP] = useState<Pricing>(pricing);
  useEffect(() => setP(pricing), [pricing]);

  const num = (v: string) => (v === "" ? 0 : Number(v));

  return (
    <section>
      <h2 className="mb-1 text-sm font-semibold text-[var(--color-fg)]">Generation pricing</h2>
      <p className="mb-3 text-xs text-[var(--color-fg-muted)]">
        Monthly generation credits per plan (-1 = unlimited) and the credit cost per model tier
        (tier 1 = cheap, 3 = premium). Debited on each image/video/music generation.
      </p>
      <div className="flex flex-wrap gap-6 rounded-lg border border-[var(--color-border)] p-3">
        <div>
          <div className="mb-1 text-[11px] uppercase text-[var(--color-fg-subtle)]">
            Credits / month
          </div>
          {(["free", "creator", "pro", "studio"] as const).map((plan) => (
            <label key={plan} className="mb-1 flex items-center gap-2 text-sm">
              <span className="w-16 capitalize">{plan}</span>
              <input
                type="number"
                value={p.creditsByPlan[plan]}
                onChange={(e) =>
                  setP({ ...p, creditsByPlan: { ...p.creditsByPlan, [plan]: num(e.target.value) } })
                }
                className="w-24 rounded border border-[var(--color-border)] bg-[var(--color-bg-2)] px-2 py-1 text-sm"
              />
            </label>
          ))}
        </div>
        <div>
          <div className="mb-1 text-[11px] uppercase text-[var(--color-fg-subtle)]">
            Cost per tier
          </div>
          {([1, 2, 3] as const).map((tier) => (
            <label key={tier} className="mb-1 flex items-center gap-2 text-sm">
              <span className="w-16">Tier {tier}</span>
              <input
                type="number"
                value={p.costByTier[tier]}
                onChange={(e) =>
                  setP({ ...p, costByTier: { ...p.costByTier, [tier]: num(e.target.value) } })
                }
                className="w-24 rounded border border-[var(--color-border)] bg-[var(--color-bg-2)] px-2 py-1 text-sm"
              />
            </label>
          ))}
        </div>
      </div>
      <button
        onClick={() => onSave(p)}
        disabled={busy}
        className="mt-3 rounded-lg bg-[var(--color-accent)] px-3 py-2 text-sm font-semibold text-black disabled:opacity-40"
      >
        Save pricing
      </button>
    </section>
  );
}
