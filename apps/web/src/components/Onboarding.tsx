"use client";

import { useState } from "react";

type Niche =
  | "youtube"
  | "shorts"
  | "wedding"
  | "corporate"
  | "education"
  | "documentary"
  | "content"
  | "other";
type FormatPref = "16:9" | "9:16" | "both";
type Frequency = "daily" | "weekly" | "occasional" | "experimenting";
type ToneVoice = "energetic" | "calm" | "authoritative" | "friendly";

const NICHE_OPTIONS: Array<{ id: Niche; label: string; emoji: string }> = [
  { id: "youtube", label: "YouTube", emoji: "▶" },
  { id: "shorts", label: "Shorts / Reels / TikTok", emoji: "📱" },
  { id: "wedding", label: "Weddings & Events", emoji: "🎥" },
  { id: "corporate", label: "Corporate & Brand", emoji: "🏢" },
  { id: "education", label: "Tutorial & Education", emoji: "📚" },
  { id: "documentary", label: "Documentary & Film", emoji: "🎬" },
  { id: "content", label: "Content Creator", emoji: "✨" },
  { id: "other", label: "Something else", emoji: "✦" },
];

const FORMAT_OPTIONS: Array<{ id: FormatPref; label: string; sub: string }> = [
  { id: "9:16", label: "Vertical", sub: "Shorts / Reels / TikTok" },
  { id: "16:9", label: "Horizontal", sub: "YouTube long-form" },
  { id: "both", label: "Both", sub: "Mix of formats" },
];

const FREQUENCY_OPTIONS: Array<{ id: Frequency; label: string }> = [
  { id: "daily", label: "Daily" },
  { id: "weekly", label: "Weekly" },
  { id: "occasional", label: "Occasionally" },
  { id: "experimenting", label: "Just exploring" },
];

const TONE_OPTIONS: Array<{ id: ToneVoice; label: string; sub: string }> = [
  { id: "energetic", label: "Energetic", sub: "Bold, punchy, high-energy" },
  { id: "calm", label: "Calm", sub: "Measured, soothing, steady" },
  { id: "authoritative", label: "Authoritative", sub: "Confident, expert, commanding" },
  { id: "friendly", label: "Friendly", sub: "Warm, conversational, approachable" },
];

