"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import { Wordmark } from "@/components/Wordmark";
import { getAllApiKeys } from "@/lib/api-keys/store";

type BrandKit = {
  logoPath: string | null;
  primaryColor: string | null;
  accentColor: string | null;
  fontFamily: string | null;
  watermarkPath: string | null;
  channelName: string | null;
  hostName: string | null;
  hostDescription: string | null;
  toneVoice: string | null;
  targetAudience: string | null;
  voiceId: string | null;
  voiceSamplePath: string | null;
};

export default function BrandKitPage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [kit, setKit] = useState<BrandKit | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isPending && !session) router.replace("/app/login");
  }, [isPending, session, router]);

  async function refresh() {
    const r = await fetch("/api/brand-kit");
    if (!r.ok) return;
    setKit(await r.json());
  }

  useEffect(() => {
    if (session) refresh();
  }, [session]);

  async function save(patch: Partial<BrandKit>) {
    setSaving(true);
    const r = await fetch("/api/brand-kit", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(patch),
    });
    setSaving(false);
    if (r.ok) setKit(await r.json());
  }

  async function upload(kind: "logo" | "watermark", file: File) {
    const form = new FormData();
    form.append("kind", kind);
    form.append("file", file);
    const r = await fetch("/api/brand-kit", { method: "POST", body: form });
    if (r.ok) setKit(await r.json());
  }

  if (isPending || !session || !kit) {
    return (
      <main className="flex min-h-screen items-center justify-center text-[var(--color-fg-muted)]">
        Loading...
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl p-4 sm:p-8">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-3 sm:mb-10">
        <Link href="/app/projects">
          <Wordmark size="md" />
        </Link>
        <nav className="flex flex-wrap gap-3 text-sm">
          <Link
            href="/app/projects"
            className="text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
          >
            Projects
          </Link>
          <Link href="/app/settings/brand" className="text-[var(--color-accent)]">
            Brand kit
          </Link>
        </nav>
      </header>

      <h1 className="mb-2 text-2xl font-bold sm:text-3xl">Brand kit</h1>
      <p className="mb-8 text-[var(--color-fg-muted)]">
        Upload once. The agent auto-applies these to every composition you create.
      </p>

      <section className="mb-8 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:p-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider">Logo & watermark</h2>
        <div className="grid grid-cols-2 gap-4">
          <UploadCard
            label="Channel logo"
            currentPath={kit.logoPath}
            onPick={(f) => upload("logo", f)}
          />
          <UploadCard
            label="Watermark"
            currentPath={kit.watermarkPath}
            onPick={(f) => upload("watermark", f)}
          />
        </div>
      </section>

      <section className="mb-8 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:p-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider">Channel + colors</h2>
        <label className="mb-4 block">
          <span className="mb-1 block text-xs text-[var(--color-fg-muted)]">
            Channel name (used in templates)
          </span>
          <input
            value={kit.channelName ?? ""}
            placeholder="Your channel name"
            onChange={(e) => setKit({ ...kit, channelName: e.target.value })}
            onBlur={() => save({ channelName: kit.channelName ?? "" })}
            className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 outline-none focus:border-[var(--color-accent)]"
          />
        </label>
        <div className="grid grid-cols-2 gap-4">
          <ColorPicker
            label="Primary color"
            value={kit.primaryColor || "#ff2b3a"}
            onChange={(v) => save({ primaryColor: v })}
          />
          <ColorPicker
            label="Accent color"
            value={kit.accentColor || "#ffd166"}
            onChange={(v) => save({ accentColor: v })}
          />
        </div>
        <label className="mt-4 block">
          <span className="mb-1 block text-xs text-[var(--color-fg-muted)]">
            Font family (CSS family name, e.g. "Anton", "Inter")
          </span>
          <input
            value={kit.fontFamily ?? ""}
            placeholder="Anton"
            onChange={(e) => setKit({ ...kit, fontFamily: e.target.value })}
            onBlur={() => save({ fontFamily: kit.fontFamily ?? "" })}
            className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 font-mono outline-none focus:border-[var(--color-accent)]"
          />
        </label>
      </section>

      <section className="mb-8 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:p-6">
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wider">On-screen host</h2>
        <p className="mb-4 text-xs text-[var(--color-fg-muted)]">
          Describe your recurring host/presenter. The agent uses this to keep the character
          consistent across scenes and projects (illustrated archetype, pose, palette, energy).
        </p>
        <label className="mb-4 block">
          <span className="mb-1 block text-xs text-[var(--color-fg-muted)]">Host name</span>
          <input
            value={kit.hostName ?? ""}
            placeholder="The Analyst"
            onChange={(e) => setKit({ ...kit, hostName: e.target.value })}
            onBlur={() => save({ hostName: kit.hostName ?? "" })}
            className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 outline-none focus:border-[var(--color-accent)]"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-[var(--color-fg-muted)]">
            Description (visual + tone)
          </span>
          <textarea
            value={kit.hostDescription ?? ""}
            placeholder="Comic-style illustrated narrator, black suit + red tie, mid-30s, looks confident, talks to camera from the lower-left corner of each scene."
            rows={4}
            onChange={(e) => setKit({ ...kit, hostDescription: e.target.value })}
            onBlur={() => save({ hostDescription: kit.hostDescription ?? "" })}
            className="w-full resize-y rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
          />
        </label>
      </section>

      <section className="mb-8 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:p-6">
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wider">Voice & audience</h2>
        <p className="mb-4 text-xs text-[var(--color-fg-muted)]">
          The agent uses these to calibrate every script, caption, and voiceover.
        </p>
        <label className="mb-4 block">
          <span className="mb-1 block text-xs text-[var(--color-fg-muted)]">Tone & voice</span>
          <input
            value={kit.toneVoice ?? ""}
            placeholder="e.g. authoritative but approachable, slightly dramatic"
            onChange={(e) => setKit({ ...kit, toneVoice: e.target.value })}
            onBlur={() => save({ toneVoice: kit.toneVoice ?? "" })}
            className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-[var(--color-fg-muted)]">Target audience</span>
          <input
            value={kit.targetAudience ?? ""}
            placeholder="e.g. college students age 18-24 interested in personal finance"
            onChange={(e) => setKit({ ...kit, targetAudience: e.target.value })}
            onBlur={() => save({ targetAudience: kit.targetAudience ?? "" })}
            className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
          />
        </label>
      </section>

      <VoiceCloneSection kit={kit} onUpdate={refresh} />

      {saving && <div className="text-xs text-[var(--color-fg-muted)]">Saving…</div>}
    </main>
  );
}

