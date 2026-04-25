"use client";

import { Eye, EyeOff, Loader2, Settings, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

interface KeyStatus {
  source: "env" | "stored" | null;
  preview: string | null;
}

interface KeyRow {
  name: string;
  label: string;
  hint: string;
}

const KNOWN: KeyRow[] = [
  {
    name: "ANTHROPIC_API_KEY",
    label: "Anthropic API key",
    hint: "Powers the chat agent. Skip if you set ANTHROPIC_BASE_URL → cliproxy.",
  },
  {
    name: "ANTHROPIC_BASE_URL",
    label: "Anthropic base URL",
    hint: "Optional proxy (e.g. CLIProxyAPI for Claude Max).",
  },
  {
    name: "OPENAI_API_KEY",
    label: "OpenAI key",
    hint: "Voiceover (gpt-4o-mini-tts) + gpt-image-1 image edits + Whisper.",
  },
  {
    name: "REPLICATE_API_TOKEN",
    label: "Replicate token",
    hint: "Video (Seedance / Kling / Veo 3 / LTX), premium image (Flux), music (MusicGen).",
  },
  {
    name: "ELEVENLABS_API_KEY",
    label: "ElevenLabs key",
    hint: "Premium voices, voice cloning, sound-effect generation.",
  },
  {
    name: "TAVILY_API_KEY",
    label: "Tavily key",
    hint: "Powers the agent's webSearch tool. Free tier available.",
  },
  {
    name: "FAL_API_KEY",
    label: "Fal.ai key",
    hint: "Talking-head avatars (Hallo2). Set AVATAR_PROVIDER=fal too.",
  },
];

export function SettingsDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [status, setStatus] = useState<Record<string, KeyStatus>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [reveal, setReveal] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customValue, setCustomValue] = useState("");

  const refresh = async () => {
    try {
      const r = await fetch("/api/keys").then((res) => res.json());
      setStatus(r.keys ?? {});
    } catch {
      // ignore
    }
  };
  useEffect(() => {
    if (open) refresh();
  }, [open]);

  if (!open) return null;

  const setDraft = (name: string, value: string) =>
    setDrafts((prev) => ({ ...prev, [name]: value }));

  const handleSave = async () => {
    if (Object.keys(drafts).length === 0 && !customName) {
      onClose();
      return;
    }
    setSaving(true);
    try {
      const payload = { ...drafts };
      if (customName.trim() && customValue.trim()) {
        payload[customName.trim().toUpperCase()] = customValue.trim();
      }
      const res = await fetch("/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `save failed ${res.status}`);
      setDrafts({});
      setCustomName("");
      setCustomValue("");
      await refresh();
      toast.success("Keys saved");
    } catch (e) {
      toast.error("Save failed", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async (name: string) => {
    if (!window.confirm(`Clear ${name}?`)) return;
    await fetch("/api/keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [name]: "" }),
    });
    await refresh();
    toast(`Cleared ${name}`);
  };

  const renderRow = (row: KeyRow) => {
    const s = status[row.name];
    const has = s?.source != null;
    const isRevealed = reveal.has(row.name);
    return (
      <div key={row.name} className="flex flex-col gap-1">
        <div className="flex items-center justify-between text-[11px]">
          <label className="text-neutral-300 font-medium">
            {row.label}
            {has && (
              <span
                className={`ml-2 text-[9px] uppercase tracking-wider ${
                  s.source === "stored"
                    ? "text-emerald-400"
                    : "text-sky-400"
                }`}
              >
                {s.source === "stored" ? "set" : "env"}
                {s.preview ? ` · ${s.preview}` : ""}
              </span>
            )}
          </label>
          {has && s?.source === "stored" && (
            <button
              onClick={() => handleClear(row.name)}
              className="text-[10px] text-neutral-600 hover:text-red-400"
              title="Clear stored value"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-1">
          <input
            type={isRevealed ? "text" : "password"}
            value={drafts[row.name] ?? ""}
            onChange={(e) => setDraft(row.name, e.target.value)}
            placeholder={has ? "(set — paste new to replace)" : "paste here"}
            className="flex-1 bg-neutral-900 border border-neutral-700 rounded px-2 py-1.5 text-[12px] text-white font-mono focus:outline-none focus:border-emerald-500"
            autoComplete="off"
            spellCheck={false}
          />
          <button
            onClick={() => {
              const next = new Set(reveal);
              if (next.has(row.name)) next.delete(row.name);
              else next.add(row.name);
              setReveal(next);
            }}
            className="p-1.5 text-neutral-500 hover:text-white"
          >
            {isRevealed ? (
              <EyeOff className="h-3.5 w-3.5" />
            ) : (
              <Eye className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
        <p className="text-[10px] text-neutral-600 leading-tight">{row.hint}</p>
      </div>
    );
  };

  // Stored keys not in KNOWN list — surface them too so user can clear.
  const customStored = Object.keys(status).filter(
    (k) => status[k].source === "stored" && !KNOWN.some((r) => r.name === k),
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
        }}
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto bg-neutral-950 border border-neutral-800 rounded-xl p-5 flex flex-col gap-4 shadow-2xl"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Settings · API keys
          </h2>
          <button
            onClick={onClose}
            className="text-neutral-500 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="text-[11px] text-neutral-500 leading-relaxed">
          Keys are stored on the server at{" "}
          <code className="text-neutral-400">/data/keys.json</code> (persistent
          across restarts). They override env vars for the running process.
          Empty a field and save to clear.
        </p>

        <div className="flex flex-col gap-3">{KNOWN.map(renderRow)}</div>

        {customStored.length > 0 && (
          <div className="flex flex-col gap-1 border-t border-neutral-800 pt-3">
            <span className="text-[10px] uppercase tracking-wider text-neutral-500">
              Other stored keys
            </span>
            {customStored.map((k) => (
              <div
                key={k}
                className="flex items-center justify-between text-[11px] text-neutral-400"
              >
                <span className="font-mono">
                  {k} · {status[k].preview}
                </span>
                <button
                  onClick={() => handleClear(k)}
                  className="text-neutral-600 hover:text-red-400"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-col gap-1 border-t border-neutral-800 pt-3">
          <span className="text-[11px] font-medium text-neutral-300">
            Custom key
          </span>
          <p className="text-[10px] text-neutral-600 leading-tight">
            If the agent asks you to set a key not listed above (any new
            provider), paste the env-var name + value here.
          </p>
          <div className="flex gap-1 mt-1">
            <input
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="ENV_VAR_NAME"
              className="w-44 bg-neutral-900 border border-neutral-700 rounded px-2 py-1.5 text-[12px] text-white font-mono uppercase focus:outline-none focus:border-emerald-500"
              spellCheck={false}
            />
            <input
              value={customValue}
              onChange={(e) => setCustomValue(e.target.value)}
              type="password"
              placeholder="value"
              className="flex-1 bg-neutral-900 border border-neutral-700 rounded px-2 py-1.5 text-[12px] text-white font-mono focus:outline-none focus:border-emerald-500"
              spellCheck={false}
            />
          </div>
        </div>

        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={onClose}
            className="text-sm text-neutral-500 hover:text-white px-3 py-2"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black font-semibold px-4 py-2 rounded transition-colors"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