export function Onboarding({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState<"preferences" | "brand">("preferences");
  const [niche, setNiche] = useState<Niche | null>(null);
  const [format, setFormat] = useState<FormatPref | null>(null);
  const [frequency, setFrequency] = useState<Frequency | null>(null);
  const [channelName, setChannelName] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#7c3aed");
  const [toneVoice, setToneVoice] = useState<ToneVoice | null>(null);
  const [saving, setSaving] = useState(false);

  const canContinue = !!(niche && format && frequency);

  function goToBrand() {
    if (canContinue) setStep("brand");
  }

  async function submit(skip = false) {
    setSaving(true);
    try {
      const response = await fetch("/api/onboarding", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          niche: skip ? null : niche,
          formatPreference: skip ? null : format,
          postFrequency: skip ? null : frequency,
          onboardingCompleted: true,
        }),
      });
      // Save brand kit if user filled anything in on step 2.
      if (!skip && (channelName.trim() || toneVoice || primaryColor !== "#7c3aed")) {
        await fetch("/api/brand-kit", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            channelName: channelName.trim() || null,
            primaryColor,
            toneVoice: toneVoice || null,
          }),
        });
      }
      const data = (await response.json().catch(() => ({}))) as {
        firstProjectId?: string | null;
      };
      if (data?.firstProjectId) {
        window.location.href = `/app/projects/${data.firstProjectId}/edit`;
        return;
      }
    } catch {
      // Network or parse error — still dismiss so the user isn't stuck.
    } finally {
      setSaving(false);
    }
    onDone();
  }

  return (
    // Clicking the backdrop skips onboarding so the overlay never traps the user.
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-6"
      onClick={() => submit(true)}
      role="presentation"
    >
      <div
        className="w-full max-w-2xl rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Step indicator + close button */}
        <div className="mb-6 flex items-center gap-2">
          <div className="h-1.5 flex-1 rounded-full bg-[var(--color-accent)]" />
          <div
            className={`h-1.5 flex-1 rounded-full transition-colors ${step === "brand" ? "bg-[var(--color-accent)]" : "bg-[var(--color-border)]"}`}
          />
          <button
            onClick={() => submit(true)}
            disabled={saving}
            className="ml-2 flex h-6 w-6 items-center justify-center rounded-lg text-[var(--color-fg-muted)] hover:bg-[var(--color-bg-2)] hover:text-[var(--color-fg)] disabled:opacity-40"
            title="Skip setup"
            aria-label="Skip setup"
          >
            <svg
              width="10"
              height="10"
              viewBox="0 0 10 10"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M1 1l8 8M9 1L1 9" />
            </svg>
          </button>
        </div>

        {step === "preferences" ? (
          <>
            <div className="mb-2 text-xs uppercase tracking-wider text-[var(--color-fg-muted)]">
              Step 1 of 2 — Quick setup
            </div>
            <h2 className="mb-1 text-2xl font-bold">Tell us what you edit.</h2>
            <p className="mb-8 text-sm text-[var(--color-fg-muted)]">
              30 seconds. Helps the agent match your workflow from the first message.
            </p>

            <section className="mb-6">
              <h3 className="mb-3 text-sm font-semibold">What do you mostly edit?</h3>
              <div className="grid grid-cols-3 gap-2">
                {NICHE_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    onClick={() => setNiche(option.id)}
                    className={`rounded-lg border px-3 py-3 text-left text-sm transition ${
                      niche === option.id
                        ? "border-[var(--color-accent)] bg-[var(--color-bg-2)]"
                        : "border-[var(--color-border)] hover:border-[var(--color-fg-muted)]"
                    }`}
                  >
                    <div className="mb-0.5 text-lg leading-none">{option.emoji}</div>
                    <div className="text-xs">{option.label}</div>
                  </button>
                ))}
              </div>
            </section>

            <section className="mb-6">
              <h3 className="mb-3 text-sm font-semibold">Vertical or horizontal?</h3>
              <div className="grid grid-cols-3 gap-2">
                {FORMAT_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    onClick={() => setFormat(option.id)}
                    className={`rounded-lg border px-4 py-3 text-left transition ${
                      format === option.id
                        ? "border-[var(--color-accent)] bg-[var(--color-bg-2)]"
                        : "border-[var(--color-border)] hover:border-[var(--color-fg-muted)]"
                    }`}
                  >
                    <div className="text-sm font-semibold">{option.label}</div>
                    <div className="text-xs text-[var(--color-fg-muted)]">{option.sub}</div>
                  </button>
                ))}
              </div>
            </section>

            <section className="mb-8">
              <h3 className="mb-3 text-sm font-semibold">How often do you post?</h3>
              <div className="grid grid-cols-4 gap-2">
                {FREQUENCY_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    onClick={() => setFrequency(option.id)}
                    className={`rounded-lg border px-3 py-2 text-sm transition ${
                      frequency === option.id
                        ? "border-[var(--color-accent)] bg-[var(--color-bg-2)]"
                        : "border-[var(--color-border)] hover:border-[var(--color-fg-muted)]"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </section>

            <div className="flex items-center justify-between">
              <button
                onClick={() => submit(true)}
                disabled={saving}
                className="text-sm text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] disabled:opacity-50"
              >
                Skip for now
              </button>
              <button
                onClick={goToBrand}
                disabled={!canContinue}
                className="rounded-md bg-[var(--color-accent)] px-6 py-2.5 font-semibold text-black hover:opacity-90 disabled:opacity-50"
              >
                Next: Brand kit →
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="mb-2 text-xs uppercase tracking-wider text-[var(--color-fg-muted)]">
              Step 2 of 2 — Brand kit
            </div>
            <h2 className="mb-1 text-2xl font-bold">Set your brand once, use it forever.</h2>
            <p className="mb-8 text-sm text-[var(--color-fg-muted)]">
              The AI applies these to every video automatically — and we&apos;ll use them to render
              your first sample video right now, waiting for you in the editor. You can change them
              anytime.
            </p>

            <section className="mb-6">
              <h3 className="mb-3 text-sm font-semibold">Channel name</h3>
              <input
                value={channelName}
                onChange={(e) => setChannelName(e.target.value)}
                placeholder="e.g. FactForge, NightOwl Finance…"
                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-2)] px-3.5 py-2.5 text-sm outline-none placeholder:text-[var(--color-fg-subtle)] focus:border-[var(--color-accent)]"
              />
            </section>

            <section className="mb-6">
              <h3 className="mb-3 text-sm font-semibold">Primary color</h3>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="h-10 w-16 cursor-pointer rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-2)] p-1"
                />
                <span className="font-mono text-sm text-[var(--color-fg-muted)]">
                  {primaryColor}
                </span>
                <div className="h-8 w-8 rounded-lg" style={{ backgroundColor: primaryColor }} />
              </div>
            </section>

            <section className="mb-8">
              <h3 className="mb-3 text-sm font-semibold">Tone &amp; voice</h3>
              <div className="grid grid-cols-2 gap-2">
                {TONE_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    onClick={() => setToneVoice(option.id)}
                    className={`rounded-lg border px-4 py-3 text-left transition ${
                      toneVoice === option.id
                        ? "border-[var(--color-accent)] bg-[var(--color-bg-2)]"
                        : "border-[var(--color-border)] hover:border-[var(--color-fg-muted)]"
                    }`}
                  >
                    <div className="text-sm font-semibold">{option.label}</div>
                    <div className="text-xs text-[var(--color-fg-muted)]">{option.sub}</div>
                  </button>
                ))}
              </div>
            </section>

            <div className="mb-6 flex items-start gap-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-2)] px-4 py-3 text-xs text-[var(--color-fg-muted)]">
              <span aria-hidden="true">🔑</span>
              <span>
                To generate AI images, video &amp; voiceover, add your own provider keys later in{" "}
                <span className="font-medium text-[var(--color-fg)]">Settings → API keys</span>. The
                editor, chat, and renders all work without them.
              </span>
            </div>

            <div className="flex items-center justify-between">
              <button
                onClick={() => setStep("preferences")}
                className="text-sm text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
              >
                ← Back
              </button>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => submit(true)}
                  disabled={saving}
                  className="text-sm text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] disabled:opacity-50"
                >
                  Skip brand
                </button>
                <button
                  onClick={() => submit(false)}
                  disabled={saving}
                  className="rounded-md bg-[var(--color-accent)] px-6 py-2.5 font-semibold text-black hover:opacity-90 disabled:opacity-50"
                >
                  {saving ? "Making your first video…" : "Get started"}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
