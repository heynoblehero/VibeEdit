"use client";

// Auto/Manual model picker. Opens from a chip on the chat composer. In Auto mode
// the agent chooses the best model per asset; in Manual mode the user pins a
// model per asset type. Persists to /api/account/model-preferences.

import { useEffect, useState } from "react";

type ModelTask = "brain" | "image" | "video" | "music" | "voice" | "motion";
type ModelMode = "auto" | "manual";

type ModelOption = {
  id: string;
  label: string;
  task: ModelTask;
  provider: string;
  official: boolean;
  default?: boolean;
  costTier: 1 | 2 | 3;
  note?: string;
  configured: boolean;
};

type PrefsResponse = {
  preferences: { mode: ModelMode; choices: Partial<Record<ModelTask, string>> };
  models: Record<ModelTask, ModelOption[]>;
};

const TASK_ORDER: ModelTask[] = ["brain", "image", "video", "music", "voice", "motion"];

const TASK_LABEL: Record<ModelTask, string> = {
  brain: "AI brain",
  image: "Images",
  video: "Video / b-roll",
  music: "Music",
  voice: "Voiceover",
  motion: "Motion (character)",
};

const TASK_HINT: Record<ModelTask, string> = {
  brain:
    "Vibe is fast and efficient. Vibe Max is the smartest brain for complex edits — it costs ~2× credits per edit. Choose either in Auto or Manual mode.",
  image: "Stills, backgrounds, scene art.",
  video: "Generated b-roll clips.",
  music: "Original score / song beds.",
  voice: "Narration / voiceover.",
  motion: "Character animation & pose transfer.",
};

function tierLabel(tier: 1 | 2 | 3): string {
  return tier === 1 ? "$" : tier === 2 ? "$$" : "$$$";
}

export function ModelPicker({
  onClose,
  onModeChange,
}: {
  onClose: () => void;
  onModeChange?: (mode: ModelMode) => void;
}) {
  const [data, setData] = useState<PrefsResponse | null>(null);
  const [mode, setMode] = useState<ModelMode>("auto");
  const [choices, setChoices] = useState<Partial<Record<ModelTask, string>>>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/account/model-preferences")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((json: PrefsResponse) => {
        if (!active) return;
        setData(json);
        setMode(json.preferences.mode);
        setChoices(json.preferences.choices ?? {});
      })
      .catch((e: Error) => active && setLoadError(e.message));
    return () => {
      active = false;
    };
  }, []);

  // Close on Escape.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function save() {
    setSaving(true);
    setSaveError(null);
    // In Manual mode send all picked choices. In Auto mode the per-asset picks
    // are ignored — but the brain tier (Vibe / Vibe Max) always applies, so
    // preserve it regardless of mode.
    const body = {
      mode,
      choices: mode === "manual" ? choices : choices.brain ? { brain: choices.brain } : {},
    };
    try {
      const res = await fetch("/api/account/model-preferences", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const msg = await res.text().catch(() => "");
        throw new Error(msg || `HTTP ${res.status}`);
      }
      onModeChange?.(mode);
      onClose();
    } catch (e) {
      setSaveError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Model selection"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-[var(--color-fg)]">Models</h2>
            <p className="text-[11px] text-[var(--color-fg-muted)]">
              Let the AI pick, or choose your own per asset type.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {loadError && (
            <p className="rounded-lg bg-[var(--color-danger)]/10 px-3 py-2 text-xs text-[var(--color-danger)]">
              Couldn't load models: {loadError}
            </p>
          )}
          {!data && !loadError && (
            <p className="py-8 text-center text-xs text-[var(--color-fg-muted)]">Loading…</p>
          )}

          {data && (
            <>
              {/* Mode toggle */}
              <div className="mb-4 grid grid-cols-2 gap-2">
                <button
                  onClick={() => setMode("auto")}
                  className={`rounded-xl border px-3 py-2.5 text-left transition-colors ${
                    mode === "auto"
                      ? "border-[var(--color-accent)] bg-[var(--color-accent)]/8"
                      : "border-[var(--color-border)] hover:bg-[var(--color-surface)]"
                  }`}
                >
                  <div className="text-xs font-semibold text-[var(--color-fg)]">⚡ Auto</div>
                  <div className="mt-0.5 text-[10px] leading-snug text-[var(--color-fg-muted)]">
                    AI picks the best model for each asset.
                  </div>
                </button>
                <button
                  onClick={() => setMode("manual")}
                  className={`rounded-xl border px-3 py-2.5 text-left transition-colors ${
                    mode === "manual"
                      ? "border-[var(--color-accent)] bg-[var(--color-accent)]/8"
                      : "border-[var(--color-border)] hover:bg-[var(--color-surface)]"
                  }`}
                >
                  <div className="text-xs font-semibold text-[var(--color-fg)]">🎛️ Manual</div>
                  <div className="mt-0.5 text-[10px] leading-snug text-[var(--color-fg-muted)]">
                    Choose your own model per asset type.
                  </div>
                </button>
              </div>

              {/* Per-task selectors. The brain (Vibe / Vibe Max) is always
                  selectable; per-asset generation models grey out in Auto. */}
              <div>
                {TASK_ORDER.map((task) => {
                  const options = data.models[task] ?? [];
                  if (options.length === 0) return null;
                  const isBrain = task === "brain";
                  const rowLocked = mode === "auto" && !isBrain;
                  const selected = choices[task] ?? options.find((o) => o.default)?.id ?? "";
                  const picked = options.find((o) => o.id === selected);
                  return (
                    <div
                      key={task}
                      className={`mb-3 ${rowLocked ? "pointer-events-none opacity-45" : ""}`}
                    >
                      <div className="mb-1 flex items-baseline justify-between">
                        <label className="text-xs font-semibold text-[var(--color-fg)]">
                          {TASK_LABEL[task]}
                        </label>
                        {rowLocked && (
                          <span className="text-[10px] text-[var(--color-fg-subtle)]">
                            Auto: {options.find((o) => o.default)?.label ?? "—"}
                          </span>
                        )}
                      </div>
                      <select
                        value={selected}
                        disabled={rowLocked}
                        onChange={(e) => setChoices((c) => ({ ...c, [task]: e.target.value }))}
                        className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-2)] px-2.5 py-2 text-xs text-[var(--color-fg)] outline-none focus:border-[var(--color-accent)]"
                      >
                        {options.map((o) => (
                          <option key={o.id} value={o.id} disabled={!o.configured}>
                            {isBrain
                              ? o.label
                              : `${o.label} · ${o.official ? "Official" : "Unofficial"} · ${tierLabel(o.costTier)}`}
                            {o.configured ? "" : " · needs setup"}
                          </option>
                        ))}
                      </select>
                      <p className="mt-1 text-[10px] leading-snug text-[var(--color-fg-subtle)]">
                        {TASK_HINT[task]}
                        {picked && !picked.configured && (
                          <span className="text-[var(--color-danger)]">
                            {" "}
                            — not configured yet; falls back to the default.
                          </span>
                        )}
                        {picked?.note && !picked.official && (
                          <span className="text-[var(--color-fg-muted)]"> {picked.note}</span>
                        )}
                      </p>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 border-t border-[var(--color-border)] px-4 py-3">
          <span className="text-[10px] text-[var(--color-danger)]">{saveError}</span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="rounded-lg px-3 py-1.5 text-xs text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
            >
              Cancel
            </button>
            <button
              onClick={save}
              disabled={saving || !data}
              className="rounded-lg bg-[var(--color-accent)] px-3.5 py-1.5 text-xs font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
