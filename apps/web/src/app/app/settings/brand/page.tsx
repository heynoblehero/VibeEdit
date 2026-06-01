"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import { Wordmark } from "@/components/Wordmark";

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