function UploadCard({
  label,
  currentPath,
  onPick,
}: {
  label: string;
  currentPath: string | null;
  onPick: (file: File) => void;
}) {
  return (
    <label className="block cursor-pointer">
      <span className="mb-1 block text-xs text-[var(--color-fg-muted)]">{label}</span>
      <div className="flex aspect-square items-center justify-center rounded-md border border-dashed border-[var(--color-border)] bg-[var(--color-bg)] p-4 hover:border-[var(--color-fg-muted)]">
        {currentPath ? (
          <img src={currentPath} alt={label} className="max-h-full max-w-full object-contain" />
        ) : (
          <span className="text-xs text-[var(--color-fg-muted)]">Click to upload</span>
        )}
      </div>
      <input
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPick(f);
        }}
      />
    </label>
  );
}

function VoiceCloneSection({ kit, onUpdate }: { kit: BrandKit; onUpdate: () => void }) {
  const [recording, setRecording] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testAudioUrl, setTestAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function getKey() {
    try {
      return getAllApiKeys().elevenlabs || null;
    } catch {
      return null;
    }
  }

  async function startRecording() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      chunksRef.current = [];
      recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        uploadSample(blob, "recording.webm");
      };
      recorderRef.current = recorder;
      recorder.start();
      setRecording(true);
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    } catch {
      setError("Microphone access denied. Allow mic access and try again.");
    }
  }

  function stopRecording() {
    recorderRef.current?.stop();
    recorderRef.current = null;
    setRecording(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  async function uploadSample(blob: Blob, filename: string) {
    const key = getKey();
    if (!key) {
      setError("No ElevenLabs API key found. Add it at /app/settings/api-keys first.");
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", blob, filename);
      form.append("name", "My Voice");
      const r = await fetch("/api/brand-kit/voice", {
        method: "POST",
        headers: { "x-elevenlabs-key": key },
        body: form,
      });
      const data = (await r.json()) as { ok?: boolean; message?: string };
      if (!r.ok) {
        setError(data.message || "Voice cloning failed.");
      } else {
        onUpdate();
      }
    } catch {
      setError("Network error — try again.");
    } finally {
      setUploading(false);
    }
  }

  async function deleteVoice() {
    setDeleting(true);
    const key = getKey();
    await fetch("/api/brand-kit/voice", {
      method: "DELETE",
      headers: key ? { "x-elevenlabs-key": key } : {},
    });
    setDeleting(false);
    setTestAudioUrl(null);
    onUpdate();
  }

  async function testVoice() {
    const key = getKey();
    if (!kit.voiceId || !key) return;
    setTesting(true);
    try {
      const r = await fetch("https://api.elevenlabs.io/v1/text-to-speech/" + kit.voiceId, {
        method: "POST",
        headers: {
          "xi-api-key": key,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          text: "Hey, this is what I sound like. Pretty good, right?",
          model_id: "eleven_multilingual_v2",
        }),
      });
      if (r.ok) {
        const blob = await r.blob();
        setTestAudioUrl(URL.createObjectURL(blob));
      }
    } catch {
      /* ignore */
    } finally {
      setTesting(false);
    }
  }

  const hasVoice = !!kit.voiceId;

  return (
    <section className="mb-8 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:p-6">
      <h2 className="mb-1 text-sm font-semibold uppercase tracking-wider">Your voice</h2>
      <p className="mb-4 text-xs text-[var(--color-fg-muted)]">
        Clone your voice once — the agent uses it automatically on every voiceover. Requires your
        ElevenLabs API key at{" "}
        <Link href="/app/settings/api-keys" className="text-[var(--color-accent)] hover:underline">
          Settings → API keys
        </Link>
        .
      </p>

      {hasVoice ? (
        <div className="rounded-lg border border-[var(--color-success)]/30 bg-[var(--color-success)]/5 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-[var(--color-success)]">
                <span className="inline-block h-2 w-2 rounded-full bg-[var(--color-success)]" />
                Voice cloned
              </div>
              <div className="mt-0.5 font-mono text-[10px] text-[var(--color-fg-subtle)]">
                ID: {kit.voiceId}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={testVoice}
                disabled={testing}
                className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-medium text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] disabled:opacity-50"
              >
                {testing ? "Generating…" : "▶ Test"}
              </button>
              <button
                onClick={deleteVoice}
                disabled={deleting}
                className="rounded-md border border-[var(--color-danger)]/30 px-3 py-1.5 text-xs font-medium text-[var(--color-danger)] hover:bg-[var(--color-danger)]/8 disabled:opacity-50"
              >
                {deleting ? "Removing…" : "Remove"}
              </button>
            </div>
          </div>
          {testAudioUrl && (
            <audio src={testAudioUrl} controls autoPlay className="mt-3 h-8 w-full" />
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-2)] p-4 text-xs text-[var(--color-fg-muted)]">
            <p className="font-medium text-[var(--color-fg)]">Tips for best results</p>
            <ul className="mt-2 space-y-1 list-disc list-inside">
              <li>Record at least 30 seconds of natural speech</li>
              <li>Quiet room, no background music or echo</li>
              <li>Speak naturally — don&apos;t over-enunciate</li>
            </ul>
          </div>

          {/* Record button */}
          <div className="flex items-center gap-3">
            {!recording ? (
              <button
                onClick={startRecording}
                disabled={uploading}
                className="flex items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2.5 text-sm font-medium text-[var(--color-fg)] hover:border-[var(--color-accent)]/50 disabled:opacity-50"
              >
                <span className="h-3 w-3 rounded-full bg-[var(--color-danger)]" />
                Record sample
              </button>
            ) : (
              <button
                onClick={stopRecording}
                className="flex items-center gap-2 rounded-xl border border-[var(--color-danger)]/40 bg-[var(--color-danger)]/8 px-4 py-2.5 text-sm font-medium text-[var(--color-danger)]"
              >
                <span className="inline-block h-3 w-3 animate-pulse rounded-full bg-[var(--color-danger)]" />
                Stop recording · {elapsed}s
              </button>
            )}

            <span className="text-[var(--color-fg-subtle)] text-xs">or</span>

            {/* File upload */}
            <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2.5 text-sm font-medium text-[var(--color-fg-muted)] hover:border-[var(--color-accent)]/50">
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              Upload audio
              <input
                type="file"
                accept="audio/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadSample(f, f.name);
                }}
              />
            </label>
          </div>

          {uploading && (
            <div className="flex items-center gap-2 text-xs text-[var(--color-fg-muted)]">
              <span className="inline-block h-3 w-3 animate-spin rounded-full border border-[var(--color-border)] border-t-[var(--color-accent)]" />
              Cloning voice on ElevenLabs…
            </div>
          )}
        </div>
      )}

      {error && <p className="mt-3 text-xs text-[var(--color-danger)]">{error}</p>}
    </section>
  );
}

function ColorPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label>
      <span className="mb-1 block text-xs text-[var(--color-fg-muted)]">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-12 cursor-pointer rounded border border-[var(--color-border)] bg-transparent"
        />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1 font-mono text-sm"
        />
      </div>
    </label>
  );
}
